import test from 'node:test';import assert from 'node:assert/strict';import { parseCsv } from '../src/ingestion/parsers.js';
test('csv parser handles quotes and embedded commas',()=>{const rows=parseCsv('Question,Answer\n"Q, one","A, one"\n');assert.equal(rows[0].Question,'Q, one');assert.equal(rows[0].Answer,'A, one');});
