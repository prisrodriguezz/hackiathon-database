import { randomUUID } from "node:crypto";
import { withTransaction, type SqliteDatabase } from "./client.js";
import type {
  AnalysisStatus,
  DocumentFragmentRecord,
  DocumentStatus,
  DocumentType,
  LawAnalysisRecord,
  LawDocumentRecord,
  LawEdgeRecord,
  LawNodeRecord,
  NodeType,
  RelationProvenance,
  RelationType,
  TextOrigin,
} from "./schema.js";

type Row = Record<string, unknown>;

const now = (): string => new Date().toISOString();

const normalize = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function toDate(value: unknown): Date | undefined {
  return typeof value === "string" ? new Date(value) : undefined;
}

function documentFromRow(row: Row): LawDocumentRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    documentType: row.document_type as DocumentType,
    jurisdictionId: row.jurisdiction_id as string | undefined,
    fileName: String(row.original_file_name),
    filePath: String(row.file_path),
    officialIdentifier: row.official_identifier as string | undefined,
    status: row.status as DocumentStatus,
    textOrigin: row.text_origin as TextOrigin | undefined,
    version: Number(row.version),
    versionOfId: row.version_of_id as string | undefined,
    sourceId: row.source_id as string | undefined,
    importBatchId: row.import_batch_id as string | undefined,
    effectiveFrom: toDate(row.effective_from),
    effectiveTo: toDate(row.effective_to),
    consultedAt: toDate(row.consulted_at),
    uploadedBy: row.uploaded_by as string | undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function fragmentFromRow(row: Row): DocumentFragmentRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    text: String(row.text),
    pageNumber: row.page_number as number | undefined,
    sectionLabel: row.section_label as string | undefined,
    articleNumber: row.article_number as string | undefined,
    positionStart: row.position_start as number | undefined,
    positionEnd: row.position_end as number | undefined,
    textOrigin: row.text_origin as TextOrigin,
    createdAt: new Date(String(row.created_at)),
  };
}

function nodeFromRow(row: Row): LawNodeRecord {
  return {
    id: String(row.id),
    nodeType: row.node_type as NodeType,
    name: String(row.name),
    description: row.description as string | undefined,
    jurisdictionId: row.jurisdiction_id as string | undefined,
    officialIdentifier: row.official_identifier as string | undefined,
    sourceId: row.source_id as string | undefined,
    validationStatus:
      row.validation_status as LawNodeRecord["validationStatus"],
    createdBy: row.created_by as string | undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function analysisFromRow(row: Row): LawAnalysisRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    status: row.status as AnalysisStatus,
    summary: row.summary as string | undefined,
    model: row.model as string | undefined,
    durationMs: row.duration_ms === null ? undefined : Number(row.duration_ms),
    result: row.result_json ? JSON.parse(String(row.result_json)) : undefined,
    error: row.error as string | undefined,
    createdAt: new Date(String(row.created_at)),
    startedAt: toDate(row.started_at),
    completedAt: toDate(row.completed_at),
  };
}

export interface CreateDocumentInput {
  title: string;
  documentType: DocumentType;
  originalFileName: string;
  filePath: string;
  jurisdictionId?: string;
  officialIdentifier?: string;
  status?: DocumentStatus;
  textOrigin?: TextOrigin;
  version?: number;
  versionOfId?: string;
  sourceId?: string;
  importBatchId?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  consultedAt?: Date;
  uploadedBy?: string;
}

export function createSource(
  database: SqliteDatabase,
  input: {
    type:
      | "pdf"
      | "official_bulletin"
      | "official_publication"
      | "external_reference"
      | "import";
    title: string;
    url?: string;
    citation?: string;
    retrievedAt?: Date;
    checksum?: string;
  },
): string {
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO sources (id, source_type, title, url, citation, retrieved_at, checksum)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.type,
      input.title,
      input.url ?? null,
      input.citation ?? null,
      input.retrievedAt?.toISOString() ?? null,
      input.checksum ?? null,
    );
  return id;
}

