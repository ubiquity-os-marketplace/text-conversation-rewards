import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "node:path";

export async function openDb() {
  return open({
    filename: path.resolve(__dirname, "./database.db"),
    driver: sqlite3.cached.Database,
  });
}
