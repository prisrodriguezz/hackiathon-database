import {
  closeDatabase,
  createDocument,
  createEdge,
  createImportBatch,
  createJurisdiction,
  createNode,
  createSource,
  findNode,
  openDatabase,
  updateImportBatch,
  type LawNodeRecord,
  type SqliteDatabase,
} from "@law-analyzer/database";

interface LawSeed {
  officialIdentifier: string;
  title: string;
  documentType: "national_law" | "provincial_law";
  jurisdictionCode: string;
  effectiveFrom: string;
  description: string;
}

const ARGENTINA = { code: "AR", name: "Argentina" };

const PROVINCES: Array<{ code: string; name: string }> = [
  { code: "BA", name: "Buenos Aires" },
  { code: "CABA", name: "Ciudad Autónoma de Buenos Aires" },
];

const NATIONAL_LAWS: LawSeed[] = [
  {
    officialIdentifier: "Ley 24.430",
    title: "Constitución de la Nación Argentina",
    documentType: "national_law",
    jurisdictionCode: "AR",
    effectiveFrom: "1995-01-10",
    description:
      "Texto ordenado de la Constitución Nacional, resultado de la reforma de 1994.",
  },
  {
    officialIdentifier: "Ley 25.675",
    title: "Ley General del Ambiente",
    documentType: "national_law",
    jurisdictionCode: "AR",
    effectiveFrom: "2002-11-28",
    description:
      "Establece los presupuestos mínimos para el logro de una gestión sustentable y adecuada del ambiente.",
  },
];

const PROVINCIAL_LAWS: LawSeed[] = [
  {
    officialIdentifier: "Ley 12.257",
    title: "Código de Aguas de la Provincia de Buenos Aires",
    documentType: "provincial_law",
    jurisdictionCode: "BA",
    effectiveFrom: "1998-10-15",
    description:
      "Regula el uso, la conservación y el aprovechamiento de las aguas públicas y privadas de la provincia.",
  },
  {
    officialIdentifier: "Ley 1.236",
    title: "Ley Básica Ambiental de la Ciudad Autónoma de Buenos Aires",
    documentType: "provincial_law",
    jurisdictionCode: "CABA",
    effectiveFrom: "2004-08-26",
    description:
      "Establece la política ambiental de la Ciudad y los instrumentos de gestión para proteger el ambiente.",
  },
];

interface EdgeSeed {
  source: string;
  target: string;
  relationType:
    | "relacionada_con"
    | "contradice"
    | "modifica"
    | "deroga"
    | "reglamenta"
    | "afecta"
    | "aplica_en"
    | "pertenece_a"
    | "menciona"
    | "reemplaza"
    | "depende_de";
  explanation: string;
  confidence: number;
}

const EDGES: EdgeSeed[] = [
  {
    source: "Ley 25.675",
    target: "Ley 1.236",
    relationType: "relacionada_con",
    explanation:
      "La Ley General del Ambiente establece presupuestos mínimos que la Ciudad desarrolla en su política ambiental local.",
    confidence: 0.9,
  },
];

function getOrCreateJurisdiction(
  database: SqliteDatabase,
  input: { code: string; name: string; type: "country" | "province" | "other"; parentId?: string },
): string {
  const existing = database
    .prepare("SELECT id FROM jurisdictions WHERE code = ?")
    .get(input.code) as { id: string } | undefined;
  if (existing) return existing.id;
  return createJurisdiction(database, input);
}

function getOrCreateSource(
  database: SqliteDatabase,
  input: { type: "pdf" | "official_bulletin" | "official_publication" | "external_reference" | "import"; title: string; citation?: string },
): string {
  const existing = database
    .prepare("SELECT id FROM sources WHERE title = ?")
    .get(input.title) as { id: string } | undefined;
  if (existing) return existing.id;
  return createSource(database, input);
}

function getOrCreateNode(
  database: SqliteDatabase,
  input: Parameters<typeof createNode>[1],
): LawNodeRecord {
  const existing = findNode(database, input.nodeType, input.name, input.jurisdictionId);
  if (existing) return existing;
  return createNode(database, input);
}

