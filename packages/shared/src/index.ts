export type LawDocumentStatus =
  "uploaded" | "processing" | "ready" | "failed" | "pending_review";

export type LawRelationType =
  | "relacionada_con"
  | "contradice"
  | "modifica"
  | "deroga"
  | "reglamenta"
  | "afecta"
  | "aplica_en"
  | "pertenece_a"
  | "menciona"
  | "reemplaza"
  | "depende_de";

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

export interface LawFinding extends LawRelation {
  sourceFragmentIds: string[];
  affectedAreas: string[];
  limitations: string[];
}

export interface AnalysisReport {
  summary: string;
  findings: LawFinding[];
  affectedAreas: string[];
  model?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
