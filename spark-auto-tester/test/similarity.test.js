import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticSimilarity } from '../src/semantic/similarity.js';
test('semantic similarity favors related text',()=>{const related=semanticSimilarity('Can I use TENS every day?','Can I use a TENS unit every day?');const unrelated=semanticSimilarity('Can I use TENS every day?','Write a poem about the ocean');assert.ok(related>unrelated);});