function getOrCreateDocument(
  database: SqliteDatabase,
  input: Parameters<typeof createDocument>[1],
): { id: string } {
  if (input.officialIdentifier) {
    const existing = database
      .prepare("SELECT id FROM documents WHERE official_identifier = ? AND version = 1")
      .get(input.officialIdentifier) as { id: string } | undefined;
    if (existing) return existing;
  }
  return createDocument(database, input);
}

function seed(): void {
  const database = openDatabase(
    process.env.DATABASE_URL ?? "sqlite:./storage/law-analyzer.db",
  );

  try {
    const argentinaId = getOrCreateJurisdiction(database, {
      ...ARGENTINA,
      type: "country",
    });

    const jurisdictionIds = new Map<string, string>();
    jurisdictionIds.set("AR", argentinaId);
    for (const province of PROVINCES) {
      jurisdictionIds.set(
        province.code,
        getOrCreateJurisdiction(database, {
          ...province,
          type: "province",
          parentId: argentinaId,
        }),
      );
    }

    const nationalBulletinId = getOrCreateSource(database, {
      type: "official_bulletin",
      title: "Boletín Oficial de la República Argentina",
    });
    const provincialBulletins = new Map<string, string>();
    for (const province of PROVINCES) {
      provincialBulletins.set(
        province.code,
        getOrCreateSource(database, {
          type: "official_bulletin",
          title: `Boletín Oficial de la Provincia de ${province.name}`,
        }),
      );
    }

    const importBatchId = createImportBatch(database, {
      metadata: { name: "seed-leyes-nacionales-provinciales", count: NATIONAL_LAWS.length + PROVINCIAL_LAWS.length },
    });

    const allLaws = [...NATIONAL_LAWS, ...PROVINCIAL_LAWS];
    const nodeByIdentifier = new Map<string, LawNodeRecord>();

    for (const law of allLaws) {
      const jurisdictionId = jurisdictionIds.get(law.jurisdictionCode);
      if (!jurisdictionId) throw new Error(`Jurisdicción desconocida: ${law.jurisdictionCode}`);
      const sourceId =
        law.documentType === "national_law"
          ? nationalBulletinId
          : provincialBulletins.get(law.jurisdictionCode);
      if (!sourceId) throw new Error(`Fuente desconocida: ${law.jurisdictionCode}`);

      const document = getOrCreateDocument(database, {
        title: law.title,
        documentType: law.documentType,
        jurisdictionId,
        originalFileName: `${law.officialIdentifier.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
        filePath: `storage/seed/${law.officialIdentifier.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
        officialIdentifier: law.officialIdentifier,
        status: "ready",
        textOrigin: "official",
        sourceId,
        importBatchId,
        effectiveFrom: new Date(law.effectiveFrom),
        uploadedBy: "seed",
      });

      const node = getOrCreateNode(database, {
        nodeType: law.documentType,
        name: law.title,
        description: law.description,
        jurisdictionId,
        officialIdentifier: law.officialIdentifier,
        sourceId,
        validationStatus: "pending",
        createdBy: "seed",
      });

      nodeByIdentifier.set(law.officialIdentifier, node);
      console.log(`[document] ${law.officialIdentifier} (${document.id})`);
      console.log(`[node] ${law.officialIdentifier} (${node.id})`);
    }

    let createdEdges = 0;
    for (const edge of EDGES) {
      const source = nodeByIdentifier.get(edge.source);
      const target = nodeByIdentifier.get(edge.target);
      if (!source || !target) continue;

      const existing = database
        .prepare(
          "SELECT id FROM edges WHERE source_node_id = ? AND target_node_id = ? AND relation_type = ? AND is_active = 1",
        )
        .get(source.id, target.id, edge.relationType) as { id: string } | undefined;
      if (existing) continue;

      createEdge(database, {
        sourceNodeId: source.id,
        targetNodeId: target.id,
        relationType: edge.relationType,
        explanation: edge.explanation,
        confidence: edge.confidence,
        provenance: "suggested",
        createdBy: "seed",
      });
      createdEdges += 1;
      console.log(
        `[edge] ${edge.source} -${edge.relationType}-> ${edge.target}`,
      );
    }

    updateImportBatch(database, importBatchId, "completed");

    console.log(
      `\nSeed completado: ${NATIONAL_LAWS.length} leyes nacionales, ${PROVINCIAL_LAWS.length} leyes provinciales, ${createdEdges} aristas nuevas.`,
    );
  } finally {
    closeDatabase(database);
  }
}

seed();
