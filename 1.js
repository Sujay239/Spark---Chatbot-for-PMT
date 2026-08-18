// ================= INPUT =================
const userQuestion =
  $json.query?.chatInput || $input.first()?.json?.query?.chatInput || "";
const sessionId =
  $json.query?.sessionId || $input.first()?.json?.query?.sessionId || "";

// ================= CODE-LEVEL GUARDRAILS (NO LLM NEEDED) =================
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
  if (nonLatinRegex.test(text)) return true;

  // 2. Distinctive non-English phrases/words
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
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return true;

  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length === 0) continue;
    if (DOMAIN_WHITELIST.has(cleanWord.toLowerCase())) continue;

    // 1. Extreme mixed case inside a single word (e.g. fuihDfuhnsDIO, gfjpISDJgfpisSDJGF)
    let caseTransitions = 0;
    for (let i = 0; i < cleanWord.length - 1; i++) {
      const isCurrUpper = cleanWord[i] === cleanWord[i].toUpperCase();
      const isNextUpper = cleanWord[i + 1] === cleanWord[i + 1].toUpperCase();
      if (isCurrUpper !== isNextUpper) caseTransitions++;
    }
    if (cleanWord.length >= 7 && caseTransitions >= 3) return true;

    // 2. Consonant clusters >= 6 in a row
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleanWord)) return true;

    // 3. Long word (>= 6 chars) with zero vowels
    if (cleanWord.length >= 6 && !/[aeiouy]/i.test(cleanWord)) return true;

    // 4. Repeated character sequence 4+ times
    if (/(.)\1{4,}/.test(cleanWord) || /([a-zA-Z]{2,4})\1{3,}/.test(cleanWord)) return true;

    // 5. Very low vowel-to-consonant ratio in long words (>= 8 chars with < 13% vowels)
    if (cleanWord.length >= 8) {
      const vowels = (cleanWord.match(/[aeiouy]/gi) || []).length;
      if (vowels / cleanWord.length < 0.13) return true;
    }
  }
  return false;
}

// Intercept non-English language queries directly in code
if (isNonEnglish(userQuestion)) {
  return [
    {
      json: {
        match: true,
        matchIndex: -1,
        normalizedQuestion: userQuestion,
        similarityScore: 1.0,
        sessionId: sessionId,
        output: "Matched with defined questions. Please see the details below",
        matched_question: "__LANGUAGE_NOT_SUPPORTED__",
        direct_answer: "I can only assist you in English. Please ask your question in English."
      }
    }
  ];
}

// Intercept gibberish / keyboard mash / severe typos directly in code
if (isGibberishOrKeyboardMash(userQuestion)) {
  return [
    {
      json: {
        match: true,
        matchIndex: -1,
        normalizedQuestion: userQuestion,
        similarityScore: 1.0,
        sessionId: sessionId,
        output: "Matched with defined questions. Please see the details below",
        matched_question: "__TYPO_DETECTED__",
        direct_answer: "Typo detected. Please check your question and try again."
      }
    }
  ];
}

// ================= GOOGLE SHEET DYNAMIC QUESTIONS =================
let sheetQuestions = [];
let cacheSource = 'none';
try {
  // 1. Try static data first
  try {
    const staticData = $getWorkflowStaticData('global');
    sheetQuestions = staticData.sheetQuestions || [];
    if (sheetQuestions.length > 0) {
      cacheSource = 'staticData';
    }
  } catch (err) {
    // Ignore static data error
  }

  // 2. If static data is empty, try file cache
  if (!sheetQuestions || sheetQuestions.length === 0) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const cachePath = path.join(os.tmpdir(), 'n8n_sheet_questions_cache.json');
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      sheetQuestions = cacheData.questions || [];
      if (sheetQuestions.length > 0) {
        cacheSource = 'fileCache';
      }
    }
  }
} catch (e) {
  // Fallback
}

