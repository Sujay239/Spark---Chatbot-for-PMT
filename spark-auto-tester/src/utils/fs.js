import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
export async function listFilesRecursive(root) {
  const out=[];
  try {
    for (const entry of await fs.readdir(root, { withFileTypes:true })) {
      const p=path.join(root, entry.name);
      if (entry.isDirectory()) out.push(...await listFilesRecursive(p));
      else if (entry.isFile()) out.push(p);
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return out;
}
export async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