export function createImportBatch(
  database: SqliteDatabase,
  input: { sourceId?: string; metadata?: Record<string, unknown> } = {},
): string {
  const id = randomUUID();
  database
    .prepare(
      "INSERT INTO import_batches (id, source_id, metadata_json) VALUES (?, ?, ?)",
    )
    .run(id, input.sourceId ?? null, JSON.stringify(input.metadata ?? {}));
  return id;
}

export function updateImportBatch(
  database: SqliteDatabase,
  id: string,
  status: "completed" | "failed" | "reverted",
  error?: string,
): void {
  database
    .prepare(
      `UPDATE import_batches
       SET status = ?, completed_at = ?, error = ?
       WHERE id = ?`,
    )
    .run(status, now(), error ?? null, id);
}

export function createDocument(
  database: SqliteDatabase,
  input: CreateDocumentInput,
): LawDocumentRecord {
  const id = randomUUID();
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO documents (
        id, title, document_type, jurisdiction_id, original_file_name, file_path,
        official_identifier, status, text_origin, version, version_of_id, source_id,
        import_batch_id, effective_from, effective_to, consulted_at, uploaded_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.documentType,
      input.jurisdictionId ?? null,
      input.originalFileName,
      input.filePath,
      input.officialIdentifier ?? null,
      input.status ?? "uploaded",
      input.textOrigin ?? null,
      input.version ?? 1,
      input.versionOfId ?? null,
      input.sourceId ?? null,
      input.importBatchId ?? null,
      input.effectiveFrom?.toISOString() ?? null,
      input.effectiveTo?.toISOString() ?? null,
      input.consultedAt?.toISOString() ?? null,
      input.uploadedBy ?? null,
      timestamp,
      timestamp,
    );
  return getDocument(database, id) as LawDocumentRecord;
}

export function getDocument(
  database: SqliteDatabase,
  id: string,
): LawDocumentRecord | undefined {
  const row = database
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? documentFromRow(row) : undefined;
}

export interface DocumentSearchResult {
  document: LawDocumentRecord;
  rank: number;
}

export function searchDocuments(
  database: SqliteDatabase,
  query: string,
  options: { documentType?: DocumentType; jurisdictionId?: string } = {},
): DocumentSearchResult[] {
  const conditions = ["documents_fts MATCH ?"];
  const parameters: Array<string> = [query];
  if (options.documentType) {
    conditions.push("d.document_type = ?");
    parameters.push(options.documentType);
  }
  if (options.jurisdictionId) {
    conditions.push("d.jurisdiction_id = ?");
    parameters.push(options.jurisdictionId);
  }
  const rows = database
    .prepare(
      `SELECT d.*, bm25(documents_fts) AS rank
       FROM documents_fts
       JOIN documents d ON d.id = documents_fts.document_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY rank`,
    )
    .all(...parameters) as Row[];
  return rows.map((row) => ({
    document: documentFromRow(row),
    rank: Number(row.rank),
  }));
}

export interface CreateFragmentInput {
  documentId: string;
  text: string;
  pageNumber?: number;
  sectionLabel?: string;
  articleNumber?: string;
  positionStart?: number;
  positionEnd?: number;
  textOrigin?: TextOrigin;
}

export function createFragment(
  database: SqliteDatabase,
  input: CreateFragmentInput,
): DocumentFragmentRecord {
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO document_fragments
       (id, document_id, text, page_number, section_label, article_number,
        position_start, position_end, text_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.documentId,
      input.text,
      input.pageNumber ?? null,
      input.sectionLabel ?? null,
      input.articleNumber ?? null,
      input.positionStart ?? null,
      input.positionEnd ?? null,
      input.textOrigin ?? "extracted",
    );
  const row = database
    .prepare("SELECT * FROM document_fragments WHERE id = ?")
    .get(id) as Row;
  return fragmentFromRow(row);
}

export function createJurisdiction(
  database: SqliteDatabase,
  input: {
    code: string;
    name: string;
    type: "country" | "province" | "other";
    parentId?: string;
  },
): string {
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO jurisdictions (id, code, name, normalized_name, jurisdiction_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.code,
      input.name,
      normalize(input.name),
      input.type,
      input.parentId ?? null,
    );
  return id;
}

