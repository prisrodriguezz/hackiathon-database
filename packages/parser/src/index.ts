export interface ParsedDocument {
  text: string;
  pageCount?: number;
}

export async function extractText(_pdf: Uint8Array): Promise<ParsedDocument> {
  throw new Error("PDF parser is not configured yet");
}
