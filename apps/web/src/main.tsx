import { StrictMode, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { api, relationLabels, validateAIProviderInput, validatePdf, validatePdfSignature, type AIProviderStatus, type ApiAnalysis, type ApiDocument, type ConversationMessage, type MistralOCRStatus } from "./api";
import "./styles.css";

type Phase = "empty" | "validating" | "processing" | "ready" | "warning" | "error";
type EvidenceFilter = "all" | "related" | "contradictions" | "affected" | "changes";
type Session = { document: ApiDocument; analysis?: ApiAnalysis; analysisId?: string; conversationId?: string };
type HistoryEntry = { id: string; title: string; fileName: string; createdAt: string; analysisId?: string; conversationId?: string };

const HISTORY_KEY = "law-analyzer-history";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Icon({ name, size = 18 }: { name: "plus" | "file" | "upload" | "send" | "spark" | "book" | "search" | "close" | "arrow" | "alert"; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    spark: <><path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5Z" /><path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    alert: <><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function getHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[]; } catch { return []; }
}

function saveHistory(entry: HistoryEntry) {
  const next = [entry, ...getHistory().filter((item) => item.id !== entry.id)].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function formatDate(date: string) { return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(date)); }
function formatTime(date = new Date().toISOString()) { return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date)); }

function statusLabel(phase: Phase) {
  return { empty: "Sin documento", validating: "Validando", processing: "Procesando", ready: "Análisis listo", warning: "Revisión necesaria", error: "Error" }[phase];
}

function documentPhase(status: ApiDocument["status"]): Phase {
  if (status === "failed") return "error";
  if (status === "ready") return "ready";
  if (status === "pending_review") return "warning";
  return "processing";
}

function relationGroup(finding: { type: string }, filter: EvidenceFilter) {
  if (filter === "all") return true;
  if (filter === "related") return ["relacionada_con", "menciona", "depende_de", "pertenece_a"].includes(finding.type);
  if (filter === "contradictions") return finding.type === "contradice";
  if (filter === "affected") return ["afecta", "aplica_en"].includes(finding.type);
  return ["modifica", "deroga", "reemplaza", "reglamenta"].includes(finding.type);
}

