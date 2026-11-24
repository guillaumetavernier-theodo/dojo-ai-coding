import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SQL_DIR = path.join(__dirname, "..", "..", "..", "legacy", "sql");

/** Base en mémoire rejouant le schéma, le seed et les triggers du legacy (tests seulement). */
export function seededDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(path.join(SQL_DIR, file), "utf8"));
  }
  return db;
}
