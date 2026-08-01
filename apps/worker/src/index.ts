import { readFile } from "node:fs/promises";
import {
  createFragment,
  listQueuedProcessingTasks,
  getDocument,
  openDatabase,
  updateDocumentStatus,
  updateProcessingTask,
  type SqliteDatabase,
} from "@law-analyzer/database";
import { getMistralOCRConfig, MistralOCRClient } from "@law-analyzer/ai";
import { extractText, splitIntoFragments } from "@law-analyzer/parser";

const database: SqliteDatabase = openDatabase(
  process.env.DATABASE_URL ?? "sqlite:./storage/law-analyzer.db",
);
const intervalMs = Number(process.env.WORKER_POLL_MS ?? 1000);

async function processQueuedExtraction(
  taskId: string,
  documentId: string,
): Promise<void> {
  const document = getDocument(database, documentId);
  if (!document || document.status !== "uploaded") return;
  updateProcessingTask(database, taskId, "running");
  updateDocumentStatus(database, documentId, "processing");
  try {
    let usedOCR = false;
    const ocrConfig = getMistralOCRConfig();
    const parsed = await extractText(await readFile(document.filePath), ocrConfig ? {
      ocr: async (pdf) => {
        usedOCR = true;
        const result = await new MistralOCRClient(ocrConfig).extract(pdf);
        const pages = result.pages.map((page) => ({
          pageNumber: page.index + 1,
          text: page.markdown.trim(),
        }));
        return {
          text: pages.map((page) => page.text).filter(Boolean).join("\n\n"),
          pageCount: pages.length,
          pages,
          hasText: pages.some((page) => page.text.length > 0),
        };
      },
    } : undefined);
    if (!parsed.hasText) {
      updateDocumentStatus(database, documentId, "pending_review", {
        textOrigin: "ocr",
      });
    } else {
      for (const fragment of splitIntoFragments(parsed)) {
        createFragment(database, {
          documentId,
          text: fragment.text,
          pageNumber: fragment.pageNumber,
          positionStart: fragment.positionStart,
          positionEnd: fragment.positionEnd,
          textOrigin: usedOCR ? "ocr" : "extracted",
        });
      }
      updateDocumentStatus(database, documentId, "ready", {
        textOrigin: usedOCR ? "ocr" : "extracted",
      });
    }
    updateProcessingTask(database, taskId, "completed");
  } catch (error) {
    updateDocumentStatus(database, documentId, "failed");
    updateProcessingTask(
      database,
      taskId,
      "failed",
      error instanceof Error ? error.message : "Error de extraccion",
    );
  }
}

async function poll(): Promise<void> {
  for (const task of listQueuedProcessingTasks(database, "extract")) {
    await processQueuedExtraction(task.id, task.documentId);
  }
}

console.log("Document worker ready");
setInterval(() => void poll(), intervalMs);
void poll();
