# Spark Automated Chatbot Tester

This ZIP is a runnable automated QA system for the Spark n8n chatbot.

## Start

Requirements: Node.js 20 or newer.

From this folder run:

```bash
npm start
```

No npm packages need to be installed because the project uses Node.js built-ins only.

On Windows you can also double-click `start.bat`.

## What `npm start` does automatically

1. Reads the PMT knowledge base, predefined Q&A, prompt, and sanitized n8n workflow in `/input`.
2. Builds a normalized test specification.
3. Loads previous generated-question history and active regression failures.
4. Generates the configured number of new questions from BOTH the knowledge base and predefined Q&A.
5. Rejects normal generated questions that are too similar to predefined or previously generated questions.
6. Replays previous failures separately as regression tests.
7. Sends every test to the Spark webhook STRICTLY ONE AT A TIME.
8. Waits for the current response/timeout/error before sending the next question.
9. Preserves the request, raw webhook response, normalized answer, latency, retries, evaluation, and status.
10. Saves the complete run to JSON.
11. Generates the HTML QA dashboard.
12. Scans all failed/partial/error results.
13. Generates `CHATBOT_IMPROVEMENTS.md` as a direct handoff to an AI coding agent.
14. Stores failures for regression testing in the next cycle.
15. Publishes the latest files under `/output/latest`.
16. Starts a local dashboard and opens it in your browser.

## Latest files after every run

```text
output/latest/
├── index.html                    # HTML QA dashboard
├── results.json                  # complete result JSON
├── generated-questions.json      # questions used for this cycle
├── CHATBOT_IMPROVEMENTS.md       # give this to your AI coding agent
└── run-meta.json
```

Historical cycles are preserved under:

```text
output/runs/<run-id>/
```

## Default webhook

The project is already configured for:

```text
https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot
```

Observed request contract from the supplied workflow:

```text
GET ?chatInput=<question>&sessionId=<session-id>
```

The response normalizer first checks the `text` field and safely handles alternate JSON/text payloads.

## Important execution rule

The default is:

```text
MAX_CONCURRENT_REQUESTS = 1
```

Do not increase this if you want strict question-by-question execution.

## Change test count

The default is 100 questions per run.

Create a `.env` file if you want overrides:

```env
TEST_COUNT=100
MAX_CONCURRENT_REQUESTS=1
REQUESTS_PER_SECOND=1
DELAY_BETWEEN_REQUESTS_MS=250
```

See `.env.example` for all options.

## Optional AI enhancement

The tester works without an external AI key. Deterministic source-aware generation/evaluation remains available.

If you configure an OpenAI-compatible chat-completions endpoint, it can additionally help with question generation, semantic evaluation, and failure synthesis:

```env
AI_ENABLED=true
AI_BASE_URL=YOUR_OPENAI_COMPATIBLE_BASE_URL
AI_API_KEY=YOUR_KEY
AI_MODEL=YOUR_MODEL
```

Secrets are never required in the repository and should only be placed in `.env`.

## Safe test without calling the real webhook

```bash
npm run start:mock
```

This executes the exact same pipeline with simulated correct, wrong, partial, malformed, timeout, and error responses.

## Framework self-test

```bash
npm test
```

## Input locations

```text
input/
├── knowledge-base/     # PMT KB JSON
├── qa/                 # predefined Q&A CSV
├── prompts/            # Spark prompt
├── workflow/           # sanitized n8n workflow
├── examples/           # current matching/answer JS + links
├── semantic-rules/
└── evaluation/
```

Replace or update these source files when the chatbot configuration changes. The next `npm start` automatically ingests the new versions.

## The improvement loop

```text
Knowledge Base + Q&A + Prompt + Workflow
                  ↓
        Generate New Questions
                  ↓
         Send 1 Question
                  ↓
          Receive Response
                  ↓
      Send Next Question Only Now
                  ↓
           Save Full JSON
                  ↓
       Evaluate Every Result
                  ↓
        HTML QA Dashboard
                  ↓
     Failure / Root-Cause Scan
                  ↓
      CHATBOT_IMPROVEMENTS.md
                  ↓
       AI Coding Agent Fixes Bot
                  ↓
             npm start
                  ↓
          Regression Re-test
```
