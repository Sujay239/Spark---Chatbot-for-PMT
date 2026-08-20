import { bestSimilarity } from '../semantic/similarity.js';
export function isNovel(question,existing,threshold=.85){ const {score}=bestSimilarity(question,existing); return {novel:score<threshold,score}; }
