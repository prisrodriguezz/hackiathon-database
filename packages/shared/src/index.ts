export type LawDocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export type LawRelationType =
  | "related"
  | "contradicts"
  | "affects"
  | "replaces";

export interface LawDocument {
  id: string;
  title: string;
  originalFileName: string;
  status: LawDocumentStatus;
}

export interface LawRelation {
  lawId: string;
  type: LawRelationType;
  explanation: string;
  confidence: number;
}
