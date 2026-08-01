import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  getAIConfig,
  getMistralOCRConfig,
  MistralOCRClient,
  normalizeAIProviderInput,
  OpenAICompatibleClient,
  isLocalProviderHost,
  type AIConfig,
  type MistralOCRConfig,
  type AIProviderInput,
} from "@law-analyzer/ai";

export type AIProviderStatus =
  | "not_configured"
  | "simulated"
  | "configured"
  | "connection_failed"
  | "invalid_configuration";

export class AIProviderError extends Error {
  constructor(
    readonly code: "INVALID_CONFIGURATION" | "CONNECTION_FAILED" | "AUTHENTICATION_FAILED" | "MODEL_UNAVAILABLE",
    message: string,
    readonly status = code === "INVALID_CONFIGURATION" ? 422 : 502,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface PublicAIProviderStatus {
  status: AIProviderStatus;
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKeyMasked?: string;
  updatedAt?: string;
  lastError?: string;
}

export interface PublicMistralOCRStatus {
  status: AIProviderStatus;
  provider?: "mistral-ocr";
  baseUrl?: string;
  model?: string;
  apiKeyMasked?: string;
  updatedAt?: string;
  lastError?: string;
}

export interface AIProviderTestResult {
  ok: true;
  model: string;
  latencyMs: number;
}

const environmentConfig = getAIConfig();
let activeConfig: AIConfig = environmentConfig.apiKey && !environmentConfig.simulated
  ? environmentConfig
  : {
      ...environmentConfig,
      provider: "simulated",
      baseUrl: "",
      apiKey: undefined,
      model: "simulated-law-analyzer",
      simulated: true,
    };
let activeStatus: AIProviderStatus = activeConfig.simulated
  ? "simulated"
  : "configured";
let updatedAt = activeConfig.simulated ? undefined : new Date().toISOString();
let lastError: string | undefined;
let activeOCRConfig: MistralOCRConfig | undefined = getMistralOCRConfig();
let activeOCRStatus: AIProviderStatus = activeOCRConfig
  ? "configured"
  : "not_configured";
let ocrUpdatedAt = activeOCRConfig ? new Date().toISOString() : undefined;
let ocrLastError: string | undefined;

function providerName(config: AIConfig): string {
  if (config.provider && config.provider !== "simulated") return config.provider;
  try {
    return new URL(config.baseUrl).hostname;
  } catch {
    return "OpenAI-compatible";
  }
}

function maskedKey(apiKey?: string): string | undefined {
  if (!apiKey) return undefined;
  return `****${apiKey.slice(-4)}`;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part)))
    return false;
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

async function assertSafeDestination(baseUrl: string): Promise<void> {
  const url = new URL(baseUrl);
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".internal")
  ) {
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      "La URL del proveedor apunta a un destino interno no permitido",
    );
  }
  if (isLocalProviderHost(hostname)) return;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      "La URL del proveedor apunta a una red privada no permitida",
    );
  }
}

function candidateConfig(input: AIProviderInput): AIConfig {
  const normalized = normalizeAIProviderInput(input);
  return {
    ...getAIConfig(),
    provider: new URL(normalized.baseUrl).hostname,
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    simulated: false,
  };
}

function classifyConnectionError(error: unknown): AIProviderError {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("La API key")) {
    return new AIProviderError(
      "AUTHENTICATION_FAILED",
      "La API key del proveedor no es valida. Revisa las credenciales.",
    );
  }
  if (message.startsWith("El modelo")) {
    return new AIProviderError(
      "MODEL_UNAVAILABLE",
      "El modelo no esta disponible en el proveedor indicado.",
    );
  }
  return new AIProviderError(
    "CONNECTION_FAILED",
    message.startsWith("El proveedor") || message.startsWith("No se pudo")
      ? message
      : "No se pudo acceder al proveedor de IA. Revisa la URL y su disponibilidad.",
  );
}

function classifyOCRError(error: unknown): AIProviderError {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("La API key")) {
    return new AIProviderError(
      "AUTHENTICATION_FAILED",
      "La API key de Mistral OCR no es valida. Revisa las credenciales.",
    );
  }
  if (message.startsWith("El modelo")) {
    return new AIProviderError(
      "MODEL_UNAVAILABLE",
      "El modelo de Mistral OCR no esta disponible.",
    );
  }
  return new AIProviderError(
    "CONNECTION_FAILED",
    message.startsWith("Mistral OCR") || message.startsWith("No se pudo")
      ? message
      : "No se pudo acceder a Mistral OCR. Revisa la URL y su disponibilidad.",
  );
}

