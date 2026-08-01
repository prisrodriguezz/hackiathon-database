import type { AnalysisReport, LawDocumentStatus, LawFinding } from "@law-analyzer/shared";

export interface ApiDocument {
  id: string;
  title: string;
  documentType: "national_law" | "provincial_law" | "bill";
  originalFileName: string;
  status: LawDocumentStatus;
  textOrigin?: "official" | "extracted" | "ocr";
  createdAt: string;
  updatedAt: string;
}

export interface ApiAnalysis {
  id: string;
  documentId: string;
  status: "queued" | "running" | "completed" | "failed";
  summary?: string;
  result?: AnalysisReport;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
  fragmentIds: string[];
  nodeIds: string[];
}

export interface Conversation {
  id: string;
  documentId?: string;
  createdAt: string;
  messages: ConversationMessage[];
}

export interface ChatResponse {
  messageId: string;
  content: string;
  fragmentIds: string[];
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;
  if (!response.ok) throw new Error(body.error?.message ?? "No se pudo completar la solicitud");
  return body as T;
}

export const api = {
  uploadDocument(file: File, title: string, documentType: ApiDocument["documentType"]): Promise<{ document: ApiDocument; taskId: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("documentType", documentType);
    return request("/documents", { method: "POST", body: form });
  },
  getDocument(id: string): Promise<{ document: ApiDocument }> {
    return request(`/documents/${encodeURIComponent(id)}`);
  },
  getDocumentStatus(id: string): Promise<Pick<ApiDocument, "id" | "status" | "updatedAt">> {
    return request(`/documents/${encodeURIComponent(id)}/status`);
  },
  queueAnalysis(documentId: string): Promise<{ analysisId: string; status: string }> {
    return request(`/documents/${encodeURIComponent(documentId)}/analyses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "Identificar relaciones, contradicciones, impactos y normas relacionadas" }),
    });
  },
  getAnalysis(id: string): Promise<{ analysis: ApiAnalysis }> {
    return request(`/analyses/${encodeURIComponent(id)}`);
  },
  createConversation(documentId: string): Promise<{ id: string }> {
    return request(`/documents/${encodeURIComponent(documentId)}/conversations`, { method: "POST" });
  },
  getConversation(id: string): Promise<Conversation> {
    return request(`/conversations/${encodeURIComponent(id)}`);
  },
  sendMessage(id: string, content: string): Promise<ChatResponse> {
    return request(`/conversations/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  },
};

export function validatePdf(file: File, maxBytes = 10 * 1024 * 1024): string | undefined {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Selecciona un archivo con extensión .pdf.";
  if (file.size > maxBytes) return "El archivo pesa más de 10 MB. Elige un PDF más liviano.";
  if (file.type && !["application/pdf", "application/octet-stream"].includes(file.type)) {
    return "El archivo no parece ser un PDF válido.";
  }
  return undefined;
}

export async function validatePdfSignature(file: File): Promise<string | undefined> {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(bytes) !== "%PDF-") return "El archivo no contiene una firma PDF válida.";
  return undefined;
}

export const relationLabels: Record<LawFinding["type"], string> = {
  relacionada_con: "Relacionada",
  contradice: "Posible contradicción",
  modifica: "Modifica",
  deroga: "Deroga",
  reglamenta: "Reglamenta",
  afecta: "Afecta",
  aplica_en: "Ámbito de aplicación",
  pertenece_a: "Pertenece a",
  menciona: "Menciona",
  reemplaza: "Reemplaza",
  depende_de: "Depende de",
};