// ================= PREDEFINED QUESTIONS =================
const hardcodedQuestions = [
  "contact info",
  "How can I contact Pain Management Technologies?",
  "What is the phone number and email for PMT customer support?",
  "Where can I find the Ultima 5 User Manual?",
  "Where can I download the Ultima 1 User Manual?",
  "Where can I download the Ultima 11 User Manual?",
  "Where can I download the Ultima 20 User Manual?",
  "Where can I find the Ultima Neo User Manual?",
  "Where can I find instructions for Thermotech?",
  "Where can I find the Soft Cycle instructions?",
  "Where can I find the TENS Electrode Placement Chart?",
  "How do I pair a Thermacycle remote control?",
  "Where can I find PMT forms like ARS, JStim, or TENS CMN forms?",
  "Where can I find educational guides for microcurrent, Galvanic, or IF devices?",
  "Where can I view PMT product catalog or product pages?",
  "Where can I find video demonstrations for PMT devices?",
  "How does a TENS unit work?",
  "What does a TENS unit feel like?",
  "What does a TENS unit actually do?",
  "Does TENS help reduce inflammation?",
  "How long does it take to feel relief?",
  "Can I use a TENS unit every day?",
  "How often should I use a TENS unit?",
  "Where should I place the pads for lower back pain?",
  "Where do I put the pads for neck pain?",
  "Can I place the pads directly over where the pain is?",
  "Can the pads touch each other?",
  "How far apart should the pads be?",
  "Can I use more than one channel at a time?",
  "Which mode should I use?",
  "What frequency is best for chronic pain?",
  "What frequency works best for acute pain?",
  "How high should I turn up the intensity?",
  "Should the stimulation feel strong or gentle?",
  "Why does the sensation fade after a few minutes?",
  "What pain conditions does TENS help with?",
  "Is it safe to use a TENS unit while sleeping?",
  "Can I wear a TENS unit all day?",
  "Can I use TENS with a pacemaker?",
  "Is a TENS unit safe to use during pregnancy?",
  "Can I use a TENS unit if I have diabetes?",
  "Can I use a TENS unit if I have metal implants?",
  "Where should I never place TENS pads?",
  "Can I drive while using a TENS unit?",
  "How long do TENS pads last?",
  "Why won't my pads stick anymore?",
  "How do I make my pads sticky again?",
  "Can I wash or clean electrode pads?",
  "Are generic pads compatible with my unit?",
  "What pads are compatible with my unit?",
  "What's the difference between 2 inch and 4 inch pads?",
  "How do I know which pads are best for me?",
  "Why isn't my TENS unit producing sensation?",
  "Why is only one pad working?",
  "Why does the stimulation feel sharp instead of comfortable?",
  "Why does my skin turn red after treatment?",
  "Why does my unit keep turning off?",
  "Why does the intensity suddenly decrease?",
  "How long does the battery last?",
  "Should I buy a rechargable batteries?",
  "What's the difference between TENS and EMS?",
  "Can one device do both TENS and EMS?",
  "Does TENS actually work?",
  "Is pain relief immediate or temporary?",
  "Will my body get used to TENS?",
  "Can TENS help me avoid pain medication?",
  "Can TENS speed up healing or does it only mask pain?",
  "What TENS unit is best for home use?",
  "Is a prescription required?",
  "What accessories should I buy with a TENS unit?",
  "What program should I use for my condition?",
  "How many minutes should I do per session?",
  "Can I use TENS more than once a day?",
  "When should I replace the pads?",
  "How do I clean and store the unit?",
  "How do I maximize pain relief?",
  "What are the theories behind how TENS units work?",
  "How should I approach electrode placement?",
  "Is there contradictions with medication?",
  "Why am I not feeling sensation?",
  "Why does the stimulation seem weak?",
  "Stimulation feels sharp or uncomfortable",
  "Why does intensity drop during use?",
  "Why won't my TENS unit turn on?",
  "I am experiencing skin irritation -- why is that?",
  "How do I use a TENS unit, step by step?",
  "What are typical troubleshooting issues with TENS units?",
  "What is the Ultima 5 (U5)?",
  "What comes in my Ultima 5 kit?",
  "What's different between the current Ultima 5 and the earlier model?",
  "What are Soft-Touch electrodes, and why do they matter?",
  "What's the difference between the Soft-Touch Silver and Clinical Grade electrode lines?",
  "What does the Pad Contact Interruption Alarm do on my Ultima 5?",
  "What does the Compliance Monitor track, and why does it matter?",
  "What wave forms does the Ultima 5 offer, and which one should I use?",
  "How do I turn my Ultima 5 on and off?",
  "Why does the intensity reset to zero when I switch modes?",
  "Does my Ultima 5 remember my last settings when I turn it back on?",
  "What is the auto-repeat feature when adjusting pulse rate or pulse width?",
  "How do the intensity knobs work on my Ultima 5?",
  "How do I read the battery level indicator on my Ultima 5?",
  "Does my Ultima 5 automatically shut off if I forget to turn it off?",
  "What is the Lock/Unlock feature, and how do I use it?",
  "What settings should I use for my very first Ultima 5 session?",
  "How far apart should the electrode pads be on my Ultima 5?",
  "Where can I learn more about my Ultima 5?"
];


// Merge: Sheet questions first, then hardcoded (keeping unique ones)
const predefinedQuestions = [...new Set([...sheetQuestions, ...hardcodedQuestions])];