export interface CreateNodeInput {
  nodeType: NodeType;
  name: string;
  description?: string;
  jurisdictionId?: string;
  officialIdentifier?: string;
  sourceId?: string;
  validationStatus?: LawNodeRecord["validationStatus"];
  createdBy?: string;
}

export function createNode(
  database: SqliteDatabase,
  input: CreateNodeInput,
): LawNodeRecord {
  const id = randomUUID();
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO nodes (
        id, node_type, name, normalized_name, description, jurisdiction_id,
        official_identifier, source_id, validation_status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.nodeType,
      input.name,
      normalize(input.name),
      input.description ?? null,
      input.jurisdictionId ?? null,
      input.officialIdentifier ?? null,
      input.sourceId ?? null,
      input.validationStatus ?? "pending",
      input.createdBy ?? null,
      timestamp,
      timestamp,
    );
  return nodeFromRow(
    database.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as Row,
  );
}

export function findNode(
  database: SqliteDatabase,
  nodeType: NodeType,
  name: string,
  jurisdictionId?: string,
): LawNodeRecord | undefined {
  const normalizedName = normalize(name);
  const row = database.prepare(
    "SELECT * FROM nodes WHERE node_type = ? AND normalized_name = ? AND COALESCE(jurisdiction_id, '') = COALESCE(?, '') LIMIT 1",
  ).get(nodeType, normalizedName, jurisdictionId ?? null) as Row | undefined;
  return row ? nodeFromRow(row) : undefined;
}

export interface CreateEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  explanation?: string;
  sourceId?: string;
  confidence?: number;
  provenance?: RelationProvenance;
  analysisVersion?: string;
  createdBy?: string;
}

export function createEdge(
  database: SqliteDatabase,
  input: CreateEdgeInput,
): LawEdgeRecord {
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO edges (
        id, source_node_id, target_node_id, relation_type, explanation, source_id,
        confidence, provenance, analysis_version, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.sourceNodeId,
      input.targetNodeId,
      input.relationType,
      input.explanation ?? null,
      input.sourceId ?? null,
      input.confidence ?? 0,
      input.provenance ?? "suggested",
      input.analysisVersion ?? null,
      input.createdBy ?? null,
    );
  const row = database
    .prepare("SELECT * FROM edges WHERE id = ?")
    .get(id) as Row;
  return {
    id,
    sourceNodeId: String(row.source_node_id),
    targetNodeId: String(row.target_node_id),
    relationType: row.relation_type as RelationType,
    explanation: row.explanation as string | undefined,
    sourceId: row.source_id as string | undefined,
    confidence: Number(row.confidence),
    provenance: row.provenance as RelationProvenance,
    analysisVersion: row.analysis_version as string | undefined,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by as string | undefined,
    createdAt: new Date(String(row.created_at)),
  };
}

export function disableEdge(
  database: SqliteDatabase,
  edgeId: string,
  input: { disabledBy?: string; reason?: string } = {},
): void {
  database
    .prepare(
      `UPDATE edges
       SET is_active = 0, disabled_at = ?, disabled_by = ?, disabled_reason = ?
       WHERE id = ?`,
    )
    .run(now(), input.disabledBy ?? null, input.reason ?? null, edgeId);
}

export interface GraphNeighbor {
  node: LawNodeRecord;
  edgeId: string;
  relationType: RelationType;
  direction: "outgoing" | "incoming";
  depth: number;
}

