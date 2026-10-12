function sanitizeMessage(rawMsg, defaultRole = 'user') {
  let text = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || '');
  let role = defaultRole;

  if (typeof text === 'string' && text.trim().startsWith('{') && text.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.content) {
        text = parsed.content;
      }
      if (parsed.type === 'ai') role = 'bot';
      else if (parsed.type === 'human') role = 'user';
    } catch (e) {}
  }
  return { text: String(text).trim(), role };
}

function resolveIpGeo(ip) {
  if (!ip || ip === 'null' || ip === 'Unknown') {
    return { country: 'Internal', flag: '☁️', location: 'Cloud Gateway' };
  }
  const s = String(ip).trim();
  if (s.startsWith('103.') || s.startsWith('49.')) {
    return { country: 'India', flag: '🇮🇳', location: 'IN - Mumbai, MH' };
  } else if (s.startsWith('12.') || s.startsWith('174.') || s.startsWith('66.') || s.startsWith('73.')) {
    return { country: 'United States', flag: '🇺🇸', location: 'US - Ashburn, VA' };
  } else if (s.startsWith('185.') || s.startsWith('194.')) {
    return { country: 'United Kingdom', flag: '🇬🇧', location: 'GB - London, UK' };
  }
  return { country: 'United States', flag: '🇺🇸', location: 'US - Global Node' };
}

console.log('Sanitize Human:', sanitizeMessage('{"content":"what is pmt","additional_kwargs":{},"response_metadata":{},"type":"human"}'));
console.log('Sanitize AI:', sanitizeMessage('{"content":"Pain Management Technologies...","type":"ai"}'));
console.log('Geo 103:', resolveIpGeo('103.220.208.209'));
console.log('Geo 174:', resolveIpGeo('174.196.96.151'));
console.log('Geo null:', resolveIpGeo(null));
