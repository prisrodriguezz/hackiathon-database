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
  provider?: string;
  model?: string;
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

export type AIProviderStatusName = "not_configured" | "simulated" | "configured" | "connection_failed" | "invalid_configuration";

export interface AIProviderStatus {
  status: AIProviderStatusName;
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKeyMasked?: string;
  updatedAt?: string;
  lastError?: string;
}

export type MistralOCRStatus = AIProviderStatus;

export interface AIProviderInput {
  baseUrl: string;
  apiKey: string;
  model: string;
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
  getAIProvider(): Promise<{ provider: AIProviderStatus; ocr: MistralOCRStatus }> {
    return request("/ai/provider");
  },
  testAIProvider(input: AIProviderInput): Promise<{ test: { ok: true; model: string; latencyMs: number } }> {
    return request("/ai/provider/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  saveAIProvider(input: AIProviderInput): Promise<{ provider: AIProviderStatus & { test: { ok: true; model: string; latencyMs: number } } }> {
    return request("/ai/provider", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  useSimulatedAI(): Promise<{ provider: AIProviderStatus }> {
    return request("/ai/provider/simulated", { method: "POST" });
  },
  removeAIProvider(): Promise<{ provider: AIProviderStatus }> {
    return request("/ai/provider", { method: "DELETE" });
  },
  getMistralOCR(): Promise<{ ocr: MistralOCRStatus }> {
    return request("/ai/ocr");
  },
  testMistralOCR(input: AIProviderInput): Promise<{ test: { ok: true; model: string; latencyMs: number } }> {
    return request("/ai/ocr/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  saveMistralOCR(input: AIProviderInput): Promise<{ ocr: MistralOCRStatus }> {
    return request("/ai/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  removeMistralOCR(): Promise<{ ocr: MistralOCRStatus }> {
    return request("/ai/ocr", { method: "DELETE" });
  },
};

export function validateAIProviderInput(input: AIProviderInput): string | undefined {
  if (!input.baseUrl.trim() || !input.apiKey.trim() || !input.model.trim()) {
    return "Completa la URL base, la API key y el modelo.";
  }
  if (/\s/.test(input.baseUrl)) return "La URL base no puede contener espacios.";
  let url: URL;
  try {
    url = new URL(input.baseUrl.trim());
  } catch {
    return "La URL base no es válida.";
  }
  const local = ["localhost", "localhost.localdomain", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (!['http:', 'https:'].includes(url.protocol)) return "La URL debe usar HTTP o HTTPS.";
  if (!local && url.protocol !== "https:") return "Usa HTTPS fuera de un proveedor local.";
  if (url.username || url.password || url.search || url.hash) return "La URL no puede incluir credenciales ni parámetros.";
  if (/\/chat\/completions\/?$/i.test(url.pathname)) return "Usa la URL base, no la ruta de chat completions.";
  if (/\/ocr\/?$/i.test(url.pathname)) return "Usa la URL base de Mistral, no la ruta /ocr.";
  return undefined;
}

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
