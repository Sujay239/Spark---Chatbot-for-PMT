const SECRET_KEY = /(authorization|api[-_]?key|token|secret|password|cookie)/i;
const SECRET_VALUE = /(sk[-_][A-Za-z0-9_-]{16,}|bearer\s+[A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})/i;
export function redact(value, key='') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? '[REDACTED]' : value;
  if (Array.isArray(value)) return value.map(v => redact(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, redact(v,k)]));
  return value;
}
export function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function containsLikelySecret(text='') { return SECRET_VALUE.test(String(text)); }

export function redactUrl(input='') { try { const u=new URL(String(input)); for (const k of [...u.searchParams.keys()]) if (SECRET_KEY.test(k)) u.searchParams.set(k,'[REDACTED]'); return u.toString(); } catch { return String(input); } }
