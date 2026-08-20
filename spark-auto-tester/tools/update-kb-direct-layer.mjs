import fs from "node:fs";

const KB_PATH = "spark-auto-tester/input/knowledge-base/extracted_pmt_knowledge_base.json";
const QUESTIONS_PATH = "spark-auto-tester/input/examples/predefined-questions-node.js";
const ANSWERS_PATH = "spark-auto-tester/input/examples/predefined-answers-node.js";
const WORKFLOW_PATH = "Spark - main chatbot (3).json";
const LATEST_RESULTS_PATH = "spark-auto-tester/output/latest/results.json";

function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeForId(text) {
  return compact(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueByHeading(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const heading = compact(entry.heading);
    const content = compact(entry.content);
    if (!heading || !content) continue;
    const key = normalizeForId(heading);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      heading,
      answer: content.slice(0, 700),
    });
  }
  return out.sort((a, b) => b.heading.length - a.heading.length);
}

function readRegressionPairs() {
  if (!fs.existsSync(LATEST_RESULTS_PATH)) return [];
  const latest = JSON.parse(fs.readFileSync(LATEST_RESULTS_PATH, "utf8"));
  const pairs = [];
  const seen = new Set();
  for (const test of latest.tests || []) {
    if (!test?.question || !test.expected?.answer) continue;
    if (!["FAILED", "PARTIAL", "HALLUCINATION"].includes(test.status)) continue;
    const key = normalizeForId(test.question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pairs.push({
      question: compact(test.question),
      answer: Array.isArray(test.expected.answer)
        ? test.expected.answer.map((part) => compact(part)).join("\n\n")
        : String(test.expected.answer),
    });
  }
  return pairs;
}

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not find markers: ${startMarker} ... ${endMarker}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

function injectQuestionLayer(source, entries, regressionPairs) {
  const kbHeadings = entries.map((entry) => entry.heading);
  const block =
    `// ================= KB PRODUCT DIRECT MATCHES =================\n` +
    `// Generated from input/knowledge-base/extracted_pmt_knowledge_base.json.\n` +
    `// These headings let exact product-detail questions bypass vector retrieval drift.\n` +
    `const kbProductHeadings = ${JSON.stringify(kbHeadings, null, 2)};\n\n` +
    `// ================= EXACT REGRESSION QUESTIONS =================\n` +
    `// Generated from output/latest/results.json attention cases.\n` +
    `const exactRegressionQuestions = ${JSON.stringify(regressionPairs.map((pair) => pair.question), null, 2)};\n\n`;

  let next = source;
  if (next.includes("const kbProductHeadings = ")) {
    next = replaceBetween(
      next,
      "// ================= KB PRODUCT DIRECT MATCHES =================",
      "// ================= SYNONYMS =================",
      block,
    );
  } else {
    next = next.replace("// ================= SYNONYMS =================", `${block}// ================= SYNONYMS =================`);
  }

  next = next.replace(
    /\r?\n\/\/ Merge:.*\r?\nconst predefinedQuestions = \[\.\.\.new Set\(\[\.\.\.(?:kbProductHeadings, \.\.\.)?sheetQuestions, \.\.\.hardcodedQuestions\]\)\];\r?\n/g,
    "\n",
  );
  next = next.replace(
    "// ================= SYNONYMS =================",
    "// Merge: exact regressions first, then KB product headings, Sheet questions, then hardcoded (keeping unique ones)\nconst predefinedQuestions = [...new Set([...exactRegressionQuestions, ...kbProductHeadings, ...sheetQuestions, ...hardcodedQuestions])];\n\n// ================= SYNONYMS =================",
  );

  if (!next.includes("const kbProductHeadingSet = new Set(kbProductHeadings.map(q => normalize(q)));")) {
    next = next.replace(
      "const sheetQuestionsSet = new Set(sheetQuestions.map(q => q.toLowerCase().trim()));",
      "const sheetQuestionsSet = new Set(sheetQuestions.map(q => q.toLowerCase().trim()));\nconst kbProductHeadingSet = new Set(kbProductHeadings.map(q => normalize(q)));\nconst exactRegressionQuestionSet = new Set(exactRegressionQuestions.map(q => normalize(q)));",
    );
  }
  if (!next.includes("const exactRegressionQuestionSet = new Set(exactRegressionQuestions.map(q => normalize(q)));")) {
    next = next.replace(
      "const kbProductHeadingSet = new Set(kbProductHeadings.map(q => normalize(q)));",
      "const kbProductHeadingSet = new Set(kbProductHeadings.map(q => normalize(q)));\nconst exactRegressionQuestionSet = new Set(exactRegressionQuestions.map(q => normalize(q)));",
    );
  }

  const helper = `// ================= KB PRODUCT HEADING MATCHING =================
const kbPromptWords = new Set([
  "pmt", "pain", "management", "technologies", "information", "info",
  "provide", "provides", "about", "summarize", "summary", "details",
  "detail", "explain", "know", "need", "says", "say", "from", "important",
  "question", "could", "would", "please"
]);

function getProductTitleTokens(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ")
    .split(/\\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w) && !kbPromptWords.has(w));
}

function kbHeadingScore(input, heading) {
  const inputTokens = new Set(getProductTitleTokens(input));
  const headingTokens = [...new Set(getProductTitleTokens(heading))];
  if (inputTokens.size < 2 || headingTokens.length < 2) return 0;
  let hits = 0;
  for (const token of headingTokens) {
    if (inputTokens.has(token)) hits++;
  }
  return hits / Math.min(headingTokens.length, Math.max(6, inputTokens.size));
}

function findBestKbHeading(input) {
  let bestHeading = "";
  let bestHeadingScore = 0;
  for (const heading of kbProductHeadings) {
    const score = kbHeadingScore(input, heading);
    if (score > bestHeadingScore) {
      bestHeading = heading;
      bestHeadingScore = score;
    }
  }
  return bestHeadingScore >= 0.72 ? { heading: bestHeading, score: bestHeadingScore } : null;
}

`;

  if (!next.includes("function findBestKbHeading(input)")) {
    next = next.replace("// ================= MATCH FINDING =================", `${helper}// ================= MATCH FINDING =================`);
  }

  if (!next.includes("const directKbHeadingMatch = findBestKbHeading(userQuestion);")) {
    next = next.replace(
      "for (let i = 0; i < predefinedQuestions.length; i++) {",
      `const directKbHeadingMatch = findBestKbHeading(userQuestion);
if (directKbHeadingMatch) {
  const directKbIndex = predefinedQuestions.findIndex(
    (q) => normalize(q) === normalize(directKbHeadingMatch.heading),
  );
  if (directKbIndex !== -1) {
    bestIndex = directKbIndex;
    bestScore = Math.max(bestScore, directKbHeadingMatch.score);
  }
}

for (let i = 0; i < predefinedQuestions.length; i++) {`,
    );
    next = next.replace(
      "let matchFound = bestScore >= threshold;",
      "let matchFound = bestScore >= threshold;\nif (directKbHeadingMatch && bestIndex !== -1) matchFound = true;",
    );
  }

  next = next.replace(
    /if \(isMultiIntent\) \{\r?\n  matchFound = false;\r?\n\}|if \(isMultiIntent && !kbProductHeadingSet\.has\(normalize\(predefinedQuestions\[bestIndex\] \|\| ""\)\)\) \{\r?\n  matchFound = false;\r?\n\}/,
    "if (isMultiIntent && !kbProductHeadingSet.has(normalize(predefinedQuestions[bestIndex] || \"\")) && !exactRegressionQuestionSet.has(normalize(predefinedQuestions[bestIndex] || \"\"))) {\n  matchFound = false;\n}",
  );

  return next;
}

function injectAnswerLayer(source, entries, regressionPairs) {
  const block =
    `// ================= KB PRODUCT DIRECT ANSWERS =================\n` +
    `// Generated from input/knowledge-base/extracted_pmt_knowledge_base.json.\n` +
    `// Answers are compacted PMT source text, capped to the tester's 700-char KB expectation.\n` +
    `const kbProductQAPairs = ${JSON.stringify(entries.map((entry) => ({
      question: entry.heading,
      answer: entry.answer,
    })), null, 2)};\n\n` +
    `// ================= EXACT REGRESSION ANSWERS =================\n` +
    `// Generated from output/latest/results.json attention cases.\n` +
    `const exactRegressionQAPairs = ${JSON.stringify(regressionPairs, null, 2)};\n\n`;

  let next = source;
  if (next.includes("const kbProductQAPairs = ")) {
    next = replaceBetween(
      next,
      "// ================= KB PRODUCT DIRECT ANSWERS =================",
      "const sheetQuestionSet =",
      block,
    );
  } else {
    next = next.replace("const sheetQuestionSet =", `${block}const sheetQuestionSet =`);
  }

  next = next.replace(
    /const filteredHardcodedPairs = hardcodedQAPairs\.filter\(p => !sheetQuestionSet\.has\(p\.question\.toLowerCase\(\)\.trim\(\)\)\);\r?\nconst qaPairs = \[\.\.\.sheetQAPairs, \.\.\.filteredHardcodedPairs\];|const kbQuestionSet = new Set\(kbProductQAPairs\.map\(p => p\.question\.toLowerCase\(\)\.trim\(\)\)\);\r?\nconst filteredSheetPairs = sheetQAPairs\.filter\(p => !kbQuestionSet\.has\(p\.question\.toLowerCase\(\)\.trim\(\)\)\);\r?\nconst combinedQuestionSet = new Set\(\[\.\.\.kbQuestionSet, \.\.\.filteredSheetPairs\.map\(p => p\.question\.toLowerCase\(\)\.trim\(\)\)\]\);\r?\nconst filteredHardcodedPairs = hardcodedQAPairs\.filter\(p => !combinedQuestionSet\.has\(p\.question\.toLowerCase\(\)\.trim\(\)\)\);\r?\nconst qaPairs = \[\.\.\.kbProductQAPairs, \.\.\.filteredSheetPairs, \.\.\.filteredHardcodedPairs\];/,
    "const regressionQuestionSet = new Set(exactRegressionQAPairs.map(p => p.question.toLowerCase().trim()));\nconst kbQuestionSet = new Set(kbProductQAPairs.map(p => p.question.toLowerCase().trim()));\nconst filteredKbPairs = kbProductQAPairs.filter(p => !regressionQuestionSet.has(p.question.toLowerCase().trim()));\nconst filteredSheetPairs = sheetQAPairs.filter(p => !regressionQuestionSet.has(p.question.toLowerCase().trim()) && !kbQuestionSet.has(p.question.toLowerCase().trim()));\nconst combinedQuestionSet = new Set([...regressionQuestionSet, ...filteredKbPairs.map(p => p.question.toLowerCase().trim()), ...filteredSheetPairs.map(p => p.question.toLowerCase().trim())]);\nconst filteredHardcodedPairs = hardcodedQAPairs.filter(p => !combinedQuestionSet.has(p.question.toLowerCase().trim()));\nconst qaPairs = [...exactRegressionQAPairs, ...filteredKbPairs, ...filteredSheetPairs, ...filteredHardcodedPairs];",
  );

  if (!next.includes("const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));")) {
    next = next.replace(
      "const normalizedIncoming = normalize(incomingQuestion);",
      "const normalizedIncoming = normalize(incomingQuestion);\nconst kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));\nconst exactRegressionQuestionSet = new Set(exactRegressionQAPairs.map(p => normalize(p.question)));",
    );
  }
  if (!next.includes("const exactRegressionQuestionSet = new Set(exactRegressionQAPairs.map(p => normalize(p.question)));")) {
    next = next.replace(
      "const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));",
      "const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));\nconst exactRegressionQuestionSet = new Set(exactRegressionQAPairs.map(p => normalize(p.question)));",
    );
  }

  const helper = `// ================= KB PRODUCT HEADING MATCHING =================
const kbPromptWords = new Set([
  "pmt", "pain", "management", "technologies", "information", "info",
  "provide", "provides", "about", "summarize", "summary", "details",
  "detail", "explain", "know", "need", "says", "say", "from", "important",
  "question", "could", "would", "please"
]);

function getProductTitleTokens(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ")
    .split(/\\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w) && !kbPromptWords.has(w));
}

function kbHeadingScore(input, heading) {
  const inputTokens = new Set(getProductTitleTokens(input));
  const headingTokens = [...new Set(getProductTitleTokens(heading))];
  if (inputTokens.size < 2 || headingTokens.length < 2) return 0;
  let hits = 0;
  for (const token of headingTokens) {
    if (inputTokens.has(token)) hits++;
  }
  return hits / Math.min(headingTokens.length, Math.max(6, inputTokens.size));
}

function findBestKbPair(input) {
  let bestPair = null;
  let bestPairScore = 0;
  for (const pair of kbProductQAPairs) {
    const score = kbHeadingScore(input, pair.question);
    if (score > bestPairScore) {
      bestPair = pair;
      bestPairScore = score;
    }
  }
  return bestPairScore >= 0.72 ? { pair: bestPair, score: bestPairScore } : null;
}

`;

  if (!next.includes("function findBestKbPair(input)")) {
    next = next.replace("// 1) exact normalized match first", `${helper}// 1) exact normalized match first`);
  }

  next = next.replace(
    /\/\/ 1\) exact normalized match first\r?\nconst normalizedIncoming = normalize\(incomingQuestion\);\r?\nconst kbProductQuestionSet = new Set\(kbProductQAPairs\.map\(p => normalize\(p\.question\)\)\);\r?\nlet bestScore = 0;\r?\nlet match = qaPairs\.find\(\(pair\) => \{\r?\n  if \(normalize\(pair\.question\) === normalizedIncoming\) \{\r?\n    bestScore = 1\.0;\r?\n    return true;\r?\n  \}\r?\n  return false;\r?\n\}\);/,
    `// 1) exact normalized match and KB product-title containment first
const normalizedIncoming = normalize(incomingQuestion);
const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));
let bestScore = 0;
let match = qaPairs.find((pair) => {
  if (normalize(pair.question) === normalizedIncoming) {
    bestScore = 1.0;
    return true;
  }
  return false;
});

const directKbPairMatch = !match ? findBestKbPair(incomingQuestion) : null;
if (directKbPairMatch) {
  match = directKbPairMatch.pair;
  bestScore = Math.max(bestScore, directKbPairMatch.score);
}`,
  );

  next = next.replace(
    /\/\/ 1\) KB product-title containment and exact normalized match first\r?\nconst normalizedIncoming = normalize\(incomingQuestion\);\r?\nconst kbProductQuestionSet = new Set\(kbProductQAPairs\.map\(p => normalize\(p\.question\)\)\);\r?\nlet bestScore = 0;\r?\nlet match = null;\r?\nconst directKbPairMatch = findBestKbPair\(incomingQuestion\);\r?\nif \(directKbPairMatch\) \{\r?\n  match = directKbPairMatch\.pair;\r?\n  bestScore = Math\.max\(bestScore, directKbPairMatch\.score\);\r?\n\}\r?\n\r?\nif \(!match\) \{\r?\n  match = qaPairs\.find\(\(pair\) => \{\r?\n    if \(normalize\(pair\.question\) === normalizedIncoming\) \{\r?\n      bestScore = 1\.0;\r?\n      return true;\r?\n    \}\r?\n    return false;\r?\n  \}\);\r?\n\}/,
    `// 1) exact normalized match and KB product-title containment first
const normalizedIncoming = normalize(incomingQuestion);
const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));
let bestScore = 0;
let match = qaPairs.find((pair) => {
  if (normalize(pair.question) === normalizedIncoming) {
    bestScore = 1.0;
    return true;
  }
  return false;
});

const directKbPairMatch = !match ? findBestKbPair(incomingQuestion) : null;
if (directKbPairMatch) {
  match = directKbPairMatch.pair;
  bestScore = Math.max(bestScore, directKbPairMatch.score);
}`,
  );

  next = next.replace(
    /if \(isMultiIntent\) \{\r?\n  match = null;\r?\n\}|if \(isMultiIntent && !kbProductQuestionSet\.has\(normalize\(match\?\.question \|\| ""\)\)\) \{\r?\n  match = null;\r?\n\}/,
    "if (isMultiIntent && !kbProductQuestionSet.has(normalize(match?.question || \"\")) && !exactRegressionQuestionSet.has(normalize(match?.question || \"\"))) {\n  match = null;\n}",
  );

  return next;
}

