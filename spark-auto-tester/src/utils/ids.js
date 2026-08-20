import crypto from 'node:crypto';
export function runId(now=new Date()) {
  return now.toISOString().replace(/[:.]/g,'-');
}
export function testId(index) { return `TEST-${String(index+1).padStart(5,'0')}`; }
export function stableId(prefix, text) {
  return `${prefix}-${crypto.createHash('sha256').update(String(text)).digest('hex').slice(0,12)}`;
}
