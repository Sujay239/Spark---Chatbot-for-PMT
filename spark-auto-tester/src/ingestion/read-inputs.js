import path from 'node:path';
import { listFilesRecursive } from '../utils/fs.js';
import { parseFile } from './parsers.js';
import { containsLikelySecret } from '../utils/security.js';
import crypto from 'node:crypto';

export async function readInputs(config) {
  const sections={};
  for (const [kind,dirs] of Object.entries(config.input)) {
    sections[kind]=[];
    for (const rel of dirs) for (const file of await listFilesRecursive(path.resolve(config.root,rel))) {
      const parsed=await parseFile(file);
      sections[kind].push({kind,file:path.relative(config.root,file),...parsed,sha256:crypto.createHash('sha256').update(parsed.raw).digest('hex'),containsLikelySecret:containsLikelySecret(parsed.raw)});
    }
  }
  return sections;
}
