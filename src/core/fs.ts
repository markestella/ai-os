import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export async function write(path: string, content: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  await Bun.write(path, content);
}

export async function read(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }
  return await file.text();
}

export async function exists(path: string): Promise<boolean> {
  return await Bun.file(path).exists();
}

export async function readJSON<T = unknown>(path: string): Promise<T> {
  const raw = await read(path);
  return JSON.parse(raw) as T;
}

export async function writeJSON(path: string, data: unknown) {
  await write(path, JSON.stringify(data, null, 2));
}