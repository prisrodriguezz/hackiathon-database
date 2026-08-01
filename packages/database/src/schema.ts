export interface LawDocumentRecord {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  extractedText?: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  createdAt: Date;
}

export interface LawAnalysisRecord {
  id: string;
  documentId: string;
  summary: string;
  createdAt: Date;
}
