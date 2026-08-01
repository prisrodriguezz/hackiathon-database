import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeLaw } from "@law-analyzer/ai";
import {
  getAIProviderStatus,
  getMistralOCRStatus,
  removeAIProvider,
  removeMistralOCR,
  saveAIProvider,
  saveMistralOCR,
  testAIProvider,
  testMistralOCR,
} from "../src/ai-provider.js";

describe("AI provider session configuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    removeAIProvider();
    removeMistralOCR();
  });

  it("tests and activates an OpenAI-compatible provider without returning its key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testAIProvider({
      baseUrl: "http://localhost:3418/v1",
      apiKey: "test-secret-key",
      model: "test-model",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3418/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test-secret-key" }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("test-secret-key");

    const saved = await saveAIProvider({
      baseUrl: "http://localhost:3418/v1",
      apiKey: "test-secret-key",
      model: "test-model",
    });
    expect(saved.apiKeyMasked).toBe("****-key");
    expect(JSON.stringify(saved)).not.toContain("test-secret-key");
  });

  it("returns to simulated mode when credentials are removed", () => {
    expect(removeAIProvider()).toEqual({ status: "simulated" });
    expect(getAIProviderStatus()).toEqual({ status: "simulated" });
  });

  it("tests and activates Mistral OCR without returning its key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ pages: [{ index: 0, markdown: "Articulo 1" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      baseUrl: "http://localhost:3418/v1",
      apiKey: "mistral-secret-key",
      model: "mistral-ocr-latest",
    };
    expect((await testMistralOCR(input)).model).toBe("mistral-ocr-latest");
    fetchMock.mockClear();
    const saved = await saveMistralOCR(input);
    expect(saved.apiKeyMasked).toBe("****-key");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getMistralOCRStatus().status).toBe("configured");
    expect(JSON.stringify(saved)).not.toContain("mistral-secret-key");
  });

  it("accepts JSON wrapped in reasoning and Markdown fences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '<think>Preparando el resultado</think>```json\n{"summary":"OK","affectedAreas":[],"findings":[]}\n```',
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await analyzeLaw("Texto de prueba", {
      config: {
        provider: "test",
        baseUrl: "http://localhost:3418/v1",
        apiKey: "test-key",
        model: "test-model",
        simulated: false,
        maxRetries: 0,
      },
    });

    expect(result.summary).toBe("OK");
  });

  it("reports when the provider truncates the JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: '{"summary":"incompleto"' },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      analyzeLaw("Texto de prueba", {
        config: {
          provider: "test",
          baseUrl: "http://localhost:3418/v1",
          apiKey: "test-key",
          model: "test-model",
          simulated: false,
          maxRetries: 0,
        },
      }),
    ).rejects.toThrow("respuesta del proveedor fue truncada");
  });
});
