import test from 'node:test';import assert from 'node:assert/strict';import { normalizeResponse,parseMaybeJson } from '../src/webhook/normalizer.js';
const cfg={answerPaths:['text','data.answer'],sourcePaths:['sources'],intentPaths:['intent'],confidencePaths:['confidence']};
test('normalizes json text field',()=>{const x=normalizeResponse('{"text":"hello"}','application/json',cfg);assert.equal(x.answer,'hello');});
test('preserves plain text',()=>{assert.equal(normalizeResponse('hello','text/plain',cfg).answer,'hello');});
test('handles malformed payload without executing it',()=>{const x=normalizeResponse('<script>alert(1)</script>','text/html',cfg);assert.equal(x.answer,'<script>alert(1)</script>');});
test('normalizes nested answer path',()=>{const x=normalizeResponse('{"data":{"answer":"nested"}}','application/json',cfg);assert.equal(x.answer,'nested');});