export function getGraphNeighbors(
  database: SqliteDatabase,
  nodeId: string,
  depth = 1,
): GraphNeighbor[] {
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error("Graph depth must be a positive integer");
  }
  const rows = database
    .prepare(
      `WITH RECURSIVE graph(node_id, depth, path, edge_id, relation_type, direction) AS (
         SELECT ?, 0, '|' || ? || '|', NULL, NULL, NULL
         UNION ALL
         SELECT CASE WHEN e.source_node_id = graph.node_id THEN e.target_node_id ELSE e.source_node_id END,
                graph.depth + 1,
                graph.path || CASE WHEN e.source_node_id = graph.node_id
                  THEN e.target_node_id ELSE e.source_node_id END || '|',
                e.id,
                e.relation_type,
                CASE WHEN e.source_node_id = graph.node_id THEN 'outgoing' ELSE 'incoming' END
         FROM graph
         JOIN edges e ON (e.source_node_id = graph.node_id OR e.target_node_id = graph.node_id)
           AND e.is_active = 1
         WHERE graph.depth < ?
           AND instr(graph.path, '|' || CASE WHEN e.source_node_id = graph.node_id
             THEN e.target_node_id ELSE e.source_node_id END || '|') = 0
       )
       SELECT graph.node_id, graph.depth, graph.edge_id, graph.relation_type,
              graph.direction, n.*
       FROM graph
       JOIN nodes n ON n.id = graph.node_id
       WHERE graph.depth > 0`,
    )
    .all(nodeId, nodeId, depth) as Row[];

  return rows.map((row) => ({
    node: nodeFromRow(row),
    edgeId: String(row.edge_id),
    relationType: row.relation_type as RelationType,
    direction: row.direction as "outgoing" | "incoming",
    depth: Number(row.depth),
  }));
}

export function createAnalysis(
  database: SqliteDatabase,
  input: {
    documentId: string;
    status?: AnalysisStatus;
    model?: string;
  },
): LawAnalysisRecord {
  const id = randomUUID();
  database
    .prepare(
      "INSERT INTO analyses (id, document_id, status, model) VALUES (?, ?, ?, ?)",
    )
    .run(id, input.documentId, input.status ?? "queued", input.model ?? null);
  const row = database
    .prepare("SELECT * FROM analyses WHERE id = ?")
    .get(id) as Row;
  return analysisFromRow(row);
}

export function getAnalysis(database: SqliteDatabase, id: string): LawAnalysisRecord | undefined {
  const row = database.prepare("SELECT * FROM analyses WHERE id = ?").get(id) as Row | undefined;
  return row ? analysisFromRow(row) : undefined;
}

export function getLatestAnalysis(database: SqliteDatabase, documentId: string): LawAnalysisRecord | undefined {
  const row = database.prepare("SELECT * FROM analyses WHERE document_id = ? ORDER BY created_at DESC LIMIT 1").get(documentId) as Row | undefined;
  return row ? analysisFromRow(row) : undefined;
}

export function startAnalysis(database: SqliteDatabase, id: string): void {
  database.prepare("UPDATE analyses SET status = 'running', started_at = COALESCE(started_at, ?), error = NULL WHERE id = ?").run(now(), id);
}

export function completeAnalysis(
  database: SqliteDatabase,
  id: string,
  input: { summary: string; result: unknown; durationMs: number },
): void {
  database.prepare("UPDATE analyses SET status = 'completed', summary = ?, result_json = ?, duration_ms = ?, completed_at = ?, error = NULL WHERE id = ?")
    .run(input.summary, JSON.stringify(input.result), input.durationMs, now(), id);
}

export function failAnalysis(database: SqliteDatabase, id: string, error: string, durationMs?: number): void {
  database.prepare("UPDATE analyses SET status = 'failed', error = ?, duration_ms = ?, completed_at = ? WHERE id = ?")
    .run(error.slice(0, 2000), durationMs ?? null, now(), id);
}

export function updateDocumentStatus(
  database: SqliteDatabase,
  id: string,
  status: DocumentStatus,
  input: { textOrigin?: TextOrigin; error?: string } = {},
): void {
  database.prepare("UPDATE documents SET status = ?, text_origin = COALESCE(?, text_origin), updated_at = ? WHERE id = ?")
    .run(status, input.textOrigin ?? null, now(), id);
}

export function listFragments(database: SqliteDatabase, documentId: string): DocumentFragmentRecord[] {
  const rows = database.prepare("SELECT * FROM document_fragments WHERE document_id = ? ORDER BY position_start, page_number, id").all(documentId) as Row[];
  return rows.map(fragmentFromRow);
}

