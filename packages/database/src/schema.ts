export type DocumentType = "national_law" | "provincial_law" | "bill";

export type DocumentStatus =
  "uploaded" | "processing" | "ready" | "failed" | "pending_review";

export type TextOrigin = "official" | "extracted" | "ocr";

export type NodeType =
  | "national_law"
  | "provincial_law"
  | "bill"
  | "article"
  | "concept"
  | "jurisdiction"
  | "organization"
  | "source";

export type RelationType =
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

export type RelationProvenance = "verified" | "suggested";

export type AnalysisStatus = "queued" | "running" | "completed" | "failed";

export interface LawDocumentRecord {
  id: string;
  title: string;
  documentType: DocumentType;
  jurisdictionId?: string;
  fileName: string;
  filePath: string;
  officialIdentifier?: string;
  status: DocumentStatus;
  textOrigin?: TextOrigin;
  version: number;
  versionOfId?: string;
  sourceId?: string;
  importBatchId?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  consultedAt?: Date;
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFragmentRecord {
  id: string;
  documentId: string;
  text: string;
  pageNumber?: number;
  sectionLabel?: string;
  articleNumber?: string;
  positionStart?: number;
  positionEnd?: number;
  textOrigin: TextOrigin;
  createdAt: Date;
}

export interface LawNodeRecord {
  id: string;
  nodeType: NodeType;
  name: string;
  description?: string;
  jurisdictionId?: string;
  officialIdentifier?: string;
  sourceId?: string;
  validationStatus: "pending" | "verified" | "rejected";
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LawEdgeRecord {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  explanation?: string;
  sourceId?: string;
  confidence: number;
  provenance: RelationProvenance;
  analysisVersion?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
}

export interface LawAnalysisRecord {
  id: string;
  documentId: string;
  status: AnalysisStatus;
  summary?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
