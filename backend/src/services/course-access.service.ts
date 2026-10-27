import {
	AcademicClass,
	AcademicTerm,
	Branch,
	Course,
	CourseDocument,
	Faculty,
	FacultyCourseAssignment,
	Student,
	StudentClassEnrolment,
	User,
} from '../models';
import { classLabel } from './branch.service';
import { AppError, notFound } from '../utils/errors';
import { env } from '../config/env';

export type CourseOption = {
	id: number;
	code: string;
	name: string;
};

export type StudentCourseOption = CourseOption & {
	materialCount: number;
};

export async function facultyCourses(userId: number, academicTermId: number): Promise<CourseOption[]> {
	const faculty = await requireActiveFaculty(userId);
	await requireTerm(academicTermId);
	const rows = await FacultyCourseAssignment.findAll({
		where: { facultyId: faculty.id, academicTermId, status: 'ACTIVE' },
	});
	return loadCourses(rows.map((row) => Number(row.courseId)));
}

export async function requireEligibleFaculty(userId: number, courseId: number, academicTermId: number): Promise<Faculty> {
	const faculty = await requireActiveFaculty(userId);
	const course = await Course.findByPk(courseId);
	if (!course) {
		throw notFound('Course not found.');
	}
	await requireTerm(academicTermId);
	const eligibility = await FacultyCourseAssignment.findOne({
		where: { facultyId: faculty.id, courseId, academicTermId, status: 'ACTIVE' },
	});
	if (!eligibility) {
		throw new AppError(403, 'FORBIDDEN', 'You are not allowed to use this course.');
	}
	return faculty;
}

export async function studentCourseContext(userId: number, academicTermId: number): Promise<{
	classLabel: string | null;
	courses: StudentCourseOption[];
}> {
	const student = await requireActiveStudent(userId);
	await requireTerm(academicTermId);
	const enrolment = await StudentClassEnrolment.findOne({ where: { studentId: student.id, status: 'ACTIVE' } });
	const schoolClass = enrolment ? await AcademicClass.findByPk(enrolment.classId) : null;
	const branch = schoolClass ? await Branch.findByPk(schoolClass.branchId) : null;
	const label = schoolClass && branch
		? classLabel(branch.code, Number(schoolClass.yearLevel), schoolClass.sectionCode)
		: null;
	const publishedDocuments = await CourseDocument.findAll({
		attributes: ['courseId'],
		where: {
			academicTermId,
			status: 'READY',
			embeddingModel: env.rag.embeddingModel,
			embeddingDimensions: env.rag.embeddingDimensions,
		},
	});
	const counts = new Map<number, number>();
	for (const document of publishedDocuments) {
		const courseId = Number(document.courseId);
		counts.set(courseId, (counts.get(courseId) ?? 0) + 1);
	}
	const courses = await loadCourses([...counts.keys()]);
	return {
		classLabel: label,
		courses: courses.map((course) => ({ ...course, materialCount: counts.get(course.id) ?? 0 })),
	};
}

export async function requireStudentCourse(userId: number, courseId: number, academicTermId: number): Promise<number> {
	const course = await Course.findOne({ where: { id: courseId, isActive: true } });
	if (!course) {
		throw notFound('Course not found.');
	}
	await requireActiveStudent(userId);
	await requireTerm(academicTermId);
	const hasPublishedMaterials = await CourseDocument.count({
		where: {
			courseId,
			academicTermId,
			status: 'READY',
			embeddingModel: env.rag.embeddingModel,
			embeddingDimensions: env.rag.embeddingDimensions,
		},
	});
	if (hasPublishedMaterials === 0) {
		throw new AppError(403, 'FORBIDDEN', 'You are not allowed to use this course.');
	}
	const student = await Student.findOne({ where: { userId } });
	if (!student) {
		throw new AppError(403, 'FORBIDDEN', 'Student access required');
	}
	return Number(student.id);
}

async function requireActiveFaculty(userId: number): Promise<Faculty> {
	const faculty = await Faculty.findOne({ where: { userId } });
	const user = await User.findByPk(userId);
	if (!faculty || !faculty.isActive || !user?.isActive) {
		throw new AppError(403, 'FORBIDDEN', 'Faculty access required');
	}
	return faculty;
}

async function requireActiveStudent(userId: number): Promise<Student> {
	const student = await Student.findOne({ where: { userId } });
	const user = await User.findByPk(userId);
	if (!student || !student.isActive || !user?.isActive) {
		throw new AppError(403, 'FORBIDDEN', 'Student access required');
	}
	return student;
}

async function requireTerm(academicTermId: number): Promise<void> {
	const term = await AcademicTerm.findByPk(academicTermId);
	if (!term) {
		throw notFound('Academic term not found.');
	}
}

async function loadCourses(ids: number[]): Promise<CourseOption[]> {
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		return [];
	}
	const courses = await Course.findAll({ where: { id: unique, isActive: true }, order: [['code', 'ASC']] });
	return courses.map((course) => ({ id: Number(course.id), code: course.code, name: course.name }));
}
