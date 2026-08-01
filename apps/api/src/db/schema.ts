import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const legislativeDocuments = pgTable('legislative_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  content: text('content'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type LegislativeDocumentRow = typeof legislativeDocuments.$inferSelect;
