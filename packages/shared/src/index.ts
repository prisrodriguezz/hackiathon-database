export type DocumentStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

export interface LegislativeDocument {
  id: string;
  title: string;
  status: DocumentStatus;
  sourceUrl?: string;
  content?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ParseResult {
  document: LegislativeDocument;
  markdown: string;
  pages: number;
}

export function statusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    pending: 'Pendiente',
    parsing: 'Procesando',
    parsed: 'Procesado',
    failed: 'Fallido',
  };
  return labels[status];
}
