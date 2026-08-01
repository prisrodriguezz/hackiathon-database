import type { LLMProvider } from '@legislative/ai';
import type { ParseResult } from '@legislative/shared';

export interface DocumentReader {
  extractText(input: Uint8Array): Promise<string>;
}

export interface OcrEngine {
  toMarkdown(pages: Uint8Array[]): Promise<string>;
}

export class PdfTextReader implements DocumentReader {
  async extractText(input: Uint8Array): Promise<string> {
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(Buffer.from(input));
    return data.text;
  }
}

export interface ParserOptions {
  reader?: DocumentReader;
  ocr?: OcrEngine;
}

const DEFAULT_SYSTEM = [
  'Eres un asistente especializado en análisis legislativo.',
  'Convierte el texto provisto a Markdown estructurado preservando títulos, artículos y secciones.',
].join(' ');

export async function parseDocument(
  input: Uint8Array,
  provider: LLMProvider,
  options: ParserOptions = {},
): Promise<ParseResult> {
  const reader = options.reader ?? new PdfTextReader();
  const text = await reader.extractText(input);

  const markdown =
    options.ocr && text.trim().length === 0
      ? await options.ocr.toMarkdown([input])
      : await provider.complete(DEFAULT_SYSTEM, text);

  return {
    document: {
      id: crypto.randomUUID(),
      title: 'Documento sin título',
      status: 'parsed',
      createdAt: new Date().toISOString(),
    },
    markdown,
    pages: 0,
  };
}