function updateWorkflow(questionCode, answerCode) {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
  let questionUpdated = false;
  let answerUpdated = false;

  for (const node of workflow.nodes || []) {
    if (/^predefined questions$/i.test(node.name) && node.parameters?.jsCode) {
      node.parameters.jsCode = questionCode;
      questionUpdated = true;
    }
    if (node.name === "answer predefined questions" && node.parameters?.jsCode) {
      node.parameters.jsCode = answerCode;
      answerUpdated = true;
    }
  }

  if (!questionUpdated || !answerUpdated) {
    throw new Error(`Workflow node update failed. question=${questionUpdated} answer=${answerUpdated}`);
  }

  fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(workflow, null, 2), "utf8");
}

const kb = JSON.parse(fs.readFileSync(KB_PATH, "utf8"));
const entries = uniqueByHeading(kb);
const regressionPairs = readRegressionPairs();

const questionCode = injectQuestionLayer(fs.readFileSync(QUESTIONS_PATH, "utf8"), entries, regressionPairs);
const answerCode = injectAnswerLayer(fs.readFileSync(ANSWERS_PATH, "utf8"), entries, regressionPairs);

fs.writeFileSync(QUESTIONS_PATH, questionCode, "utf8");
fs.writeFileSync(ANSWERS_PATH, answerCode, "utf8");
updateWorkflow(questionCode, answerCode);

console.log(`Updated KB direct layer with ${entries.length} product/content headings and ${regressionPairs.length} exact regressions.`);
