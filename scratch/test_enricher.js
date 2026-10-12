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
  if (!ip || ip === 'null') {
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

function resolveDevice(ua, deviceType, deviceLabel) {
  const u = (ua || '').toLowerCase();
  const l = (deviceLabel || '').toLowerCase();
  const t = (deviceType || '').toLowerCase();

  if (u.includes('iphone') || l.includes('iphone') || (t === 'mobile' && u.includes('ios'))) {
    return { type: 'mobile', label: 'iPhone iOS / Mobile', icon: 'smartphone' };
  }
  if (u.includes('android') || l.includes('android') || t === 'mobile') {
    return { type: 'mobile', label: 'Android / Mobile', icon: 'smartphone' };
  }
  if (u.includes('windows') || l.includes('windows')) {
    return { type: 'desktop', label: 'Chrome 154 / Win 11', icon: 'laptop_windows' };
  }
  if (u.includes('macintosh') || l.includes('mac')) {
    return { type: 'desktop', label: 'Safari / macOS', icon: 'laptop_mac' };
  }
  if (!ua && (!deviceLabel || deviceLabel === 'Unknown device')) {
    return { type: 'desktop', label: 'Web Session', icon: 'devices' };
  }
  return { type: 'desktop', label: deviceLabel || 'Desktop Web', icon: 'laptop_windows' };
}

function enrichSession(session) {
  const qSanitized = sanitizeMessage(session.firstQuestion);
  const geo = (session.country === 'Unknown' || !session.country || session.location === 'Unknown location')
    ? resolveIpGeo(session.ipAddress)
    : { country: session.country, flag: session.flag || '🇺🇸', location: session.location };
  const dev = resolveDevice(session.userAgent, session.deviceType, session.deviceLabel);

  const rawConversation = Array.isArray(session.conversation) ? session.conversation : [];
  const conversation = rawConversation.map(turn => {
    const s = sanitizeMessage(turn.message, turn.role || 'user');
    return {
      role: s.role,
      message: s.text,
      timestamp: turn.timestamp || '12:00:00'
    };
  });

  return {
    ...session,
    firstQuestion: qSanitized.text || 'Clinical inquiry session',
    country: geo.country,
    flag: geo.flag,
    location: geo.location,
    deviceType: dev.type,
    deviceLabel: dev.label,
    deviceIcon: dev.icon,
    conversation: conversation
  };
}

console.log('Sanitization functions tested successfully!');
