const fs = require('fs');

// Domain whitelist of valid medical / electrotherapy terms, acronyms, and names
const DOMAIN_WHITELIST = new Set([
  "tens", "ems", "ifc", "nmes", "microcurrent", "galvanic", "transcutaneous",
  "interferential", "electrotherapy", "electrodes", "electrode", "leadwires",
  "leadwire", "rechargeable", "u5", "u1", "u11", "u20", "u3t", "jstim", "qfiber",
  "pmt", "thermotech", "thermacycle", "theratrac", "theralamp", "thermorelief",
  "neuropathy", "sciatica", "fibromyalgia", "lumbago", "arthritis", "contraindication",
  "contraindications", "waveform", "waveforms", "hz", "hertz", "microseconds"
]);

function isNonEnglish(text) {
  if (!text) return false;

  // 1. Non-Latin scripts (Cyrillic, Arabic, CJK, Devanagari, Hebrew, Greek, Thai)
  const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0900-\u097F\u0590-\u05FF\u0370-\u03FF\u0E00-\u0E7F]/;
  if (nonLatinRegex.test(text)) {
    return true;
  }

  // 2. Distinctive Spanish / French / German / Portuguese / Italian greeting and question markers
  const foreignPhrases = [
    /¿|¡/,
    /\b(hola|buenos dias|buenas tardes|buenas noches|como estas|cómo estás|que es|qué es|donde esta|dónde está|para que sirve|para qué sirve|gracias|por favor|ayuda me|ayudame|dolor de|cuanto cuesta|cuánto cuesta)\b/i,
    /\b(bonjour|bonsoir|comment ca va|comment ça va|merci|s'il vous plait|s'il vous plaît|aidez-moi|pourquoi|combien coute|combien coûte)\b/i,
    /\b(guten tag|guten morgen|hallo wie|danke schon|danke schön|bitte hilfe|wie funktioniert|wie viel kostet)\b/i,
    /\b(olá|bom dia|boa tarde|obrigado|por favor me ajude|como funciona|quanto custa)\b/i,
    /\b(ciao come|buongiorno|grazie mille|per favore|come funziona|quanto costa)\b/i
  ];

  return foreignPhrases.some(regex => regex.test(text));
}

function isGibberishOrKeyboardMash(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Symbols only or punctuation only
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return true;
  }

  // Check random casing inside single words (e.g. fuihDfuhnsDIO, gfjpISDJgfpisSDJGF)
  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length === 0) continue;
    if (DOMAIN_WHITELIST.has(cleanWord.toLowerCase())) continue;

    // 1. Extreme mixed case inside a word (e.g., fuihDfuhnsDIO, gfjpISDJgfpisSDJGF)
    let caseTransitions = 0;
    for (let i = 0; i < cleanWord.length - 1; i++) {
      const isCurrUpper = cleanWord[i] === cleanWord[i].toUpperCase();
      const isNextUpper = cleanWord[i + 1] === cleanWord[i + 1].toUpperCase();
      if (isCurrUpper !== isNextUpper) {
        caseTransitions++;
      }
    }
    if (cleanWord.length >= 7 && caseTransitions >= 3) {
      return true;
    }

    // 2. Consonant clusters >= 6 in a row (e.g. "sdfghjk", "gfpisdjgf")
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleanWord)) {
      return true;
    }

    // 3. Long word (>= 6 chars) with zero vowels
    if (cleanWord.length >= 6 && !/[aeiouy]/i.test(cleanWord)) {
      return true;
    }

    // 4. Repeated character sequence 4+ times (e.g. "aaaaaa", "asdfasdfasdf")
    if (/(.)\1{4,}/.test(cleanWord) || /([a-zA-Z]{2,4})\1{3,}/.test(cleanWord)) {
      return true;
    }

    // 5. Very low vowel-to-consonant ratio in long words (>= 8 chars with < 15% vowels)
    if (cleanWord.length >= 8) {
      const vowels = (cleanWord.match(/[aeiouy]/gi) || []).length;
      const ratio = vowels / cleanWord.length;
      if (ratio < 0.13) {
        return true;
      }
    }
  }

  return false;
}

// Test cases
const testCases = [
  // User's exact screenshot gibberish
  { text: "fuihDfuhnsDIO gfjpISDJgfpisSDJGF", expectGibberish: true, expectLang: false },
  { text: "asdfghjkl;", expectGibberish: true, expectLang: false },
  { text: "zzzzzzzzzzzz", expectGibberish: true, expectLang: false },
  { text: "qwrtypksdfgh", expectGibberish: true, expectLang: false },
  { text: "???", expectGibberish: true, expectLang: false },
  { text: "!!!", expectGibberish: true, expectLang: false },
  
  // Non-English
  { text: "Hola, ¿cómo estás? Necesito ayuda con mi dolor", expectGibberish: false, expectLang: true },
  { text: "Bonjour, comment fonctionne cet appareil?", expectGibberish: false, expectLang: true },
  { text: "Привет, как работает этот прибор?", expectGibberish: false, expectLang: true },
  { text: "你好，这个怎么用？", expectGibberish: false, expectLang: true },
  { text: "مرحبا كيف حالك", expectGibberish: false, expectLang: true },
  { text: "Guten Tag, ich brauche Hilfe", expectGibberish: false, expectLang: true },

  // Legitimate user questions & medical terms (MUST BE FALSE for both)
  { text: "What do I get when I buy an Ultima 5?", expectGibberish: false, expectLang: false },
  { text: "how many times a week should I be using this?", expectGibberish: false, expectLang: false },
  { text: "Can I use TENS with a pacemaker?", expectGibberish: false, expectLang: false },
  { text: "I have transcutaneous electrical nerve stimulation unit", expectGibberish: false, expectLang: false },
  { text: "what frequency is best for chronic sciatica?", expectGibberish: false, expectLang: false },
  { text: "wat freqency 4 chronik pane??", expectGibberish: false, expectLang: false },
  { text: "PADS WONT STICK WHAT DO I DO", expectGibberish: false, expectLang: false },
  { text: "Where can I find the Ultima Neo User Manual?", expectGibberish: false, expectLang: false },
  { text: "Is IFC or microcurrent better for knee pain?", expectGibberish: false, expectLang: false },
  { text: "What is JStim or QFiber?", expectGibberish: false, expectLang: false }
];

console.log("RUNNING GUARDRAIL TESTS...\n");
let failed = 0;
for (const tc of testCases) {
  const g = isGibberishOrKeyboardMash(tc.text);
  const l = isNonEnglish(tc.text);
  const pass = (g === tc.expectGibberish && l === tc.expectLang);
  if (!pass) {
    failed++;
    console.error(`❌ FAIL: "${tc.text}" -> got gibberish=${g} (expected ${tc.expectGibberish}), lang=${l} (expected ${tc.expectLang})`);
  } else {
    console.log(`✅ PASS: "${tc.text}" -> gibberish=${g}, nonEnglish=${l}`);
  }
}

console.log(`\nResults: ${testCases.length - failed} / ${testCases.length} passed.`);