function candidateOCRConfig(input: AIProviderInput): MistralOCRConfig {
  const normalized = normalizeAIProviderInput(input);
  if (/\/ocr\/?$/i.test(new URL(normalized.baseUrl).pathname)) {
    throw new Error("Usa la URL base de Mistral, no la ruta /ocr");
  }
  const defaults = getMistralOCRConfig() ?? {
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    timeoutMs: getAIConfig().timeoutMs,
    maxRetries: getAIConfig().maxRetries,
  };
  return {
    ...defaults,
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
  };
}

export function getActiveAIConfig(): AIConfig {
  return { ...activeConfig };
}

export function getAIProviderStatus(): PublicAIProviderStatus {
  if (activeStatus === "simulated") return { status: "simulated" };
  if (activeStatus === "not_configured") return { status: activeStatus };
  return {
    status: activeStatus,
    provider: providerName(activeConfig),
    baseUrl: activeConfig.baseUrl,
    model: activeConfig.model,
    apiKeyMasked: maskedKey(activeConfig.apiKey),
    updatedAt,
    ...(lastError ? { lastError } : {}),
  };
}

export function getMistralOCRStatus(): PublicMistralOCRStatus {
  if (activeOCRStatus === "not_configured") return { status: activeOCRStatus };
  return {
    status: activeOCRStatus,
    provider: "mistral-ocr",
    baseUrl: activeOCRConfig?.baseUrl,
    model: activeOCRConfig?.model,
    apiKeyMasked: maskedKey(activeOCRConfig?.apiKey),
    updatedAt: ocrUpdatedAt,
    ...(ocrLastError ? { lastError: ocrLastError } : {}),
  };
}

export function getActiveMistralOCRConfig(): MistralOCRConfig | undefined {
  return activeOCRConfig ? { ...activeOCRConfig } : undefined;
}

export async function testAIProvider(
  input: AIProviderInput,
): Promise<AIProviderTestResult> {
  let config: AIConfig;
  try {
    config = candidateConfig(input);
  } catch (error) {
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      error instanceof Error ? error.message : "La configuracion del proveedor no es valida",
    );
  }
  try {
    await assertSafeDestination(config.baseUrl);
    return { ok: true, ...(await new OpenAICompatibleClient(config).testConnection()) };
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw classifyConnectionError(error);
  }
}

export async function saveAIProvider(
  input: AIProviderInput,
): Promise<PublicAIProviderStatus & { test: AIProviderTestResult }> {
  let config: AIConfig;
  try {
    config = candidateConfig(input);
  } catch (error) {
    activeStatus = "invalid_configuration";
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      error instanceof Error ? error.message : "La configuracion del proveedor no es valida",
    );
  }
  const test = await testAIProvider(input);
  activeConfig = config;
  activeStatus = "configured";
  updatedAt = new Date().toISOString();
  lastError = undefined;
  return { ...getAIProviderStatus(), test };
}

export async function testMistralOCR(
  input: AIProviderInput,
): Promise<AIProviderTestResult> {
  let config: MistralOCRConfig;
  try {
    config = candidateOCRConfig(input);
  } catch (error) {
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      error instanceof Error ? error.message : "La configuracion de Mistral OCR no es valida",
    );
  }
  try {
    await assertSafeDestination(config.baseUrl);
    return { ok: true, ...(await new MistralOCRClient(config).testConnection()) };
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw classifyOCRError(error);
  }
}

export async function saveMistralOCR(
  input: AIProviderInput,
): Promise<PublicMistralOCRStatus> {
  let config: MistralOCRConfig;
  try {
    config = candidateOCRConfig(input);
  } catch (error) {
    activeOCRStatus = "invalid_configuration";
    throw new AIProviderError(
      "INVALID_CONFIGURATION",
      error instanceof Error ? error.message : "La configuracion de Mistral OCR no es valida",
    );
  }
  activeOCRConfig = config;
  activeOCRStatus = "configured";
  ocrUpdatedAt = new Date().toISOString();
  ocrLastError = undefined;
  return getMistralOCRStatus();
}

export function removeMistralOCR(): PublicMistralOCRStatus {
  activeOCRConfig = undefined;
  activeOCRStatus = "not_configured";
  ocrUpdatedAt = undefined;
  ocrLastError = undefined;
  return getMistralOCRStatus();
}

export function useSimulatedAI(): PublicAIProviderStatus {
  activeConfig = {
    ...getAIConfig(),
    provider: "simulated",
    baseUrl: "",
    apiKey: undefined,
    model: "simulated-law-analyzer",
    simulated: true,
  };
  activeStatus = "simulated";
  updatedAt = undefined;
  lastError = undefined;
  return getAIProviderStatus();
}

export function removeAIProvider(): PublicAIProviderStatus {
  return useSimulatedAI();
}
