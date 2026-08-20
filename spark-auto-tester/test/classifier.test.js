import test from 'node:test';import assert from 'node:assert/strict';import { classify } from '../src/classification/classifier.js';
const cfg={evaluation:{thresholds:{ok:85,partial:65,hallucinationGroundedness:45}}};
test('classifies timeout',()=>assert.equal(classify({}, {error:'TIMEOUT'}, {reasons:['TIMEOUT'],groundedness:0,overallScore:0},cfg).status,'TIMEOUT'));
test('classifies hallucination before score',()=>assert.equal(classify({}, {error:null,response:{answer:'x'}}, {reasons:['HALLUCINATION'],groundedness:0,overallScore:90},cfg).status,'HALLUCINATION'));
test('classifies ok',()=>assert.equal(classify({}, {error:null,response:{answer:'x'}}, {reasons:[],groundedness:90,overallScore:90},cfg).status,'OK'));
test('classifies safe non-invention as not found',()=>assert.equal(classify({expected:{behavior:'DO_NOT_INVENT'}},{error:null,response:{answer:'That information is unavailable.'}},{reasons:[],groundedness:90,overallScore:90},cfg).status,'NOT_FOUND'));
