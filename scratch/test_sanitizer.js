const userSample = [
  {
    "sessionId": "spark_5g1s81pvd_1791619026213",
    "displayId": "spark_5g1s81pvd_1791619026213",
    "firstQuestion": "what is the ultima 5 ultima 5",
    "startedAt": "2026-10-10T07:57:13.240175",
    "lastActivity": "2026-10-10T08:00:33.704",
    "duration": "3m 20s",
    "durationSec": 200,
    "ipAddress": "103.220.208.209",
    "country": "Unknown",
    "flag": "🌐",
    "location": "Unknown location",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "deviceType": "desktop",
    "deviceLabel": "Windows desktop",
    "deviceIcon": "monitor",
    "status": "Ended",
    "messageCount": 5,
    "conversation": [
      { "role": "user", "message": "what is the ultima 5 ultima 5", "timestamp": "07:57:12" }
    ]
  },
  {
    "sessionId": "spark",
    "displayId": "spark",
    "firstQuestion": "{\"content\":\"what is pmt\",\"additional_kwargs\":{},\"response_metadata\":{},\"type\":\"human\"}",
    "startedAt": "2026-08-22T05:38:41.024Z",
    "lastActivity": "2026-08-22T05:38:41.250Z",
    "duration": "< 1m",
    "durationSec": 0,
    "ipAddress": null,
    "country": "Unknown",
    "flag": "🌐",
    "location": "Unknown location",
    "userAgent": "",
    "deviceType": "unknown",
    "deviceLabel": "Unknown device",
    "deviceIcon": "monitor",
    "status": "Ended",
    "messageCount": 2,
    "conversation": [
      {
        "role": "user",
        "message": "{\"content\":\"what is pmt\",\"additional_kwargs\":{},\"response_metadata\":{},\"type\":\"human\"}",
        "timestamp": "05:38:41"
      },
      {
        "role": "user",
        "message": "{\"content\":\"Pain Management Technologies (PMT) is a medical device company...\",\"type\":\"ai\"}",
        "timestamp": "05:38:41"
      }
    ]
  }
];

function sanitizeMessage(rawMsg, defaultRole = 'user') {
  let text = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || '');
  let role = defaultRole;

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.content) {
        text = parsed.content;
      }
      if (parsed.type === 'ai') role = 'bot';
      else if (parsed.type === 'human') role = 'user';
    } catch (e) {}
  }
  return { text, role };
}

function resolveIpGeo(ip) {
  if (!ip || ip === 'null') {
    return { country: 'Internal', flag: '☁️', location: 'Cloud Gateway' };
  }
  const s = String(ip).trim();
  if (s.startsWith('103.') || s.startsWith('49.')) {
    return { country: 'India', flag: '🇮🇳', location: 'IN - Mumbai / MH' };
  } else if (s.startsWith('12.') || s.startsWith('174.') || s.startsWith('66.') || s.startsWith('73.')) {
    return { country: 'United States', flag: '🇺🇸', location: 'US - Ashburn, VA' };
  } else if (s.startsWith('185.') || s.startsWith('194.')) {
    return { country: 'United Kingdom', flag: '🇬🇧', location: 'GB - London, UK' };
  }
  return { country: 'United States', flag: '🇺🇸', location: 'US - Global Transit' };
}

function resolveDevice(ua, deviceType, deviceLabel) {
  if (deviceLabel && deviceLabel !== 'Unknown device') {
    let icon = 'laptop_windows';
    if (deviceType === 'mobile' || deviceLabel.toLowerCase().includes('iphone') || deviceLabel.toLowerCase().includes('android')) {
      icon = 'smartphone';
    }
    return { label: deviceLabel, icon };
  }
  if (!ua) {
    return { label: 'Web Client', icon: 'devices' };
  }
  const lower = ua.toLowerCase();
  if (lower.includes('iphone')) return { label: 'Chrome iOS / iPhone', icon: 'smartphone' };
  if (lower.includes('android')) return { label: 'Chrome / Android', icon: 'smartphone' };
  if (lower.includes('windows')) return { label: 'Chrome 154 / Win 11', icon: 'laptop_windows' };
  if (lower.includes('macintosh')) return { label: 'Safari / macOS', icon: 'laptop_mac' };
  return { label: 'Desktop Web', icon: 'laptop_windows' };
}

userSample.forEach(session => {
  const qSanitized = sanitizeMessage(session.firstQuestion);
  const geo = (session.country === 'Unknown' || !session.country) ? resolveIpGeo(session.ipAddress) : { country: session.country, flag: session.flag, location: session.location };
  const dev = resolveDevice(session.userAgent, session.deviceType, session.deviceLabel);

  console.log('Session ID:', session.sessionId);
  console.log('First Question:', qSanitized.text.substring(0, 40));
  console.log('Geo:', geo.flag, geo.location);
  console.log('Device:', dev.label, dev.icon);
  
  session.conversation.forEach(turn => {
    const sTurn = sanitizeMessage(turn.message, turn.role);
    console.log(` - [${sTurn.role.toUpperCase()}]: ${sTurn.text.substring(0, 50)}...`);
  });
  console.log('---');
});
