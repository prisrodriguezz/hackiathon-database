import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Database } from "bun:sqlite";

export interface SqliteStatement {
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): unknown;
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

class BunSqliteDatabase implements SqliteDatabase {
  private readonly database: Database;

  constructor(path: string) {
    this.database = new Database(path);
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  prepare(sql: string): SqliteStatement {
    const statement = this.database.query(sql);
    return {
      all: (...parameters) => statement.all(...(parameters as never[])),
      get: (...parameters) => statement.get(...(parameters as never[])),
      run: (...parameters) => statement.run(...(parameters as never[])),
    };
  }

  close(): void {
    this.database.close();
  }
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }

  return url;
}

export function getDatabasePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:" || databaseUrl === "sqlite::memory:") {
    return ":memory:";
  }

  let value = databaseUrl;
  if (value.startsWith("sqlite:")) {
    value = value.slice("sqlite:".length);
  }

  if (value.startsWith("file:")) {
    value = decodeURIComponent(value.slice("file:".length));
  }

  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function defaultMigrationDirectory(): string {
  const candidates = [
    resolve(process.cwd(), "migrations"),
    resolve(process.cwd(), "packages/database/migrations"),
    resolve(process.cwd(), "../../migrations"),
    resolve(process.cwd(), "../../packages/database/migrations"),
  ];
  const directory = candidates.find((candidate) => existsSync(candidate));
  if (!directory) {
    throw new Error("Database migrations directory was not found");
  }
  return directory;
}

export function migrateDatabase(
  database: SqliteDatabase,
  migrationDirectory = defaultMigrationDirectory(),
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    (
      database.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: number;
      }>
    ).map((row) => row.version),
  );
  const migrations = readdirSync(migrationDirectory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => ({
      name,
      version: Number(name.match(/^\d+/)?.[0]),
    }))
    .sort((left, right) => left.version - right.version);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const sql = readFileSync(
      resolve(migrationDirectory, migration.name),
      "utf8",
    );
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
        .run(migration.version, migration.name);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function openDatabase(databaseUrl = getDatabaseUrl()): SqliteDatabase {
  const databasePath = getDatabasePath(databaseUrl);
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new BunSqliteDatabase(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (databasePath !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL");
  }
  migrateDatabase(database);
  return database;
}

export const createDatabase = openDatabase;

export function closeDatabase(database: SqliteDatabase): void {
  database.close();
}

export function backupDatabase(
  database: SqliteDatabase,
  destination: string,
): string {
  const backupPath = isAbsolute(destination)
    ? destination
    : resolve(process.cwd(), destination);
  mkdirSync(dirname(backupPath), { recursive: true });
  database.prepare("VACUUM INTO ?").run(backupPath);
  return backupPath;
}

export function withTransaction<T>(
  database: SqliteDatabase,
  callback: () => T,
): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