function App() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [session, setSession] = useState<Session>();
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);
  const [file, setFile] = useState<File>();
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<ApiDocument["documentType"]>("bill");
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const [selectedFinding, setSelectedFinding] = useState<number>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);
  const [aiProvider, setAIProvider] = useState<AIProviderStatus>();
  const [ocrProvider, setOCRProvider] = useState<MistralOCRStatus>();
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string>();
  const [providerNotice, setProviderNotice] = useState<string>();
  const [providerTest, setProviderTest] = useState<{ model: string; latencyMs: number }>();
  const [showProviderKey, setShowProviderKey] = useState(false);
  const [ocrBaseUrl, setOCRBaseUrl] = useState("");
  const [ocrApiKey, setOCRApiKey] = useState("");
  const [ocrModel, setOCRModel] = useState("");
  const [ocrError, setOCRError] = useState<string>();
  const [ocrNotice, setOCRNotice] = useState<string>();
  const [ocrTest, setOCRTest] = useState<{ model: string; latencyMs: number }>();
  const [showOCRKey, setShowOCRKey] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);

  const findings = session?.analysis?.result?.findings ?? [];
  const visibleFindings = useMemo(() => findings.filter((finding) => relationGroup(finding, filter)), [findings, filter]);

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);
  useEffect(() => { void api.getAIProvider().then(({ provider, ocr }) => { setAIProvider(provider); setOCRProvider(ocr); }); }, []);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setError(validatePdf(nextFile));
    setFile(nextFile);
    if (!title) setTitle(nextFile.name.replace(/\.pdf$/i, ""));
  }

  async function processFile() {
    if (!file) return;
    setPhase("validating"); setError(undefined);
    const validation = validatePdf(file) ?? await validatePdfSignature(file);
    if (validation) { setPhase("error"); setError(validation); return; }
    try {
      const uploaded = await api.uploadDocument(file, title.trim() || file.name.replace(/\.pdf$/i, ""), documentType);
      let document = uploaded.document;
      const entry: HistoryEntry = { id: document.id, title: document.title, fileName: document.originalFileName, createdAt: document.createdAt };
      setHistory(saveHistory(entry));
      setSession({ document }); setPhase("processing");
      let extracted = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = await api.getDocumentStatus(document.id);
        document = { ...document, status: status.status, updatedAt: status.updatedAt };
        setSession((current) => current ? { ...current, document } : current);
        if (status.status === "failed") throw new Error("No se pudo extraer el texto del PDF. Puedes revisar el archivo o intentar con otro.");
        if (["ready", "pending_review"].includes(status.status)) { extracted = true; break; }
        await sleep(800);
      }
      if (!extracted) throw new Error("La extracción está tardando más de lo esperado. Puedes reintentar con este u otro PDF.");
      const conversation = await api.createConversation(document.id);
      const queued = await api.queueAnalysis(document.id);
      setSession((current) => current ? { ...current, document, conversationId: conversation.id, analysisId: queued.analysisId } : current);
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const response = await api.getAnalysis(queued.analysisId);
        setSession((current) => current ? { ...current, analysis: response.analysis } : current);
        if (response.analysis.status === "completed") {
          setPhase(document.status === "pending_review" ? "warning" : "ready");
          const nextHistory = saveHistory({ ...entry, analysisId: queued.analysisId, conversationId: conversation.id });
          setHistory(nextHistory);
          return;
        }
        if (response.analysis.status === "failed") throw new Error(response.analysis.error ?? "El análisis no pudo completarse. Puedes reintentarlo.");
        await sleep(1100);
      }
      throw new Error("El análisis está tardando más de lo esperado. Puedes volver a consultar este documento desde el historial.");
    } catch (caught) {
      setPhase("error"); setError(caught instanceof Error ? caught.message : "No se pudo procesar el documento.");
    }
  }

  async function openHistory(entry: HistoryEntry) {
    setError(undefined); setPhase("processing");
    try {
      const { document } = await api.getDocument(entry.id);
      const current: Session = { document, analysisId: entry.analysisId, conversationId: entry.conversationId };
      setSession(current); setTitle(document.title); setFile(undefined);
      if (entry.conversationId) {
        const conversation = await api.getConversation(entry.conversationId);
        setMessages(conversation.messages.filter((message) => message.role !== "system"));
      }
      if (entry.analysisId) {
        const { analysis } = await api.getAnalysis(entry.analysisId);
        setSession({ ...current, analysis });
        setPhase(analysis.status === "completed" ? documentPhase(document.status) : "processing");
      } else setPhase(documentPhase(document.status));
    } catch (caught) { setPhase("error"); setError(caught instanceof Error ? caught.message : "No se pudo abrir el documento."); }
  }

  function reset() { setPhase("empty"); setSession(undefined); setFile(undefined); setTitle(""); setError(undefined); setMessages([]); setQuestion(""); setSelectedFinding(undefined); }

  function openAISettings() {
    setProviderBaseUrl(aiProvider?.baseUrl ?? "https://api.openai.com/v1");
    setProviderModel(aiProvider?.model ?? "");
    setProviderApiKey("");
    setProviderError(undefined);
    setProviderNotice(undefined);
    setProviderTest(undefined);
    setShowProviderKey(false);
    setOCRBaseUrl(ocrProvider?.baseUrl ?? "https://api.mistral.ai/v1");
    setOCRModel(ocrProvider?.model ?? "mistral-ocr-latest");
    setOCRApiKey("");
    setOCRError(undefined);
    setOCRNotice(undefined);
    setOCRTest(undefined);
    setShowOCRKey(false);
    setAISettingsOpen(true);
  }

  async function testProvider() {
    const input = { baseUrl: providerBaseUrl, apiKey: providerApiKey, model: providerModel };
    const validation = validateAIProviderInput(input);
    if (validation) { setProviderError(validation); return; }
    setProviderBusy(true); setProviderError(undefined); setProviderNotice(undefined); setProviderTest(undefined);
    try {
      const { test } = await api.testAIProvider(input);
      setProviderTest(test);
      setProviderNotice("Conexión válida. Todavía no se aplicó a nuevos análisis.");
    } catch (caught) { setProviderError(caught instanceof Error ? caught.message : "No se pudo probar la conexión."); }
    finally { setProviderBusy(false); }
  }

  async function saveProvider() {
    const input = { baseUrl: providerBaseUrl, apiKey: providerApiKey, model: providerModel };
    const validation = validateAIProviderInput(input);
    if (validation) { setProviderError(validation); return; }
    setProviderBusy(true); setProviderError(undefined); setProviderNotice(undefined);
    try {
      const { provider } = await api.saveAIProvider(input);
      setAIProvider(provider);
      setProviderTest(provider.test);
      setProviderNotice("Configuración guardada. Se aplicará a los nuevos análisis.");
      setProviderApiKey("");
    } catch (caught) { setProviderError(caught instanceof Error ? caught.message : "No se pudo guardar la configuración."); }
    finally { setProviderBusy(false); }
  }

  async function selectSimulated() {
    setProviderBusy(true); setProviderError(undefined);
    try { const { provider } = await api.useSimulatedAI(); setAIProvider(provider); setProviderApiKey(""); setProviderNotice("Modo simulado activo. No se usarán credenciales externas."); }
    catch (caught) { setProviderError(caught instanceof Error ? caught.message : "No se pudo activar el modo simulado."); }
    finally { setProviderBusy(false); }
  }

  async function removeProvider() {
    setProviderBusy(true); setProviderError(undefined);
    try { const { provider } = await api.removeAIProvider(); setAIProvider(provider); setProviderBaseUrl(""); setProviderModel(""); setProviderApiKey(""); setProviderNotice("Credenciales eliminadas. Se activó el modo simulado."); }
    catch (caught) { setProviderError(caught instanceof Error ? caught.message : "No se pudieron eliminar las credenciales."); }
    finally { setProviderBusy(false); }
  }

  async function testOCRProvider() {
    const input = { baseUrl: ocrBaseUrl, apiKey: ocrApiKey, model: ocrModel };
    const validation = validateAIProviderInput(input);
    if (validation) { setOCRError(validation); return; }
    setProviderBusy(true); setOCRError(undefined); setOCRNotice(undefined); setOCRTest(undefined);
    try {
      const { test } = await api.testMistralOCR(input);
      setOCRTest(test);
      setOCRNotice("Conexión válida. Mistral OCR se usará para PDFs escaneados al guardar.");
    } catch (caught) { setOCRError(caught instanceof Error ? caught.message : "No se pudo probar Mistral OCR."); }
    finally { setProviderBusy(false); }
  }

  async function saveOCRProvider() {
    const input = { baseUrl: ocrBaseUrl, apiKey: ocrApiKey, model: ocrModel };
    const validation = validateAIProviderInput(input);
    if (validation) { setOCRError(validation); return; }
    setProviderBusy(true); setOCRError(undefined); setOCRNotice(undefined);
    try {
      const { ocr } = await api.saveMistralOCR(input);
      setOCRProvider(ocr);
      setOCRNotice("Mistral OCR guardado. Se aplicará a los nuevos documentos escaneados.");
      setOCRApiKey("");
    } catch (caught) { setOCRError(caught instanceof Error ? caught.message : "No se pudo guardar Mistral OCR."); }
    finally { setProviderBusy(false); }
  }

  async function removeOCRProvider() {
    setProviderBusy(true); setOCRError(undefined);
    try { const { ocr } = await api.removeMistralOCR(); setOCRProvider(ocr); setOCRApiKey(""); setOCRNotice("Mistral OCR eliminado. Los PDFs escaneados quedarán pendientes de revisión."); }
    catch (caught) { setOCRError(caught instanceof Error ? caught.message : "No se pudo eliminar Mistral OCR."); }
    finally { setProviderBusy(false); }
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    reset();
  }

  async function sendQuestion(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !session?.conversationId || sending) return;
    const content = question.trim(); setQuestion(""); setSending(true);
    const optimistic: ConversationMessage = { id: `local-${Date.now()}`, conversationId: session.conversationId, role: "user", content, createdAt: new Date().toISOString(), fragmentIds: [], nodeIds: [] };
    setMessages((current) => [...current, optimistic]);
    try {
      const response = await api.sendMessage(session.conversationId, content);
      setMessages((current) => [...current, { id: response.messageId, conversationId: session.conversationId!, role: "assistant", content: response.content, createdAt: new Date().toISOString(), fragmentIds: response.fragmentIds, nodeIds: [] }]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo enviar la pregunta."); }
    finally { setSending(false); }
  }

  const activeFinding = selectedFinding === undefined ? undefined : findings[selectedFinding];
  return <div className="app-shell">
     <header className="topbar">
       <a href="#inicio" className="brand"><span className="brand-mark" /><span className="brand-name">ley<span>abierta</span></span></a>
       <div className="topbar-right"><span className="service-note"><span className="service-dot" /> Base normativa conectada</span><button className="ai-settings-button" onClick={openAISettings}>Configuración de IA</button><button className="mobile-evidence-toggle" onClick={() => setEvidenceOpen((open) => !open)}>{evidenceOpen ? "Cerrar" : "Evidencia"}</button><span className="avatar">TS</span></div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <button className="new-analysis" onClick={reset}><Icon name="plus" size={17} /> Nueva conversación</button>
        <div><p className="side-heading">Tus análisis</p><div className="history-list">
          {history.length === 0 && <p style={{ color: "#82908d", fontSize: 12, padding: "0 9px" }}>Tus documentos aparecerán aquí.</p>}
          {history.map((entry) => <button key={entry.id} className={`history-item ${session?.document.id === entry.id ? "active" : ""}`} onClick={() => void openHistory(entry)}><span className="history-icon"><Icon name="file" size={15} /></span><span><span className="history-title">{entry.title}</span><span className="history-date">{formatDate(entry.createdAt)}</span></span></button>)}
        </div></div>
        <div className="sidebar-footer"><strong>Una lectura responsable</strong>La evidencia orienta la conversación, pero no reemplaza la revisión profesional.<button className="clear-history" onClick={clearHistory}>Limpiar historial local</button></div>
      </aside>
      <main className="conversation" id="inicio">
        {phase === "empty" || phase === "error" ? <EmptyState file={file} title={title} setTitle={setTitle} documentType={documentType} setDocumentType={setDocumentType} dragging={dragging} setDragging={setDragging} chooseFile={chooseFile} fileInput={fileInput} processFile={processFile} error={error} setError={setError} reset={reset} phase={phase} /> : phase === "validating" || phase === "processing" ? <ProcessingState file={file} phase={phase} document={session?.document} /> : <>
          <ConversationHeader document={session?.document} phase={phase} onEvidence={() => setEvidenceOpen(true)} />
          <div className="message-area">
            <div className="messages">
              {error && <div className="error-box" role="alert"><Icon name="alert" size={17} /><span>{error}</span><button aria-label="Cerrar error" onClick={() => setError(undefined)}><Icon name="close" size={15} /></button></div>}
              {session?.analysis?.result?.summary && <div className="message"><div className="message-avatar"><Icon name="spark" size={14} /></div><div className="message-body"><div className="message-content">{session.analysis.result.summary}</div><div className="message-time">Resumen inicial · {formatTime(session.analysis.completedAt)}</div><div className="source-chips"><span className="source-chip">Análisis asistido por IA</span><span className="source-chip">{findings.length} referencias encontradas</span></div></div></div>}
              {phase === "warning" && <div className="error-box"><Icon name="alert" size={17} /><span>El documento fue procesado con información incompleta. Revisa las fuentes antes de usar este resultado.</span></div>}
              {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
              {sending && <div className="message"><div className="message-avatar"><Icon name="spark" size={14} /></div><div className="message-content typing"><i /><i /><i /></div></div>}
              <div ref={messageEnd} />
            </div>
          </div>
          <form className="composer-wrap" onSubmit={sendQuestion}><div className="composer"><textarea className="composer-input" rows={1} value={question} disabled={!session?.conversationId || sending} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregunta sobre este proyecto de ley..." aria-label="Pregunta sobre este proyecto de ley" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(event); } }} /><button className="send-button" type="submit" disabled={!question.trim() || sending} aria-label="Enviar pregunta"><Icon name="send" size={16} /></button><p className="composer-note">Enter para enviar · Las respuestas se basan en el documento y sus fuentes.</p></div></form>
        </>}
      </main>
      <aside className={`evidence ${evidenceOpen ? "open" : ""}`}>
        <div className="evidence-header"><p className="eyebrow">Mapa de evidencia</p><h2 className="panel-title">Relaciones encontradas</h2><p className="panel-subtitle">{findings.length ? `${findings.length} hallazgos para revisar` : "Las fuentes aparecerán aquí"}</p></div>
        <div className="evidence-tabs">{([ ["all", "Todas"], ["related", "Relacionadas"], ["contradictions", "Contradicciones"], ["affected", "Afectadas"], ["changes", "Cambios"] ] as [EvidenceFilter, string][]).map(([key, label]) => <button key={key} className={`evidence-tab ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{label}</button>)}</div>
        {visibleFindings.length ? <div className="finding-list">{visibleFindings.map((finding) => { const index = findings.indexOf(finding); return <button key={`${finding.lawId}-${index}`} className={`finding-card ${selectedFinding === index ? "selected" : ""}`} onClick={() => setSelectedFinding(index)}><div className="finding-top"><span className="finding-law">{finding.lawId}</span><span className="relation-tag">{relationLabels[finding.type]}</span></div><p className="finding-explanation">{finding.explanation}</p><div className="finding-footer"><span>{finding.sourceFragmentIds.length ? "Fuente en el documento" : "Sin fuente directa"}</span><span className="confidence"><span className="confidence-bar"><span style={{ width: `${Math.round(finding.confidence * 100)}%` }} /></span>{Math.round(finding.confidence * 100)}%</span></div></button>})}</div> : <div className="empty-panel"><Icon name="search" size={27} /><div>{phase === "empty" ? "Carga un documento para explorar sus relaciones." : "No hay hallazgos en esta categoría."}</div></div>}
        {activeFinding && <div className="detail-panel"><h3>{activeFinding.lawId}</h3><p>{activeFinding.explanation}</p><span className="detail-label">Referencias</span>{activeFinding.sourceFragmentIds.length ? activeFinding.sourceFragmentIds.map((id) => <span className="detail-source" key={id}>Fragmento {id.slice(0, 8)} · documento cargado</span>) : <span className="detail-source">No hay evidencia directa disponible</span>}{activeFinding.limitations.length > 0 && <p className="inference-note">Inferencia asistida: {activeFinding.limitations[0]}</p>}</div>}
       </aside>
     </div>
      {aiSettingsOpen && <AIProviderModal provider={aiProvider} baseUrl={providerBaseUrl} apiKey={providerApiKey} model={providerModel} busy={providerBusy} error={providerError} notice={providerNotice} test={providerTest} showKey={showProviderKey} setBaseUrl={setProviderBaseUrl} setApiKey={setProviderApiKey} setModel={setProviderModel} setShowKey={setShowProviderKey} onTest={() => void testProvider()} onSave={() => void saveProvider()} onSimulated={() => void selectSimulated()} onRemove={() => void removeProvider()} ocr={ocrProvider} ocrBaseUrl={ocrBaseUrl} ocrApiKey={ocrApiKey} ocrModel={ocrModel} ocrError={ocrError} ocrNotice={ocrNotice} ocrTest={ocrTest} showOCRKey={showOCRKey} setOCRBaseUrl={setOCRBaseUrl} setOCRApiKey={setOCRApiKey} setOCRModel={setOCRModel} setShowOCRKey={setShowOCRKey} onOCRTest={() => void testOCRProvider()} onOCRSave={() => void saveOCRProvider()} onOCRRemove={() => void removeOCRProvider()} onClose={() => setAISettingsOpen(false)} />}
   </div>;
}

function providerStatusText(status?: AIProviderStatus) {
  if (!status || status.status === "not_configured") return "Sin configurar";
  if (status.status === "simulated") return "Modo simulado";
  if (status.status === "connection_failed") return "Error de conexión";
  if (status.status === "invalid_configuration") return "Configuración inválida";
  return "Proveedor configurado";
}

function AIProviderModal(props: {
  provider?: AIProviderStatus;
  baseUrl: string;
  apiKey: string;
  model: string;
  busy: boolean;
  error?: string;
  notice?: string;
  test?: { model: string; latencyMs: number };
  showKey: boolean;
  setBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setModel: (value: string) => void;
  setShowKey: (value: boolean) => void;
  onTest: () => void;
  onSave: () => void;
  onSimulated: () => void;
  onRemove: () => void;
  ocr?: MistralOCRStatus;
  ocrBaseUrl: string;
  ocrApiKey: string;
  ocrModel: string;
  ocrError?: string;
  ocrNotice?: string;
  ocrTest?: { model: string; latencyMs: number };
  showOCRKey: boolean;
  setOCRBaseUrl: (value: string) => void;
  setOCRApiKey: (value: string) => void;
  setOCRModel: (value: string) => void;
  setShowOCRKey: (value: boolean) => void;
  onOCRTest: () => void;
  onOCRSave: () => void;
  onOCRRemove: () => void;
  onClose: () => void;
}) {
  const configured = props.provider?.status === "configured" || props.provider?.status === "connection_failed";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !props.busy) props.onClose(); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title"><div className="settings-header"><div><p className="eyebrow">Proveedor de IA</p><h2 id="ai-settings-title">Configuración de IA</h2></div><button className="modal-close" type="button" onClick={props.onClose} disabled={props.busy} aria-label="Cerrar configuración"><Icon name="close" size={18} /></button></div><div className={`provider-status status-${props.provider?.status ?? "not_configured"}`}><span className="status-dot" /><div><strong>{providerStatusText(props.provider)}</strong>{props.provider?.model && <span>{props.provider.provider} · {props.provider.model}{props.provider.apiKeyMasked ? ` · ${props.provider.apiKeyMasked}` : ""}</span>}</div></div><p className="settings-help">La API key se envía únicamente al backend y se conserva solo durante esta sesión. La URL debe ser la base del proveedor, por ejemplo <code>https://api.openai.com/v1</code>, no una ruta de chat completions.</p><div className="settings-fields"><label><span className="field-label">URL base</span><input className="field-input" value={props.baseUrl} onChange={(event) => props.setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" autoComplete="url" /></label><label><span className="field-label">API key</span><div className="secret-field"><input className="field-input" type={props.showKey ? "text" : "password"} value={props.apiKey} onChange={(event) => props.setApiKey(event.target.value)} placeholder={configured ? "Ingresa una clave para reemplazarla" : "sk-..."} autoComplete="new-password" /><button type="button" onClick={() => props.setShowKey(!props.showKey)}>{props.showKey ? "Ocultar" : "Mostrar"}</button></div></label><label><span className="field-label">Modelo</span><input className="field-input" value={props.model} onChange={(event) => props.setModel(event.target.value)} placeholder="gpt-4o-mini" /></label></div>{props.error && <div className="settings-message settings-error" role="alert"><Icon name="alert" size={16} />{props.error}</div>}{props.notice && <div className="settings-message settings-success">{props.notice}</div>}{props.test && <div className="connection-result">Modelo validado: <strong>{props.test.model}</strong> · latencia aproximada {props.test.latencyMs} ms</div>}<MistralOCRSettings provider={props.ocr} baseUrl={props.ocrBaseUrl} apiKey={props.ocrApiKey} model={props.ocrModel} error={props.ocrError} notice={props.ocrNotice} test={props.ocrTest} showKey={props.showOCRKey} busy={props.busy} setBaseUrl={props.setOCRBaseUrl} setApiKey={props.setOCRApiKey} setModel={props.setOCRModel} setShowKey={props.setShowOCRKey} onTest={props.onOCRTest} onSave={props.onOCRSave} onRemove={props.onOCRRemove} /><div className="settings-actions"><button className="secondary-action" type="button" onClick={props.onSimulated} disabled={props.busy}>Usar modo simulado</button>{configured && <button className="danger-action" type="button" onClick={props.onRemove} disabled={props.busy}>Eliminar credenciales</button>}<span className="action-spacer" /><button className="secondary-action" type="button" onClick={props.onClose} disabled={props.busy}>Cancelar</button><button className="secondary-action" type="button" onClick={props.onTest} disabled={props.busy}>{props.busy ? "Validando..." : "Probar conexión"}</button><button className="primary-action" type="button" onClick={props.onSave} disabled={props.busy}>{props.busy ? "Guardando..." : "Guardar configuración"}</button></div></section></div>;
}

function MistralOCRSettings(props: {
  provider?: MistralOCRStatus;
  baseUrl: string;
  apiKey: string;
  model: string;
  error?: string;
  notice?: string;
  test?: { model: string; latencyMs: number };
  showKey: boolean;
  busy: boolean;
  setBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setModel: (value: string) => void;
  setShowKey: (value: boolean) => void;
  onTest: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const configured = props.provider?.status === "configured" || props.provider?.status === "connection_failed";
  return <div className="ocr-settings"><div className="settings-section-heading"><div><p className="eyebrow">Parser de documentos</p><h3>Mistral OCR</h3></div><div className={`ocr-status ${props.provider?.status ?? "not_configured"}`}><span className="status-dot" />{configured ? "Configurado" : "No configurado"}</div></div><p className="settings-help">Se usa automáticamente cuando el PDF no contiene texto extraíble. La clave se mantiene solo en el backend.</p><div className="settings-fields"><label><span className="field-label">URL base de Mistral OCR</span><input className="field-input" value={props.baseUrl} onChange={(event) => props.setBaseUrl(event.target.value)} placeholder="https://api.mistral.ai/v1" autoComplete="url" /></label><label><span className="field-label">API key de Mistral OCR</span><div className="secret-field"><input className="field-input" type={props.showKey ? "text" : "password"} value={props.apiKey} onChange={(event) => props.setApiKey(event.target.value)} placeholder={configured ? "Ingresa una clave para reemplazarla" : "..."} autoComplete="new-password" /><button type="button" onClick={() => props.setShowKey(!props.showKey)}>{props.showKey ? "Ocultar" : "Mostrar"}</button></div></label><label><span className="field-label">Modelo OCR</span><input className="field-input" value={props.model} onChange={(event) => props.setModel(event.target.value)} placeholder="mistral-ocr-latest" /></label></div>{props.error && <div className="settings-message settings-error" role="alert"><Icon name="alert" size={16} />{props.error}</div>}{props.notice && <div className="settings-message settings-success">{props.notice}</div>}{props.test && <div className="connection-result">Modelo OCR validado: <strong>{props.test.model}</strong> · latencia aproximada {props.test.latencyMs} ms</div>}<div className="settings-actions ocr-actions"><button className="secondary-action" type="button" onClick={props.onTest} disabled={props.busy}>{props.busy ? "Validando..." : "Probar Mistral OCR"}</button><button className="primary-action" type="button" onClick={props.onSave} disabled={props.busy}>{props.busy ? "Guardando..." : "Guardar Mistral OCR"}</button>{configured && <button className="danger-action" type="button" onClick={props.onRemove} disabled={props.busy}>Eliminar OCR</button>}</div></div>;
}

function EmptyState(props: { file?: File; title: string; setTitle: (value: string) => void; documentType: ApiDocument["documentType"]; setDocumentType: (value: ApiDocument["documentType"]) => void; dragging: boolean; setDragging: (value: boolean) => void; chooseFile: (file?: File) => void; fileInput: RefObject<HTMLInputElement>; processFile: () => void; error?: string; setError: (value: string | undefined) => void; reset: () => void; phase: Phase }) {
  return <><div className="message-area"><div className="welcome"><div className="welcome-kicker">Análisis jurídico verificable</div><h1>Entiende lo que cambia en una ley.</h1><p className="welcome-intro">Carga un proyecto de ley para conversar con su contenido, descubrir relaciones normativas y seguir cada respuesta hasta su fuente.</p><div className="upload-card"><div className={`dropzone ${props.dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); props.setDragging(true); }} onDragLeave={() => props.setDragging(false)} onDrop={(event) => { event.preventDefault(); props.setDragging(false); props.chooseFile(event.dataTransfer.files[0]); }}><div className="upload-symbol"><Icon name="upload" size={21} /></div>{props.file ? <><strong>{props.file.name}</strong><p>{(props.file.size / 1024 / 1024).toFixed(2)} MB · listo para validar</p><button className="file-button" onClick={() => props.fileInput.current?.click()}>Elegir otro PDF</button></> : <><strong>Suelta tu PDF aquí</strong><p>o <button type="button" className="file-button" onClick={() => props.fileInput.current?.click()}>explora tus archivos</button></p></>}<div className="file-requirements">PDF · máximo 10 MB · texto extraíble</div></div><input ref={props.fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => props.chooseFile(event.target.files?.[0])} /><div className="upload-fields"><label><span className="field-label">Nombre del proyecto</span><input className="field-input" value={props.title} onChange={(event) => props.setTitle(event.target.value)} placeholder="Ej. Ley de protección de humedales" /></label><label><span className="field-label">Jurisdicción</span><select className="field-select" value={props.documentType} onChange={(event) => props.setDocumentType(event.target.value as ApiDocument["documentType"])}><option value="bill">Proyecto de ley</option><option value="national_law">Ley nacional</option><option value="provincial_law">Ley provincial</option></select></label></div><button className="upload-submit" disabled={!props.file || props.phase === "validating"} onClick={() => void props.processFile()}>{props.phase === "validating" ? "Validando archivo..." : "Iniciar análisis"}<Icon name="arrow" size={15} /></button>{props.error && <div className="error-box" role="alert"><Icon name="alert" size={17} /><span>{props.error}</span><button aria-label="Cerrar error" onClick={() => props.setError(undefined)}><Icon name="close" size={15} /></button></div>}</div><p className="disclaimer">El análisis es asistido por IA y puede contener inferencias. Verifica siempre las fuentes y consulta a un profesional antes de tomar decisiones.</p></div></div><div className="composer-wrap"><div className="composer"><textarea className="composer-input" disabled placeholder="Carga un documento para comenzar una conversación..." aria-label="Carga un documento para comenzar una conversación" /></div></div></>;
}

function ProcessingState({ file, phase, document }: { file?: File; phase: Phase; document?: ApiDocument }) {
  const current = phase === "validating" ? 0 : document?.status === "processing" || !document ? 1 : 2;
  return <div className="message-area"><div className="progress-card"><div className="progress-header"><div className="progress-icon"><Icon name="spark" size={21} /></div><div><h2>{phase === "validating" ? "Validando tu documento" : "Estamos leyendo la ley"}</h2><p>{phase === "validating" ? "Comprobamos formato, tamaño y contenido." : "El análisis corre en segundo plano. Puedes esperar aquí."}</p></div></div><div className="progress-steps">{[0, 1, 2, 3].map((step) => <span key={step} className={`progress-step ${step < current ? "done" : step === current ? "current" : ""}`} />)}</div><div className="progress-labels"><span>Validando</span><span>Extrayendo texto</span><span>Analizando</span><span>Listo</span></div>{file && <div className="progress-file"><Icon name="file" size={17} /><span>{file.name}</span></div>}</div></div>;
}

function ConversationHeader({ document, phase, onEvidence }: { document?: ApiDocument; phase: Phase; onEvidence: () => void }) {
  return <div className="conversation-header"><div><p className="eyebrow">Documento en contexto</p><h1 className="document-title">{document?.title}</h1><p className="document-meta"><span>{document?.documentType === "bill" ? "Proyecto de ley" : document?.documentType === "national_law" ? "Ley nacional" : "Ley provincial"}</span><span className="meta-separator">·</span><span>{document?.originalFileName}</span></p></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className={`status-pill ${phase === "warning" ? "processing" : ""} ${phase === "error" ? "error" : ""}`}><span className="status-dot" /><span>{statusLabel(phase)}</span></span><button className="mobile-evidence-toggle" onClick={onEvidence}>Ver evidencia</button></div></div>;
}

function ChatMessage({ message }: { message: ConversationMessage }) {
  return <div className={`message ${message.role === "user" ? "user" : ""}`}><div className="message-avatar"><Icon name={message.role === "user" ? "search" : "spark"} size={14} /></div><div className="message-body"><div className="message-content">{message.content}</div><div className="message-time">{formatTime(message.createdAt)}</div>{message.fragmentIds.length > 0 && <div className="source-chips">{message.fragmentIds.map((id) => <span className="source-chip" key={id}>Fuente · {id.slice(0, 8)}</span>)}</div>}</div></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
