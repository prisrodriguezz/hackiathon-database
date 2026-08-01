import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdir } from "node:fs/promises";
import { openDatabase, type SqliteDatabase } from "@law-analyzer/database";
import {
  answerConversation,
  getAnalysis,
  getConversation,
  getDocument,
  listAgentRuns,
  newConversation,
  processDocument,
  queueAnalysis,
  storeUpload,
} from "./services.js";
import {
  AIProviderError,
  getAIProviderStatus,
  getMistralOCRStatus,
  removeAIProvider,
  removeMistralOCR,
  saveAIProvider,
  saveMistralOCR,
  testAIProvider,
  testMistralOCR,
  useSimulatedAI,
} from "./ai-provider.js";

const port = Number(process.env.API_PORT ?? 3000);
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const storageDirectory = process.env.STORAGE_PATH ?? "./storage";
const database: SqliteDatabase = openDatabase(
  process.env.DATABASE_URL ?? "sqlite:./storage/law-analyzer.db",
);
const maxRequestBytes = maxUploadBytes + 1024 * 1024;

interface MultipartPart {
  name: string;
  fileName?: string;
  mimeType: string;
  data: Uint8Array;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function errorResponse(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  send(response, status, { error: { code, message } });
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxRequestBytes)
      throw new Error("El cuerpo de la solicitud supera el limite permitido");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(body: Buffer, contentType: string): MultipartPart[] {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2])?.trim();
  if (!boundary) throw new Error("Falta el boundary del formulario multipart");
  const marker = Buffer.from(`--${boundary}`);
  const parts: MultipartPart[] = [];
  let cursor = body.indexOf(marker);
  while (cursor >= 0) {
    const headerStart = cursor + marker.length + 2;
    if (
      body
        .subarray(cursor + marker.length, cursor + marker.length + 2)
        .equals(Buffer.from("--"))
    )
      break;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) break;
    const next = body.indexOf(marker, headerEnd + 4);
    if (next < 0) break;
    const headers = body.subarray(headerStart, headerEnd).toString("utf8");
    const disposition = /content-disposition:\s*[\s\S]*?name="([^"]+)"/i.exec(
      headers,
    );
    const fileName = /filename="([^"]*)"/i.exec(headers)?.[1];
    if (disposition) {
      const contentTypeMatch = /content-type:\s*([^\r\n]+)/i.exec(headers);
      parts.push({
        name: disposition[1]!,
        fileName,
        mimeType: contentTypeMatch?.[1]?.trim() ?? "text/plain",
        data: body.subarray(headerEnd + 4, next - 2),
      });
    }
    cursor = next;
  }
  return parts;
}