// ================= SYNONYMS =================
const synonyms = {
  // Device / unit names
  "device": "tens unit",
  "unit": "tens unit",
  "machine": "tens unit",
  "stimulator": "tens unit",
  "massager": "tens unit",
  "electrotherapy": "tens unit",
  "e stim": "tens unit",
  "estim": "tens unit",
  "electrical stimulation": "tens unit",

  // Product model synonyms
  "u5": "ultima 5",
  "u 5": "ultima 5",
  "u1": "ultima 1",
  "u 1": "ultima 1",
  "u11": "ultima 11",
  "u 11": "ultima 11",
  "u20": "ultima 20",
  "u 20": "ultima 20",
  "u3t": "ultima 3t",
  "u 3t": "ultima 3t",
  "neo": "ultima neo",

  // Electrode / pad synonyms
  "pads": "electrodes",
  "pad": "electrodes",
  "electrode": "electrodes",
  "patch": "electrodes",
  "patches": "electrodes",
  "gelpad": "electrodes",
  "gelpads": "electrodes",
  "stickers": "electrodes",
  "sticker": "electrodes",
  "sticky pads": "electrodes",

  // Lead wire synonyms
  "wires": "lead wires",
  "wire": "lead wires",
  "lead": "lead wires",
  "leads": "lead wires",
  "cable": "lead wires",
  "cables": "lead wires",
  "cord": "lead wires",
  "cords": "lead wires",
  "connector": "lead wires",
  "connectors": "lead wires",

  // Intensity / strength synonyms
  "strength": "intensity",
  "level": "intensity",
  "amplitude": "intensity",
  "volume": "intensity",
  "strong": "intensity",
  "stronger": "intensity",
  "weaker": "intensity",
  "weak": "intensity",

  // Frequency / pulse rate synonyms
  "rate": "frequency",
  "speed": "frequency",
  "hz": "frequency",
  "hertz": "frequency",
  "pulses": "frequency",
  "pulse rate": "frequency",

  // Pulse width synonyms
  "width": "pulse width",
  "microseconds": "pulse width",
  "us": "pulse width",

  // Time / relief synonyms (paraphrase support)
  "soon": "quickly",
  "fast": "quickly",
  "rapid": "quickly",
  "quickly": "quickly",
  "difference": "relief",
  "benefit": "relief",
  "helping": "relief",
  "improvement": "relief",
  "notice": "feel",

  // Medical term synonyms (paraphrase support)
  "surgical hardware": "metal implants",
  "surgical": "metal implants",
  "hardware": "metal implants",
  "screw": "metal implants",
  "plate": "metal implants",
  "rod": "metal implants",
  "joint replacement": "metal implants",
  "red marks": "redness",
  "red mark": "redness",
  "redness": "redness",
  "irritation": "redness",
  "drug": "medication",
  "drugs": "medication",
  "medicine": "medication",
  "medicines": "medication",
  "interaction": "contraindication",
  "interactions": "contraindication",

  // Placement / position synonyms
  "placement": "position",
  "place": "position",
  "location": "position",
  "put": "position",
  "apply": "position",
  "stick": "position",
  "attach": "position",
  "where to put": "position",

  // Pain / discomfort synonyms
  "ache": "pain",
  "soreness": "pain",
  "discomfort": "pain",
  "stiffness": "pain",
  "hurt": "pain",
  "hurts": "pain",
  "hurting": "pain",
  "spasm": "pain",
  "spasms": "pain",
  "cramp": "pain",
  "cramps": "pain",
  "cramping": "pain",
  "tingling": "pain",
  "numbness": "pain",
  "numb": "pain",
  "burning": "pain",
  "throbbing": "pain",
  "sore": "pain",

  // Body part synonyms
  "lower back": "back pain",
  "lumbar": "back pain",
  "lumbago": "back pain",
  "sciatica": "back pain",
  "sciatic": "back pain",
  "kneecap": "knee",
  "knees": "knee",
  "shoulders": "shoulder",
  "cervical": "neck",
  "feet": "foot",
  "ankle": "foot",
  "wrist": "hand",
  "elbow": "arm",
  "hip": "joint",
  "hips": "joint",
  "arthritis": "joint pain",
  "neuropathy": "nerve pain",

  // Battery / power synonyms
  "power": "battery",
  "batteries": "battery",
  "rechargeable": "battery",
  "charging": "battery",
  "charge": "battery",
  "charger": "battery",
  "aa": "battery",
  "lithium": "battery",

  // Mode / program synonyms
  "setting": "mode",
  "settings": "mode",
  "program": "mode",
  "programs": "mode",
  "channel": "mode",
  "channels": "mode",
  "burst": "burst mode",
  "normal": "normal mode",
  "modulation": "modulation mode",
  "continuous": "continuous mode",
  "waveform": "wave form",
  "waveforms": "wave form",

  // Therapy type synonyms
  "ems": "electrical muscle stimulation",
  "ifc": "interferential",
  "interferential": "interferential therapy",
  "galvanic": "galvanic stimulation",
  "russian": "russian stimulation",
  "microcurrent": "micro current",
  "mens": "micro current",

  // Safety / contraindication synonyms
  "side effect": "safety",
  "side effects": "safety",
  "adverse": "safety",
  "risk": "safety",
  "risks": "safety",
  "dangers": "safety",
  "danger": "safety",
  "harmful": "safety",
  "safe": "safety",
  "precaution": "safety",
  "precautions": "safety",
  "caution": "safety",
  "warning": "safety",

  // Contraindication synonyms
  "pacemaker": "contraindications",
  "implant": "contraindications",
  "implants": "contraindications",
  "pregnant": "contraindications",
  "pregnancy": "contraindications",
  "diabetes": "contraindications",
  "diabetic": "contraindications",
  "heart": "contraindications",
  "cardiac": "contraindications",
  "epilepsy": "contraindications",
  "seizure": "contraindications",

  // Warranty / return synonyms
  "guarantee": "warranty",
  "replacement": "warranty",
  "repair": "warranty",
  "return": "warranty",
  "refund": "warranty",
  "defective": "warranty",
  "broken": "warranty",

  // Prescription / insurance synonyms
  "rx": "prescription",
  "doctor": "prescription",
  "physician": "prescription",
  "prescribed": "prescription",
  "coverage": "insurance",
  "reimbursement": "insurance",
  "va": "insurance",
  "veteran": "insurance",
  "medicare": "insurance",
  "medicaid": "insurance",

  // Manual / guide synonyms
  "guide": "user manual",
  "instructions": "user manual",
  "manual": "user manual",
  "pdf": "user manual",
  "documentation": "user manual",
  "booklet": "user manual",
  "quick start": "user manual",

  // Contact / support synonyms
  // NOTE: "help", "support", "service", "call" removed - too generic, corrupts semantic matching
  // These are handled by the INTENT OVERRIDE section instead
  "phone number": "contact info",
  "email address": "contact info",
  "customer service": "contact info",
  "reach out": "contact info",
  "fax": "contact info",

  // Pricing synonyms
  "cost": "pricing",
  "price": "pricing",
  "pay": "pricing",
  "buy": "pricing",
  "purchase": "pricing",
  "order": "pricing",
  "affordable": "pricing",
  "expensive": "pricing",
  "cheap": "pricing",

  // Company synonyms
  "seller": "pmt",
  "company": "pmt",
  "manufacturer": "pmt",
  "brand": "pmt",
  "pain management technologies": "pmt",
  "paintechnology": "pmt",
  "pain technology": "pmt",

  // Accessory synonyms
  "carrying case": "case",
  "pouch": "case",
  "belt clip": "clip",
  "clip": "clip",

  // Troubleshooting synonyms
  "not working": "troubleshooting",
  "broken": "troubleshooting",
  "malfunction": "troubleshooting",
  "problem": "troubleshooting",
  "issue": "troubleshooting",
  "fix": "troubleshooting",
  "reset": "troubleshooting"
};

// ================= STOPWORDS =================
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "i",
  "you",
  "he",
  "she",
  "we",
  "my",
  "your",
  "his",
  "her",
  "our",
  "how",
  "what",
  "why",
  "where",
  "when",
  "who",
  "has",
  "been",
  "hold",
  "u",
  "s",
  "me",
  "about",
  "some",
  "more",
  "much",
  "very",
  "give",
  "get",
  "please",
  "current",
  "go",
  "doing",
  "today",
  "day",
  "hello",
  "hi",
  "hey",
  "there",
  "thanks",
  "thank",
  "yes",
  "no",
  "ok",
  "okay",
]);

