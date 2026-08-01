CREATE TABLE IF NOT EXISTS jurisdictions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  jurisdiction_type TEXT NOT NULL CHECK (jurisdiction_type IN ('country', 'province', 'other')),
  parent_id TEXT REFERENCES jurisdictions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_parent ON jurisdictions(parent_id);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'official_bulletin', 'official_publication', 'external_reference', 'import')),
  title TEXT NOT NULL,
  url TEXT,
  citation TEXT,
  retrieved_at TEXT,
  checksum TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sources_checksum ON sources(checksum);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'reverted')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('national_law', 'provincial_law', 'bill')),
  jurisdiction_id TEXT REFERENCES jurisdictions(id) ON DELETE RESTRICT,
  original_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  official_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'failed', 'pending_review')),
  text_origin TEXT CHECK (text_origin IN ('official', 'extracted', 'ocr')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  version_of_id TEXT REFERENCES documents(id) ON DELETE RESTRICT,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
  effective_from TEXT,
  effective_to TEXT,
  consulted_at TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (official_identifier, version)
);

CREATE INDEX IF NOT EXISTS idx_documents_jurisdiction ON documents(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_official_identifier ON documents(official_identifier);
CREATE INDEX IF NOT EXISTS idx_documents_version_of ON documents(version_of_id);

CREATE TABLE IF NOT EXISTS document_fragments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  page_number INTEGER CHECK (page_number IS NULL OR page_number > 0),
  section_label TEXT,
  article_number TEXT,
  position_start INTEGER CHECK (position_start IS NULL OR position_start >= 0),
  position_end INTEGER CHECK (position_end IS NULL OR position_end >= position_start),
  text_origin TEXT NOT NULL CHECK (text_origin IN ('official', 'extracted', 'ocr')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fragments_document_position
  ON document_fragments(document_id, position_start);
CREATE INDEX IF NOT EXISTS idx_fragments_article ON document_fragments(article_number);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL CHECK (node_type IN ('national_law', 'provincial_law', 'bill', 'article', 'concept', 'jurisdiction', 'organization', 'source')),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  jurisdiction_id TEXT REFERENCES jurisdictions(id) ON DELETE RESTRICT,
  official_identifier TEXT,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'verified', 'rejected')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_jurisdiction ON nodes(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_nodes_identifier ON nodes(official_identifier);
CREATE INDEX IF NOT EXISTS idx_nodes_normalized_name ON nodes(normalized_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_unique_name
  ON nodes(node_type, normalized_name, COALESCE(jurisdiction_id, ''));

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('relacionada_con', 'contradice', 'modifica', 'deroga', 'reglamenta', 'afecta', 'aplica_en', 'pertenece_a', 'menciona', 'reemplaza', 'depende_de')),
  explanation TEXT,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  provenance TEXT NOT NULL DEFAULT 'suggested' CHECK (provenance IN ('verified', 'suggested')),
  analysis_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  disabled_at TEXT,
  disabled_by TEXT,
  disabled_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_node_id <> target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id, is_active);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id, is_active);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_edges_provenance ON edges(provenance);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  summary TEXT,
  model TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_document ON analyses(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  edge_id TEXT REFERENCES edges(id) ON DELETE SET NULL,
  source_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  target_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  explanation TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_findings_edge ON findings(edge_id);

CREATE TABLE IF NOT EXISTS finding_evidence (
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  fragment_id TEXT NOT NULL REFERENCES document_fragments(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, fragment_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS message_sources (
  message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  fragment_id TEXT REFERENCES document_fragments(id) ON DELETE CASCADE,
  node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, fragment_id, node_id),
  CHECK (fragment_id IS NOT NULL OR node_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS fragment_embeddings (
  fragment_id TEXT NOT NULL REFERENCES document_fragments(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fragment_id, model)
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  original_file_name,
  official_identifier
);

CREATE TRIGGER IF NOT EXISTS documents_fts_insert
AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(document_id, title, original_file_name, official_identifier)
  VALUES (new.id, new.title, new.original_file_name, COALESCE(new.official_identifier, ''));
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_update
AFTER UPDATE OF title, original_file_name, official_identifier ON documents BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
  INSERT INTO documents_fts(document_id, title, original_file_name, official_identifier)
  VALUES (new.id, new.title, new.original_file_name, COALESCE(new.official_identifier, ''));
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_delete
AFTER DELETE ON documents BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS fragments_fts USING fts5(
  fragment_id UNINDEXED,
  document_id UNINDEXED,
  text,
  article_number,
  section_label
);

CREATE TRIGGER IF NOT EXISTS fragments_fts_insert
AFTER INSERT ON document_fragments BEGIN
  INSERT INTO fragments_fts(fragment_id, document_id, text, article_number, section_label)
  VALUES (new.id, new.document_id, new.text, COALESCE(new.article_number, ''), COALESCE(new.section_label, ''));
END;

CREATE TRIGGER IF NOT EXISTS fragments_fts_update
AFTER UPDATE OF text, article_number, section_label ON document_fragments BEGIN
  DELETE FROM fragments_fts WHERE fragment_id = old.id;
  INSERT INTO fragments_fts(fragment_id, document_id, text, article_number, section_label)
  VALUES (new.id, new.document_id, new.text, COALESCE(new.article_number, ''), COALESCE(new.section_label, ''));
END;

CREATE TRIGGER IF NOT EXISTS fragments_fts_delete
AFTER DELETE ON document_fragments BEGIN
  DELETE FROM fragments_fts WHERE fragment_id = old.id;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  node_id UNINDEXED,
  name,
  description,
  official_identifier
);

CREATE TRIGGER IF NOT EXISTS nodes_fts_insert
AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(node_id, name, description, official_identifier)
  VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.official_identifier, ''));
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update
AFTER UPDATE OF name, description, official_identifier ON nodes BEGIN
  DELETE FROM nodes_fts WHERE node_id = old.id;
  INSERT INTO nodes_fts(node_id, name, description, official_identifier)
  VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.official_identifier, ''));
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete
AFTER DELETE ON nodes BEGIN
  DELETE FROM nodes_fts WHERE node_id = old.id;
END;
