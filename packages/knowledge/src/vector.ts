import { QdrantClient } from '@qdrant/js-client-rest';

let client: QdrantClient | undefined;

export function getVectorStore(): QdrantClient {
  if (client) return client;
  client = new QdrantClient({
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  });
  return client;
}