function parseJson(body: Buffer): Record<string, unknown> {
  if (!body.length) return {};
  const value: unknown = JSON.parse(body.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El cuerpo JSON debe ser un objeto");
  return value as Record<string, unknown>;
}

function publicDocument(document: ReturnType<typeof getDocument>): unknown {
  if (!document) return undefined;
  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    originalFileName: document.fileName,
    status: document.status,
    textOrigin: document.textOrigin,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function pathParts(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    });
    response.end();
    return;
  }
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  const parts = pathParts(url.pathname);
  if (request.method === "GET" && url.pathname === "/health") {
    send(response, 200, { name: "law-analyzer-api", status: "ok" });
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "provider"
  ) {
    send(response, 200, {
      provider: getAIProviderStatus(),
      ocr: getMistralOCRStatus(),
    });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 3 &&
    parts[0] === "ai" &&
    parts[1] === "provider" &&
    parts[2] === "test"
  ) {
    const body = parseJson(await readBody(request));
    send(response, 200, { test: await testAIProvider(readAIProviderInput(body)) });
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "ocr"
  ) {
    send(response, 200, { ocr: getMistralOCRStatus() });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 3 &&
    parts[0] === "ai" &&
    parts[1] === "ocr" &&
    parts[2] === "test"
  ) {
    const body = parseJson(await readBody(request));
    send(response, 200, { test: await testMistralOCR(readAIProviderInput(body)) });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "ocr"
  ) {
    const body = parseJson(await readBody(request));
    send(response, 200, {
      ocr: await saveMistralOCR(readAIProviderInput(body)),
    });
    return;
  }
  if (
    request.method === "DELETE" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "ocr"
  ) {
    send(response, 200, { ocr: removeMistralOCR() });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "provider"
  ) {
    const body = parseJson(await readBody(request));
    send(response, 200, {
      provider: await saveAIProvider(readAIProviderInput(body)),
    });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 3 &&
    parts[0] === "ai" &&
    parts[1] === "provider" &&
    parts[2] === "simulated"
  ) {
    send(response, 200, { provider: useSimulatedAI() });
    return;
  }
  if (
    request.method === "DELETE" &&
    parts.length === 2 &&
    parts[0] === "ai" &&
    parts[1] === "provider"
  ) {
    send(response, 200, { provider: removeAIProvider() });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 1 &&
    parts[0] === "documents"
  ) {
    const contentType = request.headers["content-type"] ?? "";
    const body = await readBody(request);
    const multipart = contentType
      .toLowerCase()
      .startsWith("multipart/form-data");
    if (!multipart)
      throw new Error("La carga del documento debe usar multipart/form-data");
    const fields = parseMultipart(body, contentType);
    const file = fields.find((part) => part.name === "file" && part.fileName);
    if (!file?.fileName)
      throw new Error("El formulario debe incluir el campo file");
    const value = (name: string): string | undefined => {
      const field = fields.find((part) => part.name === name);
      return field ? new TextDecoder().decode(field.data) : undefined;
    };
    const stored = await storeUpload(
      database,
      storageDirectory,
      {
        bytes: file.data,
        fileName: file.fileName,
        mimeType: file.mimeType,
        title: value("title"),
        documentType: value("documentType") as
          "national_law" | "provincial_law" | "bill" | undefined,
        uploadedBy: value("uploadedBy"),
      },
      maxUploadBytes,
    );
    setTimeout(
      () => void processDocument(database, stored.taskId, stored.document.id),
      0,
    );
    send(response, 202, {
      document: publicDocument(stored.document),
      taskId: stored.taskId,
    });
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 2 &&
    parts[0] === "documents"
  ) {
    const document = getDocument(database, parts[1]!);
    if (!document)
      return errorResponse(
        response,
        404,
        "DOCUMENT_NOT_FOUND",
        "Documento inexistente",
      );
    send(response, 200, { document: publicDocument(document) });
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 3 &&
    parts[0] === "documents" &&
    parts[2] === "status"
  ) {
    const document = getDocument(database, parts[1]!);
    if (!document)
      return errorResponse(
        response,
        404,
        "DOCUMENT_NOT_FOUND",
        "Documento inexistente",
      );
    send(response, 200, {
      id: document.id,
      status: document.status,
      updatedAt: document.updatedAt,
    });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 3 &&
    parts[0] === "documents" &&
    parts[2] === "analyses"
  ) {
    const document = getDocument(database, parts[1]!);
    if (!document)
      return errorResponse(
        response,
        404,
        "DOCUMENT_NOT_FOUND",
        "Documento inexistente",
      );
    const body = parseJson(await readBody(request));
    const goal =
      typeof body.goal === "string" ? body.goal.slice(0, 2000) : undefined;
    const analysis = queueAnalysis(database, document.id, goal);
    send(response, 202, { analysisId: analysis.id, status: "queued" });
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 2 &&
    parts[0] === "analyses"
  ) {
    const analysis = getAnalysis(database, parts[1]!);
    if (!analysis)
      return errorResponse(
        response,
        404,
        "ANALYSIS_NOT_FOUND",
        "Analisis inexistente",
      );
    send(response, 200, {
      analysis,
      agentRuns: listAgentRuns(database, analysis.id),
    });
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 3 &&
    parts[0] === "documents" &&
    parts[2] === "conversations"
  ) {
    const document = getDocument(database, parts[1]!);
    if (!document)
      return errorResponse(
        response,
        404,
        "DOCUMENT_NOT_FOUND",
        "Documento inexistente",
      );
    send(response, 201, newConversation(database, document.id));
    return;
  }
  if (
    request.method === "GET" &&
    parts.length === 2 &&
    parts[0] === "conversations"
  ) {
    const conversation = getConversation(database, parts[1]!);
    if (!conversation)
      return errorResponse(
        response,
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversacion inexistente",
      );
    send(response, 200, conversation);
    return;
  }
  if (
    request.method === "POST" &&
    parts.length === 2 &&
    parts[0] === "conversations"
  ) {
    const body = parseJson(await readBody(request));
    if (typeof body.content !== "string" || !body.content.trim())
      throw new Error("El campo content es obligatorio");
    const result = await answerConversation(
      database,
      parts[1]!,
      body.content.slice(0, 10000),
    );
    send(response, 200, result);
    return;
  }
  errorResponse(response, 404, "NOT_FOUND", "Ruta inexistente");
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    if (error instanceof AIProviderError) {
      errorResponse(response, error.status, error.code, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Error interno";
    const status = /PDF|archivo|MIME|cuerpo|limite|boundary|file/.test(message)
      ? 400
      : 500;
    errorResponse(
      response,
      status,
      status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      message,
    );
  });
});

await mkdir(storageDirectory, { recursive: true });

function readAIProviderInput(body: Record<string, unknown>): {
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  return {
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : "",
    apiKey: typeof body.apiKey === "string" ? body.apiKey : "",
    model: typeof body.model === "string" ? body.model : "",
  };
}

server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