// ================= NORMALIZE =================
function normalize(text) {
  if (!text) return "";

  let base = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let words = base.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (synonyms[words[i]]) {
      words[i] = synonyms[words[i]];
    }
  }

  return words.join(" ").trim();
}

// ================= STEM =================
function stem(word) {
  if (!word || word.length <= 3) return word;
  return word.replace(/(ing|ly|ed|er|es|s|ion)$/, "");
}

// ================= TOKENIZE =================
function getTokens(text) {
  const tokens = normalize(text)
    .split(" ")
    .filter((w) => w && !stopWords.has(w))
    .map(stem);
  return [...new Set(tokens)];
}

// ================= LEVENSHTEIN =================
function levenshteinDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + 1,
            );
    }
  }

  return matrix[b.length][a.length];
}

// ================= JACCARD =================
function jaccardScore(a, b) {
  const setA = new Set(getTokens(a));
  const setB = new Set(getTokens(b));

  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  return intersection / union;
}

// ================= IDF PRECALC =================
const docCount = predefinedQuestions.length;
const freqMap = {};

predefinedQuestions.forEach((q) => {
  const uniqueTokens = new Set(getTokens(q));
  uniqueTokens.forEach((t) => {
    freqMap[t] = (freqMap[t] || 0) + 1;
  });
});

const idfWeights = {};
Object.keys(freqMap).forEach((t) => {
  idfWeights[t] = Math.log(docCount / freqMap[t]) + 1.0;
});

// ================= SEMANTIC SCORE =================
function getSemanticScore(input, target) {
  const tokens1 = getTokens(input);
  const tokens2 = getTokens(target);

  if (!tokens1.length || !tokens2.length) return 0;

  let weightedIntersection = 0;
  let totalInputWeight = 0;
  let totalTargetWeight = 0;

  tokens1.forEach((t) => (totalInputWeight += idfWeights[t] || 1.0));
  tokens2.forEach((t) => (totalTargetWeight += idfWeights[t] || 1.0));

  const matched2 = new Set();

  for (let i = 0; i < tokens1.length; i++) {
    const w1 = tokens1[i];
    const w1Weight = idfWeights[w1] || 1.0;

    let bestMatchScore = 0;
    let bestMatchIndex = -1;

    for (let j = 0; j < tokens2.length; j++) {
      if (matched2.has(j)) continue;

      const w2 = tokens2[j];

      if (w1 === w2) {
        bestMatchScore = 1;
        bestMatchIndex = j;
        break;
      }

      if (w1.length >= 4 && w2.length >= 4) {
        const dist = levenshteinDistance(w1, w2);
        const maxLen = Math.max(w1.length, w2.length);
        const similarity = 1 - dist / maxLen;

        if (similarity >= 0.75 && similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatchIndex = j;
        } else if (
          (w1.includes(w2) || w2.includes(w1)) &&
          0.6 > bestMatchScore
        ) {
          bestMatchScore = 0.6;
          bestMatchIndex = j;
        }
      }
    }

    if (bestMatchIndex !== -1) {
      weightedIntersection += bestMatchScore * w1Weight;
      matched2.add(bestMatchIndex);
    }
  }

  const inputCoverage = totalInputWeight
    ? weightedIntersection / totalInputWeight
    : 0;
  const targetCoverage = totalTargetWeight
    ? weightedIntersection / totalTargetWeight
    : 0;

  let finalScore = inputCoverage * 0.7 + targetCoverage * 0.3;

  if (tokens1.length >= 5 && weightedIntersection < 2.0) {
    finalScore *= 0.7;
  }

  return Math.max(0, Math.min(1, finalScore));
}

// ================= FINAL COMBINED SCORE =================
function combinedScore(input, target) {
  const normInput = normalize(input);
  const normTarget = normalize(target);

  const charDist = levenshteinDistance(normInput, normTarget);
  const maxLen = Math.max(normInput.length, normTarget.length, 1);
  const charSimilarity = 1 - charDist / maxLen;

  const semantic = getSemanticScore(input, target);
  const jaccard = jaccardScore(input, target);

  // Weighted final score
  return semantic * 0.55 + jaccard * 0.25 + charSimilarity * 0.2;
}

// ================= MATCH FINDING =================
let bestScore = 0;
let bestIndex = -1;

const sheetQuestionsSet = new Set(sheetQuestions.map(q => q.toLowerCase().trim()));

for (let i = 0; i < predefinedQuestions.length; i++) {
  const q = predefinedQuestions[i];
  let score = combinedScore(userQuestion, q);

  // Prioritize Google Sheet questions by adding a score boost (up to 1.0)
  if (sheetQuestionsSet.has(q.toLowerCase().trim())) {
    score = Math.min(1.0, score + 0.15);
  }

  if (score > bestScore) {
    bestScore = score;
    bestIndex = i;
  }
}

// ================= THRESHOLD =================
// You can tune this between 0.45 and 0.65 depending on strictness
const threshold = 0.5;
let matchFound = bestScore >= threshold;

// ================= PROHIBITED INTENT OVERRIDE =================
const prohibitedKeywords = [
  "joke",
  "poem",
  "write me a",
  "write an email",
  "write a message",
  "how you work",
  "what you can do",
  "what can you do",
  "explain yourself",
  "monitor patients",
  "do you have",
  "do you sell",
];
const isProhibited = prohibitedKeywords.some((keyword) =>
  userQuestion.toLowerCase().includes(keyword),
);

if (isProhibited) {
  matchFound = false;
}

