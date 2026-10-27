export function l2Normalize(values: number[]): number[] {
	let sum = 0;
	for (const value of values) {
		sum += value * value;
	}
	const norm = Math.sqrt(sum);
	if (norm === 0) {
		return values.map(() => 0);
	}
	return values.map((value) => value / norm);
}

export function cosineSimilarity(left: number[], right: number[]): number {
	if (left.length !== right.length) {
		return 0;
	}
	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index] ?? 0;
		const b = right[index] ?? 0;
		dot += a * b;
		leftNorm += a * a;
		rightNorm += b * b;
	}
	const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
	return denominator === 0 ? 0 : dot / denominator;
}

export function parseEmbedding(value: unknown, dimensions: number): number[] | null {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value) as unknown;
		} catch {
			return null;
		}
	}
	if (!Array.isArray(parsed) || parsed.length !== dimensions) {
		return null;
	}
	const numbers = parsed.map((item) => (typeof item === 'number' ? item : Number(item)));
	return numbers.some((item) => !Number.isFinite(item)) ? null : numbers;
}
