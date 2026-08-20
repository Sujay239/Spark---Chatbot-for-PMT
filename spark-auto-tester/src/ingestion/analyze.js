import { readInputs } from './read-inputs.js';
import { buildSystemSpec } from '../knowledge/build-spec.js';
import { writeJson } from '../utils/fs.js';
import path from 'node:path';
export async function analyzeInputs(config) {
  const inputs=await readInputs(config); const spec=buildSystemSpec(inputs);
  await writeJson(path.join(config.root,'artifacts','system-spec.json'),spec);
  return spec;
}
