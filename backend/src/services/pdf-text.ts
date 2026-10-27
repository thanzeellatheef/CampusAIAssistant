import { extractText } from 'unpdf';

export type PdfPage = {
	pageNumber: number;
	text: string;
};

export async function readPdfPages(bytes: Buffer): Promise<PdfPage[]> {
	const result = await extractText(new Uint8Array(bytes), { mergePages: false });
	const pages = Array.isArray(result.text) ? result.text : [result.text];
	return pages.map((text, index) => ({ pageNumber: index + 1, text: text ?? '' }));
}
