import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const qCode = fs.readFileSync("input/examples/predefined-questions-node.js", "utf8");
const aCode = fs.readFileSync("input/examples/predefined-answers-node.js", "utf8");
const latest = JSON.parse(fs.readFileSync("output/latest/results.json", "utf8"));

const qFn = new Function("$json", "$input", "$getWorkflowStaticData", "require", qCode);
const aFn = new Function("$input", "$", "$getWorkflowStaticData", "require", aCode);

function runQuestionNode(question) {
  const input = {
    first: () => ({ json: { query: { chatInput: question, sessionId: "check" } } }),
  };
  return qFn({ query: { chatInput: question, sessionId: "check" } }, input, () => ({}), require)[0].json;
}

function runAnswerNode(question) {
  const input = {
    first: () => ({ json: { query: { chatInput: question }, chatInput: question } }),
  };
  const $ = () => ({
    first: () => ({ json: { query: { chatInput: question } } }),
  });
  return aFn(input, $, () => ({}), require)[0].json;
}

const attentionTests = latest.tests.filter(
  (test) =>
    test.expected?.answer &&
    ["FAILED", "PARTIAL", "HALLUCINATION"].includes(test.status),
);

let exact = 0;
for (const test of attentionTests) {
  const questionResult = runQuestionNode(test.question);
  const answerResult = runAnswerNode(test.question);
  const expectedAnswer = Array.isArray(test.expected.answer)
    ? test.expected.answer.map((part) => String(part || "").replace(/\s+/g, " ").trim()).join("\n\n")
    : test.expected.answer;
  const isExact = answerResult.output === expectedAnswer;
  if (isExact) exact += 1;
  console.log(
    [
      test.testId,
      questionResult.match ? "MATCH" : "MISS",
      answerResult.debug?.matchedQuestion || "",
      isExact ? "EXACT" : "DIFF",
      `${answerResult.output.length}/${expectedAnswer.length}`,
    ].join("\t"),
  );
}

console.log(`Exact expected answers: ${exact}/${attentionTests.length}`);
