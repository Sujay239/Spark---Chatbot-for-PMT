const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('d:/Z_work/Sujay/Spark - PMT chatbot/chatbot-tester/test_93_questions.json', 'utf8'));
const code1 = fs.readFileSync('d:/Z_work/Sujay/Spark - PMT chatbot/1.js', 'utf8');

const results = [];

questions.forEach((q, idx) => {
  const $json = { query: { chatInput: q, sessionId: 'test-session' } };
  const $input = { first: () => ({ json: { query: { chatInput: q, sessionId: 'test-session' } } }) };
  const $getWorkflowStaticData = () => ({});

  try {
    const fn = new Function('$json', '$input', '$getWorkflowStaticData', code1);
    const res = fn($json, $input, $getWorkflowStaticData);
    const data = res[0].json;
    results.push({
      id: idx + 1,
      question: q,
      match: data.match,
      matched_question: data.matched_question,
      score: data.similarityScore
    });
  } catch (e) {
    results.push({
      id: idx + 1,
      question: q,
      match: false,
      error: e.message
    });
  }
});

console.log(`Evaluated ${results.length} questions.`);
const matchedCount = results.filter(r => r.match).length;
const unMatchedCount = results.filter(r => !r.match).length;
console.log(`Matched: ${matchedCount}, Fallback to LLM: ${unMatchedCount}`);

console.log('\n--- DETAILED MATCH RESULTS ---');
results.forEach(r => {
  if (r.match) {
    console.log(`[#${r.id}] "${r.question}"\n  -> MATCHED: "${r.matched_question}" (score: ${r.score})`);
  } else {
    console.log(`[#${r.id}] "${r.question}"\n  -> [FALLBACK TO LLM]`);
  }
});
