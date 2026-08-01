import type { LegislativeDocument } from '@legislative/shared';

export interface ApiClientOptions {
  baseUrl?: string;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.API_BASE_URL ?? 'http://localhost:3000';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw new Error(`La API respondió ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  getExampleDocument(): Promise<{ data: LegislativeDocument }> {
    return this.request('/api/example');
  }
}

export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
