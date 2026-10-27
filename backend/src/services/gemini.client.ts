import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'QUESTION_ANSWERING';

export type GeminiClient = {
	embed(texts: string[], task: EmbeddingTask): Promise<number[][]>;
	generate(systemInstruction: string, prompt: string): Promise<string>;
};

export function getGeminiClient(): GeminiClient {
	return googleClient;
}

const googleClient: GeminiClient = {
	async embed(texts, task) {
		const ai = client();
		const response = await withRetry(() =>
			ai.models.embedContent({
				model: env.rag.embeddingModel,
				contents: texts,
				config: {
					taskType: task,
					outputDimensionality: env.rag.embeddingDimensions,
				},
			}),
		);
		return (response.embeddings ?? []).map((item) => item.values ?? []);
	},
	async generate(systemInstruction, prompt) {
		const ai = client();
		const response = await withRetry(() =>
			ai.models.generateContent({
				model: env.rag.generationModel,
				contents: prompt,
				config: { systemInstruction },
			}),
		);
		return response.text?.trim() ?? '';
	},
};

function client(): GoogleGenAI {
	if (!env.geminiApiKey) {
		throw new AppError(503, 'GEMINI_AUTH_ERROR', 'The Gemini API key is missing. Ask an administrator to configure the backend.');
	}
	return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (!isRateLimit(error)) {
			if (isCredentialError(error)) {
				throw new AppError(
					503,
					'GEMINI_AUTH_ERROR',
					'The Gemini API key is invalid, expired, or unavailable. Ask an administrator to check the backend configuration.',
				);
			}
			throw error;
		}
		await delay(750);
		return operation();
	}
}

function isCredentialError(error: unknown): boolean {
	const value = error as { status?: unknown; message?: unknown } | null;
	const status = typeof value?.status === 'number' ? value.status : 0;
	const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';
	return status === 401 || status === 403 || /api.?key|credential|unauthorized|permission denied/.test(message);
}

function isRateLimit(error: unknown): boolean {
	if (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 429) {
		return true;
	}
	const message = error instanceof Error ? error.message : '';
	return message.includes('429') || message.toLowerCase().includes('resource exhausted');
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
