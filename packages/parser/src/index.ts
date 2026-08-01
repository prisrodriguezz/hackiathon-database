export interface ParsedDocument {
  text: string;
  pageCount: number;
  pages: ParsedPage[];
  hasText: boolean;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
  sectionLabel?: string;
  articleNumber?: string;
}

export interface PdfValidationOptions {
  maxBytes?: number;
}

export interface TextExtractionOptions {
  ocr?: (pdf: Uint8Array) => Promise<ParsedDocument>;
}

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfValidationError";
  }
}

function sourceText(pdf: Uint8Array): string {
  return new TextDecoder("latin1").decode(pdf);
}

function decodePdfString(value: string): string {
  if (value.startsWith("<") && value.endsWith(">")) {
    const hex = value.slice(1, -1).replace(/\s/g, "");
    const bytes = new Uint8Array(
      hex
        .match(/.{1,2}/g)
        ?.map((pair) => Number.parseInt(pair.padEnd(2, "0"), 16)) ?? [],
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  let result = value.slice(1, -1);
  result = result.replace(/\\([\\()])/g, "$1");
  result = result
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
  result = result.replace(/\\([0-7]{1,3})/g, (_match, octal: string) =>
    String.fromCharCode(Number.parseInt(octal, 8)),
  );
  return result;
}

function extractPdfText(pdf: string): string {
  const chunks: string[] = [];
  const textOperators =
    /(?:\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>)\s*Tj|\[(.*?)\]\s*TJ/gms;
  let match: RegExpExecArray | null;
  while ((match = textOperators.exec(pdf)) !== null) {
    if (match[1] !== undefined) {
      const arrayItems =
        match[1].match(/\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>/g) ?? [];
      chunks.push(arrayItems.map(decodePdfString).join(""));
    } else {
      const operator = match[0].replace(/\s*Tj\s*$/s, "").trim();
      chunks.push(decodePdfString(operator));
    }
  }
  return chunks
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function validatePdf(
  pdf: Uint8Array,
  options: PdfValidationOptions = {},
): void {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  if (pdf.byteLength === 0)
    throw new PdfValidationError("El archivo esta vacio");
  if (pdf.byteLength > maxBytes)
    throw new PdfValidationError(
      `El PDF supera el limite de ${maxBytes} bytes`,
    );
  if (!sourceText(pdf.slice(0, 8)).startsWith("%PDF-")) {
    throw new PdfValidationError("El archivo no tiene una cabecera PDF valida");
  }
  const tail = sourceText(pdf.slice(Math.max(0, pdf.byteLength - 2048)));
  if (!/%%EOF\s*$/s.test(tail.trim()))
    throw new PdfValidationError("El PDF parece estar incompleto: falta %%EOF");
}

function getPageCount(pdf: string): number {
  return Math.max(1, (pdf.match(/\/Type\s*\/Page\b/g) ?? []).length);
}

export async function extractText(
  pdf: Uint8Array,
  options: TextExtractionOptions = {},
): Promise<ParsedDocument> {
  validatePdf(pdf);
  const source = sourceText(pdf);
  const text = extractPdfText(source);
  const pageCount = getPageCount(source);
  const pageTexts = text.split("\f");
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    pageNumber: index + 1,
    text: pageTexts[index] ?? "",
  }));
  if (pages.every((page) => page.text.length === 0) && text.length > 0)
    pages[0]!.text = text;
  if (text.length === 0 && options.ocr) return options.ocr(pdf);
  return { text, pageCount, pages, hasText: text.length > 0 };
}

export function splitIntoFragments(
  document: ParsedDocument,
  maxCharacters = 1600,
): Array<ParsedPage & { positionStart: number; positionEnd: number }> {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1)
    throw new Error("maxCharacters must be a positive integer");
  const fragments: Array<
    ParsedPage & { positionStart: number; positionEnd: number }
  > = [];
  let position = 0;
  for (const page of document.pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > maxCharacters) {
        fragments.push({
          ...page,
          text: current,
          positionStart: position,
          positionEnd: position + current.length,
        });
        position += current.length;
        current = word;
      } else current = candidate;
    }
    if (current) {
      fragments.push({
        ...page,
        text: current,
        positionStart: position,
        positionEnd: position + current.length,
      });
      position += current.length;
    }
  }
  return fragments;
}
