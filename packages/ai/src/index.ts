import OpenAI from 'openai';

export interface LLMProvider {
  complete(system: string, prompt: string): Promise<string>;
}

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class OpenAIProvider implements LLMProvider {
  private readonly config: OpenAIProviderConfig;
  private readonly model: string;
  private client: OpenAI | undefined;

  constructor(config: OpenAIProviderConfig = {}) {
    this.config = config;
    this.model = config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está configurado.');
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: this.config.baseURL ?? process.env.OPENAI_BASE_URL,
      });
    }
    return this.client;
  }

  async complete(system: string, prompt: string): Promise<string> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

export function createLLMProvider(config?: OpenAIProviderConfig): LLMProvider {
  return new OpenAIProvider(config);
}
