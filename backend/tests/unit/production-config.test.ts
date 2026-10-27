import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateProductionConfig, type ProductionConfigInput } from '../../src/config/production-config';

const validConfig: ProductionConfigInput = {
	nodeEnv: 'production',
	jwtSecret: 'a'.repeat(48),
	dbUser: 'campus_app',
	dbPassword: 'a-strong-database-password',
	dbSsl: true,
	geminiApiKey: 'configured-key',
	corsOrigin: 'https://campus.example.edu',
	objectStorageEndpoint: 'https://example.r2.cloudflarestorage.com',
	objectStorageBucket: 'campus-pdfs',
	objectStorageAccessKeyId: 'access-key',
	objectStorageSecretAccessKey: 'secret-key',
};

describe('production configuration', () => {
	it('accepts a complete secure production configuration', () => {
		assert.doesNotThrow(() => validateProductionConfig(validConfig));
	});

	it('allows local development defaults outside production', () => {
		assert.doesNotThrow(() => validateProductionConfig({
			...validConfig,
			nodeEnv: 'development',
			jwtSecret: 'short-local-secret',
			dbUser: 'root',
			dbPassword: '',
			dbSsl: false,
			geminiApiKey: '',
			corsOrigin: 'http://localhost:5173',
			objectStorageEndpoint: '',
			objectStorageBucket: '',
			objectStorageAccessKeyId: '',
			objectStorageSecretAccessKey: '',
		}));
	});

	it('rejects missing production secrets and non-persistent local defaults', () => {
		assert.throws(
			() => validateProductionConfig({
				...validConfig,
				jwtSecret: 'workshop-local-jwt-secret',
				dbUser: 'root',
				dbPassword: '',
				dbSsl: false,
				geminiApiKey: '',
				corsOrigin: 'http://localhost:5173',
				objectStorageEndpoint: '',
				objectStorageBucket: '',
				objectStorageAccessKeyId: '',
				objectStorageSecretAccessKey: '',
			}),
			/Invalid production configuration/,
		);
	});
});