// ================= PRODUCT OVERRIDE =================
const products = ["tens", "ultima", "ultima 1", "ultima 5", "ultima 11", "ultima 20", "ultima 3t", "ultima neo", "electrodes", "lead wires", "battery", "pmt", "thermotech", "thermacycle", "soft cycle", "ucombo", "thermorelief", "theralamp", "aqua relief", "polar vortex", "arctic ice", "theratrac", "jstim", "qfiber"];

if (matchFound && bestScore < 0.85) {
  const normQ = userQuestion.toLowerCase();
  const mentionedProduct = products.find((p) => normQ.includes(p));

  if (mentionedProduct) {
    const isInfoSeeking =
      /(tell me|what is|information|something about|details|explain|more about|more info|what are|how to use|how does it work)/.test(
        normQ,
      );
    const matchedQNorm = predefinedQuestions[bestIndex].toLowerCase();
    const pName = mentionedProduct.replace(/\s+/g, "");
    const matchedHasProduct = matchedQNorm.replace(/\s+/g, "").includes(pName);

    // If it's an info query, or if it incorrectly matched a question about a completely different topic
    if (isInfoSeeking || !matchedHasProduct) {
      matchFound = false;
    }
  }
}

// ================= PARAPHRASE INTENT MATCHING =================
// Catches natural language paraphrases that token-level matching misses
if (!matchFound || bestScore < 0.7) {
  const normQ = userQuestion.toLowerCase();
  const paraphraseMap = [
    // 1. Pacemaker / Cardiac implant (checked before general metal implants)
    {
      patterns: [
        /(pacemaker|cardiac device|defibrillator|icd|implanted cardiac)/i,
        /tens with a pacemaker/i
      ],
      target: "Can I use TENS with a pacemaker?"
    },
    // 2. Relief onset & timeline
    {
      patterns: [
        /how (soon|quickly|fast|long|rapidly).*?(help|relief|work|difference|benefit|feel|notice|start|kick)/i,
        /when.*(start|begin|feel|notice|kick in|take effect)/i,
        /(time|duration).*(relief|help|feel|notice|benefit)/i,
        /(start|begin).*help/i,
        /notice.*(difference|relief|benefit|improvement)/i
      ],
      target: "How long does it take to feel relief?"
    },
    // 3. Metal implants / surgical hardware / titanium
    {
      patterns: [
        /(surgical|metal|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod).*(tens|safe|use|ok|device|problem)/i,
        /tens.*(surgical|metal|implant|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod)/i,
        /use.*(over|with|near).*(surgical|metal|implant|hardware|titanium)/i
      ],
      target: "Can I use a TENS unit if I have metal implants?"
    },
    // 4. Skin redness & irritation / breaking out
    {
      patterns: [
        /(red|redness|mark|marks|irritat|rash|burn|itchy|break|breaking out|skin).*(after|session|treatment|use|every|under|where the pad|where the electrode)/i,
        /skin.*(red|mark|marks|irritat|rash|itchy|break|color)/i,
        /(breaking out|break out).*(electrode|pad|skin)/i,
        /(red mark|red spot|redness).*(bad|normal|worried|concern|ok|okay)/i
      ],
      target: "Why does my skin turn red after treatment?"
    },
    // 5. Treatment / session duration
    {
      patterns: [
        /(recommend|typical|ideal|proper|best|suggested|optimal).*(duration|length|time|long|minute|session)/i,
        /(duration|length|time).*(treatment|session|therapy|recommend)/i,
        /how (long|many minute).*(session|treatment|use|per)/i
      ],
      target: "How many minutes should I do per session?"
    },
    // 6. Drug / medication interactions
    {
      patterns: [
        /(drug|medication|medicine|pharma|prescription).*(interact|contradict|conflict|combine|mix|safe|interfere)/i,
        /(interact|contradict|conflict|interfere).*(drug|medication|medicine|prescription)/i,
        /drug interaction/i,
        /medication.*(safe|ok|concern|worry|interact)/i
      ],
      target: "Is there contradictions with medication?"
    },
    // 7. U5 Waveform options
    {
      patterns: [
        /(wave|waveform).*(option|type|kind|offer|have|available).*(u5|ultima 5)/i,
        /(u5|ultima 5).*(wave|waveform).*(option|type|kind|offer|have)/i,
        /(wave|waveform).*(option|type).*(u5|ultima 5|ultima5)/i
      ],
      target: "What wave forms does the Ultima 5 offer, and which one should I use?"
    },
    // 8. Pad size (small vs big / 2 inch vs 4 inch)
    {
      patterns: [
        /(small pads?|big (ones|pads?)|pad sizes?|size.*(pad|electrode)|which pad.*best|2 inch.*4 inch)/i,
        /(difference|between).*(2 inch|4 inch|small.*big).*pad/i
      ],
      target: "What's the difference between 2 inch and 4 inch pads?"
    },
    // 9. First time use & step by step
    {
      patterns: [
        /(walk me through|how (do|to) use|steps to (set up|run)|first time (user|session|using)|get started).*(tens|device|unit|session|this)/i,
        /(step by step|how to set up).*(tens|session|unit)/i
      ],
      target: "How do I use a TENS unit, step by step?"
    },
    // 10. Does TENS work / Evidence / Placebo
    {
      patterns: [
        /(do tens units? actually (help|work)|real evidence|placebo|actually (help|work) people)/i,
        /(evidence|proof).*(works|effective|placebo)/i
      ],
      target: "Does TENS actually work?"
    },
    // 11. Intensity setting & pain/hurt
    {
      patterns: [
        /(right|proper|correct|ideal|recommended).*(intensity|level|strength|knob)/i,
        /(how high|what intensity|intensity level).*(turn up|set|use)/i,
        /(supposed|meant|should).*(hurt|painful)/i
      ],
      target: "How high should I turn up the intensity?"
    },
    // 12. Pad Contact Interruption Alarm (U5 beeps)
    {
      patterns: [
        /(beep|beeps|beeping|alert|alarm).*(pad|contact|u5|ultima 5)/i,
        /pad contact (alert|alarm|interruption|beep)/i
      ],
      target: "What does the Pad Contact Interruption Alarm do on my Ultima 5?"
    },
    // 13. Usage frequency & schedule
    {
      patterns: [
        /(how often|how many times|how many session|frequency|how many hours).*(day|week|month|daily|weekly|use|using|session)/i,
        /(reasonable|recommended|typical|proper|schedule|usage).*(frequency|times a week|times per week|per day|per week)/i,
        /(can|safe|ok).*(use|wear).*(tens|device|unit|this|it).*(every ?day|daily)/i,
        /(every ?day|daily|weekly).*(use|wear).*(tens|device|unit|this|it)/i
      ],
      target: "How often should I use a TENS unit?"
    },
    // 14. Stinging / Sharp / Uncomfortable sensation
    {
      patterns: [
        /(sting|stinging|bite|biting|sharp|uncomfortable|prick|pricking|pinch).*(instead of|tingle|tingling|feel|stimulation)/i,
        /(sharp|uncomfortable).*(stimulation|sensation|feel)/i
      ],
      target: "Stimulation feels sharp or uncomfortable"
    },
    // 15. Sleep / Overnight use
    {
      patterns: [
        /(overnight|all night|fall asleep|sleeping|while (i|we) sleep).*(tens|device|unit|leave|wear|on|safe|okay)/i,
        /(safe|okay).*(sleep|sleeping|overnight|all night)/i
      ],
      target: "Is it safe to use a TENS unit while sleeping?"
    },
    // 16. What's in the box / U5 kit contents
    {
      patterns: [
        /(what('s| is) (included|in the box|in my kit)|what do i get (when|if) i buy).*(ultima 5|u5|kit)/i,
        /(comes in|included with).*(ultima 5|u5)/i
      ],
      target: "What comes in my Ultima 5 kit?"
    },
    // 17. Placing directly over sore spot / pain area
    {
      patterns: [
        /(directly|right|on top of).*(pain|painful|sore spot|sore area|hurt)/i,
        /pads.*(on top of|over).*(pain|sore spot)/i
      ],
      target: "Can I place the pads directly over where the pain is?"
    },
    // 18. Unit shuts off / powers down mid session
    {
      patterns: [
        /(shuts|turns|powers).*(itself|down|off).*(mid|during|own|automatically)/i,
        /(device|unit).*(turn off|shut off|power down|stops).*(by itself|on its own|mid-session)/i
      ],
      target: "Why does my unit keep turning off?"
    },
    // 19. Swelling & inflammation
    {
      patterns: [
        /(bring down|reduce|help).*(swelling|inflammation|edema)/i,
        /tens.*(swelling|inflammation|edema)/i
      ],
      target: "Does TENS help reduce inflammation?"
    },
    // 20. One pad / one side working
    {
      patterns: [
        /(one (side|channel|pad|lead) works.*(other|second) doesn't|only one (pad|channel|side) (is )?working)/i,
        /one pad working/i
      ],
      target: "Why is only one pad working?"
    },
    // 21. Sensation fading / adaptation / tingling goes away
    {
      patterns: [
        /(tingling|sensation).*(goes away|fades|stops|less|disappear).*(partway|during|after a few minute|normal)/i,
        /(after a few minute.*stop feeling|stop feeling.*after a few minute)/i,
        /(stop working|get used to).*if i use.*(too much|often)/i
      ],
      target: "Why does the sensation fade after a few minutes?"
    },
    // 22. Pads touching / overlapping / separated
    {
      patterns: [
        /(electrodes|pads).*(stay separated|touch|touching|overlap|overlapping)/i,
        /can.*(pads|electrodes).*touch/i,
        /(pads|electrodes).*(separated|overlap)/i
      ],
      target: "Can the pads touch each other?"
    },
    // 23. Prescription / Doctor's note
    {
      patterns: [
        /(doctor('s)? note|rx|prescription.*only|require.*prescription|need a prescription|prescription required)/i,
        /prescription-only/i
      ],
      target: "Is a prescription required?"
    },
    // 24. Dead / won't power up / power button does nothing
    {
      patterns: [
        /(power button.*does nothing|won't (turn|power)|completely dead|won't power up|not powering up|won't turn on)/i,
        /why won't.*turn on/i
      ],
      target: "Why won't my TENS unit turn on?"
    },
    // 25. Neck & shoulder electrode placement
    {
      patterns: [
        /(stiff neck|neck and shoulder|neck pain).*(where|stick|place|pad|electrode|position)/i,
        /(pads?|electrodes?).*(neck|shoulder tension|neck pain)/i
      ],
      target: "Where do I put the pads for neck pain?"
    },
    // 26. All four pads / both channels together
    {
      patterns: [
        /(all four pads|both channels|2 channels|multiple channels).*(at once|together|simultaneously|run both)/i,
        /use more than one channel/i
      ],
      target: "Can I use more than one channel at a time?"
    },
    // 27. Driving / Commute / Behind the wheel
    {
      patterns: [
        /(behind the wheel|commute|drive to work|while driving|operating a vehicle|running on my commute)/i,
        /can i drive/i
      ],
      target: "Can I drive while using a TENS unit?"
    },
    // 28. Pad spacing / gap between pads
    {
      patterns: [
        /(how much gap|gap.*between|spacing between|how far apart|right spacing).*(pads|electrodes)/i,
        /how far apart/i
      ],
      target: "How far apart should the pads be?"
    },
    // 29. Pregnancy / Expecting
    {
      patterns: [
        /(while expecting|pregnant|pregnancy|trimester|weeks pregnant|belly at \d+ weeks)/i,
        /safe.*during pregnancy/i
      ],
      target: "Is a TENS unit safe to use during pregnancy?"
    },
    // 30. What is U5 / Device type
    {
      patterns: [
        /(what kind of device is (the )?(u5|ultima 5)|tell me about (the )?(u5|ultima 5)|what is (the )?ultima 5)/i
      ],
      target: "What is the Ultima 5 (U5)?"
    },
    // 31. Diabetes / Diabetic
    {
      patterns: [
        /(type 2 diabetic|type 1 diabetic|diabetes|diabetic|with diabetes)/i,
        /tens.*if i have diabetes/i
      ],
      target: "Can I use a TENS unit if I have diabetes?"
    },
    // 32. First session setup for U5
    {
      patterns: [
        /(starting setup|first.*session setup|recommended settings).*(u5|ultima 5|new.*user)/i
      ],
      target: "What settings should I use for my very first Ultima 5 session?"
    },
    // 33. Intensity knobs on U5
    {
      patterns: [
        /(intensity controls|intensity knobs|knobs work).*(u5|ultima 5)/i
      ],
      target: "How do the intensity knobs work on my Ultima 5?"
    },
    // 34. Turned on but no sensation / feel nothing
    {
      patterns: [
        /(turned it on.*feel (absolutely )?nothing|running.*no sensation at all|not feeling (any )?sensation|no sensation)/i,
        /producing sensation/i
      ],
      target: "Why isn't my TENS unit producing sensation?"
    },
    // 35. Pad lifespan / How many uses
    {
      patterns: [
        /(how many uses|how long.*last).*(pads|electrodes|set of pads)/i,
        /how long do tens pads last/i
      ],
      target: "How long do TENS pads last?"
    },
    // 36. Acute pain / Fresh injury / Hurt yesterday
    {
      patterns: [
        /(fresh injury|hurt.*yesterday|acute pain|new injury|recent strain).*(frequency|hz|setting)/i,
        /(which hz|what frequency).*(fresh|acute|recent|new injury|yesterday)/i
      ],
      target: "What frequency works best for acute pain?"
    },
    // 37. Chronic pain frequency / SMS slang
    {
      patterns: [
        /(wat freqency|chronik pane|chronic pain)/i,
        /what frequency is best for chronic/i
      ],
      target: "What frequency is best for chronic pain?"
    },
    // 38. Sticky again / Tackiness / Revive old pads / Pads won't stick
    {
      patterns: [
        /(tackiness back|sticky again|revive (old )?pads|restore.*adhes)/i,
        /how do i make my pads sticky/i
      ],
      target: "How do I make my pads sticky again?"
    },
    {
      patterns: [
        /(pads? (lost their grip|won't stick|aren't sticking|wont stick)|electrodes? won't stay|pads wont stick)/i
      ],
      target: "Why won't my pads stick anymore?"
    },
    // 39. Lumbar / Lower back placement
    {
      patterns: [
        /(lumbar|lower back).*(pad positions?|placement|where|stick|put)/i,
        /pads for lower back/i
      ],
      target: "Where should I place the pads for lower back pain?"
    },
    // 40. Auto power-off on U5
    {
      patterns: [
        /(auto power-off|automatic(ally)? shut off|auto-off).*(u5|ultima 5)/i
      ],
      target: "Does my Ultima 5 automatically shut off if I forget to turn it off?"
    },
    // 41. All-day continuous wear
    {
      patterns: [
        /(continuous all-day wear|wear.*all day|wear.*continuously)/i
      ],
      target: "Can I wear a TENS unit all day?"
    }
  ];

  for (const entry of paraphraseMap) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normQ)) {
        const paraphraseIndex = predefinedQuestions.findIndex(
          (q) => q === entry.target
        );
        if (paraphraseIndex !== -1) {
          matchFound = true;
          bestIndex = paraphraseIndex;
          bestScore = 0.95;
          break;
        }
      }
    }
    if (matchFound && bestScore >= 0.95) break;
  }
}

// ================= INTENT OVERRIDE =================
if (bestScore < 0.85) {
  const normQ = userQuestion.toLowerCase();

  // Specific Override for timeline question
  if (
    normQ.includes("how quickly") &&
    (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) &&
    normQ.includes("work")
  ) {
    const timelineIndex = predefinedQuestions.findIndex(
      (q) => q === "How long does it take to feel relief?",
    );
    if (timelineIndex !== -1) {
      matchFound = true;
      bestIndex = timelineIndex;
      bestScore = 1.0;
    }
  }

  // Specific Override for mechanism question
  if (
    !normQ.includes("quickly") &&
    normQ.includes("how") &&
    (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) &&
    normQ.includes("work")
  ) {
    const workIndex = predefinedQuestions.findIndex(
      (q) => q === "How does a TENS unit work?",
    );
    if (workIndex !== -1) {
      matchFound = true;
      bestIndex = workIndex;
      bestScore = 1.0;
    }
  }

  const isFindingProvider =
    /(list of|find a|looking for|where is|locate a|provide me list|list of) .*?(clinic|provider|doctor|location)/.test(
      normQ,
    ) ||
    /(find|list|locate|where).*?(clinic|provider|doctor|location)/.test(normQ);

  if (isFindingProvider) {
    const providerIndex = predefinedQuestions.findIndex(
      (q) => q === "How do I find a provider near me?",
    );
    if (providerIndex !== -1) {
      matchFound = true;
      bestIndex = providerIndex;
      bestScore = 1.0;
    }
  }

  // Specific Override for sell sheets and tech specs
  if (
    normQ.includes("sell sheet") ||
    normQ.includes("tech spec") ||
    normQ.includes("specifications")
  ) {
    const specIndex = predefinedQuestions.findIndex(
      (q) => q === "Where can I find the user manual for my device?",
    );
    if (specIndex !== -1) {
      matchFound = true;
      bestIndex = specIndex;
      bestScore = 1.0;
    }
  }

  const isSideEffects =
    /(adverse impact|side effect|negative effect|bad effect|side-effect|adverse effect|adverse reaction|concern.*?customer|customer.*?concern|concern.*?patient|patient.*?concern|safety concern|what concern)/.test(
      normQ,
    );
  if (isSideEffects) {
    const sideEffectIndex = predefinedQuestions.findIndex(
      (q) => q === "Are there any side effects?",
    );
    if (sideEffectIndex !== -1) {
      matchFound = true;
      bestIndex = sideEffectIndex;
      bestScore = 1.0;
    }
  }

  const isCompanyLocation =
    /(where is|location of|situated|address of|headquarter|physical office|office location).*?(pmt|company|your)/.test(
      normQ,
    ) ||
    /(pmt|company).*?(where|location|situated|address|headquarter)/.test(
      normQ,
    );
  if (isCompanyLocation) {
    const locationIndex = predefinedQuestions.findIndex(
      (q) => q === "contact info",
    );
    if (locationIndex !== -1) {
      matchFound = true;
      bestIndex = locationIndex;
      bestScore = 1.0;
    }
  }

  // Strictly match intentional contact requests (not general "help" or "contact" words)
  const isContactSupport =
    /(contact (pmt|us|support|company|team)|customer (support|service)|reach (out to|pmt|support)|phone number|email address|how (can|do) i contact|how to (contact|reach)|support team|help desk)/i.test(
      normQ,
    ) && !/(joint health support|support kit|gut support|sleep support|pad contact|help (people|with|me|reduce)|actually help)/i.test(normQ);
  if (isContactSupport) {
    const supportIndex = predefinedQuestions.findIndex(
      (q) => q === "contact info",
    );
    if (supportIndex !== -1) {
      matchFound = true;
      bestIndex = supportIndex;
      bestScore = 1.0;
    }
  }
}

// ================= AMBIGUITY OVERRIDE =================
// Only apply ambiguity override for weak score matches (< 0.9). High confidence and paraphrase matches are preserved!
if (matchFound && bestScore < 0.9) {
  const normQ = userQuestion.toLowerCase();
  
  // Domain-specific words that indicate a valid TENS/electrotherapy question
  const domainContextWords = [
    "session", "treatment", "therapy", "stimulation", "electrode",
    "relief", "frequency", "intensity", "waveform", "implant",
    "placement", "chronic", "acute", "pain", "nerve",
    "muscle", "skin", "redness", "irritation", "medication",
    "drug", "interaction", "duration", "minutes", "surgical",
    "hardware", "pacemaker", "pregnancy", "diabetes", "healing",
    "red", "marks", "mark", "helping", "difference", "notice",
    "wave", "waveforms", "implants", "metal", "pads", "pad"
  ];
  const hasDomainContext = domainContextWords.some((w) => normQ.includes(w));
  
  // Generic terms that usually imply a missing subject
  const genericTerms = ["unit", "device", "machine", "wrap", "system", "it", "this", "these", "they", "them"];
  
  // Check if they used a standalone generic term
  const hasGeneric = genericTerms.some((t) => new RegExp(`\\b${t}\\b`).test(normQ));
  const hasSpecificProduct = products.some((p) => normQ.includes(p));
  const hasCompany = (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) || normQ.includes("pmt");
  const isClearContext = hasSpecificProduct || hasCompany || hasDomainContext;

  // 1. If it has a generic term but no clear product/company/domain context, AND score is weak
  if (hasGeneric && !isClearContext && bestScore < 0.65) {
    matchFound = false;
  }
  
  // 2. If the query is very short (e.g. <= 3 words) and lacks context, treat as ambiguous 
  // to force LLM clarification (e.g., "cost?", "help?", "why?")
  const wordCount = normQ.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount <= 3 && !isClearContext) {
    matchFound = false;
  }
}

// ================= CONTEXT FOLLOW-UP OVERRIDE =================
// If the user's query is highly likely to be a follow-up answer to "Which product?" 
// (e.g., "I mean the NerveBath", "Talking about the power wrap", "For the Knee Pro"),
// we MUST force it to the LLM so the LLM can combine it with the conversation history.
if (matchFound && bestScore < 0.9) {
  const normQ = userQuestion.toLowerCase().trim();
  const isContextFollowUp = /^(i mean|i am asking about|i'm asking about|talking about|for|specifically)?\s*(the|just the|it is the|it's the)?\s*(ultima|tens|u5|u20|u11|u1|neo|thermotech|thermacycle|soft cycle|ucombo|thermorelief|theralamp|aqua relief|polar vortex|arctic ice|theratrac|jstim|qfiber)/.test(normQ);
  
  if (isContextFollowUp && !normQ.includes("how") && !normQ.includes("what") && !normQ.includes("why") && !normQ.includes("where") && !normQ.includes("when")) {
    matchFound = false;
  }
}

// ================= OUTPUT =================
let resultOutput = "";
let bestMatch = "";

if (matchFound) {
  bestMatch = predefinedQuestions[bestIndex];
  resultOutput = "Matched with defined questions. Please see the details below";
} else {
  resultOutput =
    "I am Spark, your dedicated assistant from Pain Management Technologies (PMT). I am here to support your pain management journey with our advanced electrotherapy devices and TENS units. How can I help you today? ⚡";
}

return [
  {
    json: {
      match: matchFound,
      matchIndex: matchFound ? bestIndex : -1,
      normalizedQuestion: normalize(userQuestion),
      similarityScore: Number(bestScore.toFixed(4)),
      sessionId: sessionId,
      output: resultOutput,
      matched_question: matchFound ? bestMatch : "",
      debug: {
        cacheSource: cacheSource,
        sheetQuestionsCount: sheetQuestions.length,
        totalQuestionsCount: predefinedQuestions.length,
        hasMatchInSheet: matchFound ? sheetQuestionsSet.has(bestMatch.toLowerCase().trim()) : false
      }
    },
  },
];
