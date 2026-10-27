export type ProductionConfigInput = {
	nodeEnv: string;
	jwtSecret: string;
	dbUser: string;
	dbPassword: string;
	dbSsl: boolean;
	geminiApiKey: string;
	corsOrigin: string;
	objectStorageEndpoint: string;
	objectStorageBucket: string;
	objectStorageAccessKeyId: string;
	objectStorageSecretAccessKey: string;
};

export function validateProductionConfig(config: ProductionConfigInput): void {
	if (config.nodeEnv !== 'production') {
		return;
	}

	const problems: string[] = [];
	if (config.jwtSecret.length < 32 || /replace-with|change-me|workshop-local/i.test(config.jwtSecret)) {
		problems.push('JWT_SECRET must be a unique secret of at least 32 characters.');
	}
	if (!config.dbUser.trim() || config.dbUser.toLowerCase() === 'root' || !config.dbPassword) {
		problems.push('DB_USER must be a non-root database account and DB_PASSWORD must be set.');
	}
	if (!config.dbSsl) {
		problems.push('DB_SSL must be enabled for production database connections.');
	}
	if (!config.geminiApiKey) {
		problems.push('GEMINI_API_KEY must be configured for document indexing and answers.');
	}
	try {
		const origin = new URL(config.corsOrigin);
		if (origin.protocol !== 'https:') {
			problems.push('CORS_ORIGIN must use HTTPS in production.');
		}
	} catch {
		problems.push('CORS_ORIGIN must be a valid HTTPS origin.');
	}
	if (!config.objectStorageEndpoint || !config.objectStorageBucket || !config.objectStorageAccessKeyId || !config.objectStorageSecretAccessKey) {
		problems.push('S3-compatible object storage endpoint, bucket, and credentials must be configured for production uploads.');
	}

	if (problems.length > 0) {
		throw new Error(`Invalid production configuration: ${problems.join(' ')}`);
	}
}