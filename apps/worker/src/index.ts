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
    const parsed = await extractText(await readFile(document.filePath));
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
          textOrigin: "extracted",
        });
      }
      updateDocumentStatus(database, documentId, "ready", {
        textOrigin: "extracted",
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