export interface ProcessingTaskRecord {
  id: string;
  documentId: string;
  taskType: "extract" | "analysis";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  attempts: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

function taskFromRow(row: Row): ProcessingTaskRecord {
  return {
    id: String(row.id), documentId: String(row.document_id), taskType: row.task_type as ProcessingTaskRecord["taskType"],
    status: row.status as ProcessingTaskRecord["status"], attempts: Number(row.attempts), error: row.error as string | undefined,
    createdAt: new Date(String(row.created_at)), startedAt: toDate(row.started_at), completedAt: toDate(row.completed_at),
  };
}

export function createProcessingTask(
  database: SqliteDatabase,
  input: { documentId: string; taskType: ProcessingTaskRecord["taskType"] },
): ProcessingTaskRecord {
  const id = randomUUID();
  database.prepare("INSERT INTO processing_tasks (id, document_id, task_type) VALUES (?, ?, ?)").run(id, input.documentId, input.taskType);
  return taskFromRow(database.prepare("SELECT * FROM processing_tasks WHERE id = ?").get(id) as Row);
}

export function listQueuedProcessingTasks(
  database: SqliteDatabase,
  taskType: ProcessingTaskRecord["taskType"] = "extract",
): ProcessingTaskRecord[] {
  const rows = database.prepare("SELECT * FROM processing_tasks WHERE task_type = ? AND status = 'queued' ORDER BY created_at, id").all(taskType) as Row[];
  return rows.map(taskFromRow);
}

export function updateProcessingTask(
  database: SqliteDatabase,
  id: string,
  status: ProcessingTaskRecord["status"],
  error?: string,
): void {
  const started = status === "running" ? now() : null;
  const completed = ["completed", "failed", "cancelled"].includes(status) ? now() : null;
  database.prepare("UPDATE processing_tasks SET status = ?, attempts = attempts + ?, error = ?, started_at = COALESCE(started_at, ?), completed_at = COALESCE(?, completed_at) WHERE id = ?")
    .run(status, status === "running" ? 1 : 0, error?.slice(0, 2000) ?? null, started, completed, id);
}

export interface AgentRunRecord {
  id: string;
  analysisId: string;
  parentRunId?: string;
  agentType: string;
  question: string;
  scope: string;
  status: "queued" | "running" | "completed" | "failed";
  response?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

function agentRunFromRow(row: Row): AgentRunRecord {
  return {
    id: String(row.id), analysisId: String(row.analysis_id), parentRunId: row.parent_run_id as string | undefined,
    agentType: String(row.agent_type), question: String(row.question), scope: String(row.scope),
    status: row.status as AgentRunRecord["status"], response: row.response_json ? JSON.parse(String(row.response_json)) : undefined,
    error: row.error as string | undefined, createdAt: new Date(String(row.created_at)), startedAt: toDate(row.started_at), completedAt: toDate(row.completed_at),
  };
}

export function createAgentRun(database: SqliteDatabase, input: Pick<AgentRunRecord, "analysisId" | "agentType" | "question" | "scope"> & { parentRunId?: string }): AgentRunRecord {
  const id = randomUUID();
  database.prepare("INSERT INTO agent_runs (id, analysis_id, parent_run_id, agent_type, question, scope) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, input.analysisId, input.parentRunId ?? null, input.agentType, input.question, input.scope);
  return agentRunFromRow(database.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row);
}

export function updateAgentRun(database: SqliteDatabase, id: string, status: AgentRunRecord["status"], response?: unknown, error?: string): void {
  database.prepare("UPDATE agent_runs SET status = ?, response_json = ?, error = ?, started_at = COALESCE(started_at, ?), completed_at = CASE WHEN ? IN ('completed', 'failed') THEN ? ELSE completed_at END WHERE id = ?")
    .run(status, response === undefined ? null : JSON.stringify(response), error?.slice(0, 2000) ?? null, status === "running" ? now() : null, status, ["completed", "failed"].includes(status) ? now() : null, id);
}

export function listAgentRuns(database: SqliteDatabase, analysisId: string): AgentRunRecord[] {
  const rows = database.prepare("SELECT * FROM agent_runs WHERE analysis_id = ? ORDER BY created_at, id").all(analysisId) as Row[];
  return rows.map(agentRunFromRow);
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: Date;
  fragmentIds: string[];
  nodeIds: string[];
}

export function getConversation(database: SqliteDatabase, id: string): { id: string; documentId?: string; createdAt: Date; messages: ConversationMessageRecord[] } | undefined {
  const conversation = database.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Row | undefined;
  if (!conversation) return undefined;
  const messages = database.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at, id").all(id) as Row[];
  return {
    id: String(conversation.id), documentId: conversation.document_id as string | undefined,
    createdAt: new Date(String(conversation.created_at)),
    messages: messages.map((message) => {
      const sources = database.prepare("SELECT fragment_id, node_id FROM message_sources WHERE message_id = ?").all(String(message.id)) as Row[];
      return {
        id: String(message.id), conversationId: String(message.conversation_id), role: message.role as ConversationMessageRecord["role"],
        content: String(message.content), createdAt: new Date(String(message.created_at)),
        fragmentIds: sources.flatMap((source) => source.fragment_id ? [String(source.fragment_id)] : []),
        nodeIds: sources.flatMap((source) => source.node_id ? [String(source.node_id)] : []),
      };
    }),
  };
}

export function createFinding(
  database: SqliteDatabase,
  input: {
    analysisId: string;
    edgeId?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    explanation: string;
    confidence: number;
    evidenceFragmentIds?: string[];
  },
): string {
  const id = randomUUID();
  withTransaction(database, () => {
    database
      .prepare(
        `INSERT INTO findings (
          id, analysis_id, edge_id, source_node_id, target_node_id, explanation, confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.analysisId,
        input.edgeId ?? null,
        input.sourceNodeId ?? null,
        input.targetNodeId ?? null,
        input.explanation,
        input.confidence,
      );
    const evidence = database.prepare(
      "INSERT INTO finding_evidence (finding_id, fragment_id) VALUES (?, ?)",
    );
    for (const fragmentId of input.evidenceFragmentIds ?? []) {
      evidence.run(id, fragmentId);
    }
  });
  return id;
}

export function createConversation(
  database: SqliteDatabase,
  input: { documentId?: string; createdBy?: string } = {},
): string {
  const id = randomUUID();
  database
    .prepare(
      "INSERT INTO conversations (id, document_id, created_by) VALUES (?, ?, ?)",
    )
    .run(id, input.documentId ?? null, input.createdBy ?? null);
  return id;
}

export function addConversationMessage(
  database: SqliteDatabase,
  input: {
    conversationId: string;
    role: "system" | "user" | "assistant";
    content: string;
    fragmentIds?: string[];
    nodeIds?: string[];
  },
): string {
  const id = randomUUID();
  withTransaction(database, () => {
    database
      .prepare(
        "INSERT INTO conversation_messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
      )
      .run(id, input.conversationId, input.role, input.content);
    const source = database.prepare(
      "INSERT INTO message_sources (message_id, fragment_id, node_id) VALUES (?, ?, ?)",
    );
    for (const fragmentId of input.fragmentIds ?? []) {
      source.run(id, fragmentId, null);
    }
    for (const nodeId of input.nodeIds ?? []) {
      source.run(id, null, nodeId);
    }
  });
  return id;
}

export function searchFragments(
  database: SqliteDatabase,
  query: string,
  documentId?: string,
): Array<DocumentFragmentRecord & { rank: number }> {
  const condition = documentId
    ? "fragments_fts MATCH ? AND f.document_id = ?"
    : "fragments_fts MATCH ?";
  const parameters = documentId ? [query, documentId] : [query];
  const rows = database
    .prepare(
      `SELECT f.*, bm25(fragments_fts) AS rank
       FROM fragments_fts
       JOIN document_fragments f ON f.id = fragments_fts.fragment_id
       WHERE ${condition}
       ORDER BY rank`,
    )
    .all(...parameters) as Row[];
  return rows.map((row) => ({
    ...fragmentFromRow(row),
    rank: Number(row.rank),
  }));
}

export function searchNodes(
  database: SqliteDatabase,
  query: string,
): LawNodeRecord[] {
  const rows = database
    .prepare(
      `SELECT n.*
       FROM nodes_fts
       JOIN nodes n ON n.id = nodes_fts.node_id
       WHERE nodes_fts MATCH ?
       ORDER BY bm25(nodes_fts)`,
    )
    .all(query) as Row[];
  return rows.map(nodeFromRow);
}
