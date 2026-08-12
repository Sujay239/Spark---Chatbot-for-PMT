// ================= INPUT =================
const userQuestion =
  $json.query?.chatInput || $input.first()?.json?.query?.chatInput || "";
const sessionId =
  $json.query?.sessionId || $input.first()?.json?.query?.sessionId || "";

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
  "duration": "pulse width",
  "microseconds": "pulse width",
  "us": "pulse width",

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
  "help": "contact info",
  "support": "contact info",
  "phone": "contact info",
  "email": "contact info",
  "service": "contact info",
  "customer service": "contact info",
  "call": "contact info",
  "reach": "contact info",
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

  const isContactSupport =
    /(support|contact|help|email|phone|pmt support|customer support|support team|tech support|contact us|contact pmt|how to contact|phone number|email address|help desk|customer service)/.test(
      normQ,
    ) && !/(joint health support|support kit|gut support|sleep support)/.test(normQ);
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
if (matchFound) {
  const normQ = userQuestion.toLowerCase();
  
  // Generic terms that usually imply a missing subject
  const genericTerms = ["unit", "device", "machine", "wrap", "system", "it", "this", "these", "they", "them"];
  
  // Check if they used a standalone generic term
  const hasGeneric = genericTerms.some((t) => new RegExp(`\\b${t}\\b`).test(normQ));
  const hasSpecificProduct = products.some((p) => normQ.includes(p));
  const hasCompany = (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) || normQ.includes("pmt");
  const isClearContext = hasSpecificProduct || hasCompany;

  // 1. If it has a generic term but no clear product/company context, it's ambiguous
  if (hasGeneric && !isClearContext) {
    matchFound = false;
  }
  
  // 2. If the query is very short (e.g. <= 4 words) and lacks context, treat as ambiguous 
  // to force LLM clarification (e.g., "cost?", "does it work?", "help?", "why?")
  const wordCount = normQ.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount <= 6 && !isClearContext) {
    matchFound = false;
  }
}

// ================= CONTEXT FOLLOW-UP OVERRIDE =================
// If the user's query is highly likely to be a follow-up answer to "Which product?" 
// (e.g., "I mean the NerveBath", "Talking about the power wrap", "For the Knee Pro"),
// we MUST force it to the LLM so the LLM can combine it with the conversation history.
if (matchFound) {
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
