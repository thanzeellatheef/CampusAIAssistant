import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';

const s3Client = env.objectStorage.endpoint
	? new S3Client({
		endpoint: env.objectStorage.endpoint,
		region: env.objectStorage.region,
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.objectStorage.accessKeyId,
			secretAccessKey: env.objectStorage.secretAccessKey,
		},
	})
	: null;

export async function storeCoursePdf(key: string, bytes: Buffer): Promise<void> {
	if (s3Client) {
		await s3Client.send(new PutObjectCommand({
			Bucket: env.objectStorage.bucket,
			Key: key,
			Body: bytes,
			ContentType: 'application/pdf',
		}));
		return;
	}

	const filePath = localPath(key);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, bytes);
}

export async function removeCoursePdf(key: string): Promise<void> {
	if (s3Client) {
		await s3Client.send(new DeleteObjectCommand({ Bucket: env.objectStorage.bucket, Key: key }));
		return;
	}
	await unlink(localPath(key)).catch((error: unknown) => {
		if (!isMissingFile(error)) {
			throw error;
		}
	});
}

function localPath(key: string): string {
	const normalizedKey = path.posix.normalize(key);
	if (normalizedKey.startsWith('../') || path.posix.isAbsolute(normalizedKey)) {
		throw new Error('Invalid course PDF storage key.');
	}
	const relativeKey = normalizedKey
		.replace(/^storage\/course-documents\//, '')
		.replace(/^course-documents\//, '');
	const filePath = path.resolve(env.documentStorageDir, relativeKey);
	if (!filePath.startsWith(`${path.resolve(env.documentStorageDir)}${path.sep}`)) {
		throw new Error('Invalid course PDF storage key.');
	}
	return filePath;
}

function isMissingFile(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}