import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const configured = existsSync('.env') && Boolean(
	process.env.DB_NAME && process.env.JWT_SECRET && process.env.DB_USER && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.DEMO_PASSWORD,
);

describe('published student course materials', () => {
	let baseUrl = '';
	let server: Server | undefined;
	let ready = false;
	let studentCookie = '';
	let termId = 0;
	let softwareEngineeringCourseId = 0;
	let unmaterialedCourseId = 0;
	let documentId = 0;
	let createdCourseId = 0;

	before(async () => {
		if (!configured) {
			return;
		}
		const { sequelize } = await import('../../src/database/connection');
		try {
			await sequelize.authenticate();
		} catch {
			return;
		}

		const adminSeedModule = await import('../../src/seeders/20261012120100-admin-user.ts') as {
			up?: (queryInterface: unknown) => Promise<void>;
			default?: { up?: (queryInterface: unknown) => Promise<void> };
		};
		const adminSeed = adminSeedModule.up ?? adminSeedModule.default?.up;
		assert.equal(typeof adminSeed, 'function');
		await adminSeed!(sequelize.getQueryInterface());

		const demoSeedModule = await import('../../src/seeders/20261014010000-demo-academic-data.ts') as {
			up?: (queryInterface: unknown) => Promise<void>;
			default?: { up?: (queryInterface: unknown) => Promise<void> };
		};
		const demoSeed = demoSeedModule.up ?? demoSeedModule.default?.up;
		assert.equal(typeof demoSeed, 'function');
		await demoSeed!(sequelize.getQueryInterface());

		const { AcademicTerm, AcademicYear, Course, CourseDocument, Faculty, Student, User } = await import('../../src/models');
		const year = await AcademicYear.findOne({ where: { name: '2026-27' } });
		const term = year ? await AcademicTerm.findOne({ where: { academicYearId: year.id, periodType: 'ODD' } }) : null;
		const studentUser = await User.findOne({ where: { email: 'cse.2a@university.test' } });
		const student = studentUser ? await Student.findOne({ where: { userId: studentUser.id } }) : null;
		const faculty = await Faculty.findOne({ where: { employeeNumber: 'CSE-FAC' } });
		const softwareEngineering = await Course.findOne({ where: { code: 'CSE502' } });
		if (!term || !studentUser || !student || !faculty || !softwareEngineering) {
			return;
		}
		termId = Number(term.id);
		softwareEngineeringCourseId = Number(softwareEngineering.id);

		const newCode = `TEST${Date.now()}`.slice(0, 30);
		const unusedCourse = await Course.create({
			code: newCode,
			name: 'Unpublished integration course',
			departmentId: null,
			description: null,
			isActive: true,
		});
		createdCourseId = Number(unusedCourse.id);
		unmaterialedCourseId = createdCourseId;

		const { env } = await import('../../src/config/env');
		const document = await CourseDocument.create({
			courseId: softwareEngineeringCourseId,
			academicTermId: termId,
			uploadedByFacultyId: Number(faculty.id),
			title: `Published test notes ${randomUUID()}`,
			originalFilename: 'published-test.pdf',
			mimeType: 'application/pdf',
			byteSize: 64,
			pageCount: 1,
			contentSha256: randomUUID().replace(/-/g, '').padEnd(64, '0'),
			storagePath: 'storage/course-documents/published-test.pdf',
			status: 'READY',
			errorMessage: null,
			embeddingModel: env.rag.embeddingModel,
			embeddingDimensions: env.rag.embeddingDimensions,
			chunkCount: 1,
		});
		documentId = Number(document.id);

		const { createApp } = await import('../../src/app');
		server = createApp().listen(0);
		await new Promise<void>((resolve) => server?.once('listening', resolve));
		const address = server.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
		const response = await fetch(`${baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'cse.2a@university.test', password: process.env.DEMO_PASSWORD }),
		});
		studentCookie = response.headers.getSetCookie().find((value) => value.startsWith('campus_token='))?.split(';')[0] ?? '';
		ready = response.ok && studentCookie.length > 0;
	});

	after(async () => {
		if (server) {
			await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
		}
		if (documentId || createdCourseId) {
			const { Course, CourseDocument } = await import('../../src/models');
			const { sequelize } = await import('../../src/database/connection');
			if (documentId) await CourseDocument.destroy({ where: { id: documentId } });
			if (createdCourseId) await Course.destroy({ where: { id: createdCourseId } });
			await sequelize.close();
		} else if (configured) {
			const { sequelize } = await import('../../src/database/connection');
			await sequelize.close();
		}
	});

	it('lists published courses and materials beyond a student curriculum', async (t) => {
		if (!ready) {
			t.skip('Configured demo database and accounts are required');
			return;
		}
		const coursesResponse = await fetch(`${baseUrl}/student/courses?academicTermId=${termId}`, {
			headers: { cookie: studentCookie },
		});
		assert.equal(coursesResponse.status, 200);
		const coursesBody = await coursesResponse.json() as { courses: Array<{ id: number; code: string; materialCount: number }> };
		const publishedCourse = coursesBody.courses.find((course) => course.id === softwareEngineeringCourseId);
		assert.ok(publishedCourse);
		assert.ok(publishedCourse.materialCount >= 1);

		const materialsResponse = await fetch(
			`${baseUrl}/student/courses/${softwareEngineeringCourseId}/materials?academicTermId=${termId}`,
			{ headers: { cookie: studentCookie } },
		);
		assert.equal(materialsResponse.status, 200);
		const materialsBody = await materialsResponse.json() as { materials: Array<{ id: number }> };
		assert.ok(materialsBody.materials.some((material) => material.id === documentId));
	});

	it('rejects a course with no published ready material', async (t) => {
		if (!ready) {
			t.skip('Configured demo database and accounts are required');
			return;
		}
		const response = await fetch(
			`${baseUrl}/student/courses/${unmaterialedCourseId}/materials?academicTermId=${termId}`,
			{ headers: { cookie: studentCookie } },
		);
		assert.equal(response.status, 403);
	});
});