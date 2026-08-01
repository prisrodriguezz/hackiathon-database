import type { LawRelation } from "@law-analyzer/shared";

export interface LawAnalysis {
  summary: string;
  relations: LawRelation[];
  affectedAreas: string[];
}

export async function analyzeLaw(_text: string): Promise<LawAnalysis> {
  throw new Error("AI provider is not configured yet");
}
