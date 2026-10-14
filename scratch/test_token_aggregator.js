// Test token aggregation logic
const sampleRows = [
  {"id":"010f7d56-b648-491d-b211-c42f666fd01c","model":"gpt-5.1-2025-11-13","created_at":"2026-10-13 04:51:58.059075","prompt_tokens":3844,"completion_tokens":94,"total_tokens":3938,"service_tier":"default","cached_prompt_tokens":"0"},
  {"id":"fbd7600b-6479-4c7f-a4eb-31d243c13d6e","model":"gpt-4.1-mini","created_at":"2026-10-13 04:51:57.779972","prompt_tokens":1035,"completion_tokens":108,"total_tokens":1143,"service_tier":"metadata_generation","cached_prompt_tokens":"0"},
  {"id":"4ae1de1e-4fd9-41d7-a7e9-c2c166d3f4ac","model":"gpt-5.1-2025-11-13","created_at":"2026-10-10 08:00:40.371234","prompt_tokens":5477,"completion_tokens":243,"total_tokens":5720,"service_tier":"default","cached_prompt_tokens":"3328"}
];

function processTokenData(rows, selectedMonth, filterMode) {
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalTokens = 0;
  let totalCached = 0;

  const tierMap = new Map();
  const modelMap = new Map();

  const rates = {
    'gpt-5.1-2025-11-13': { in: 2.50, out: 10.00, cached: 1.25, role: 'Flagship Clinical Reasoning', badge: 'Flagship' },
    'gpt-4.1-mini': { in: 0.15, out: 0.60, cached: 0.075, role: 'Metadata Generation & Guardrails', badge: 'Primary' },
    'gpt-4o': { in: 2.50, out: 10.00, cached: 1.25, role: 'Clinical Diagnostics & Escalations', badge: 'Flagship' },
    'gpt-4o-mini': { in: 0.15, out: 0.60, cached: 0.075, role: 'Patient Q&A & Device Setup', badge: 'Primary' },
    'claude-3.5-sonnet': { in: 3.00, out: 15.00, cached: 1.50, role: 'Medical Second-Opinion Fallback', badge: 'Fallback' },
    'pmt-guardrail-v2': { in: 0.10, out: 0.40, cached: 0.05, role: 'PII Shield & Dosage Safety Policy', badge: 'Safety' },
    'text-embedding-3-small': { in: 0.02, out: 0.00, cached: 0.01, role: 'Knowledge Base Semantic Indexing', badge: 'Vector' }
  };

  rows.forEach(r => {
    const prompt = Number(r.prompt_tokens) || 0;
    const comp = Number(r.completion_tokens) || 0;
    const tot = Number(r.total_tokens) || (prompt + comp);
    const cached = Number(r.cached_prompt_tokens) || 0;

    totalPrompt += prompt;
    totalCompletion += comp;
    totalTokens += tot;
    totalCached += cached;

    // Tier
    const tier = r.service_tier || 'default';
    if (!tierMap.has(tier)) {
      tierMap.set(tier, { tier, count: 0, prompt: 0, completion: 0, total: 0, cached: 0 });
    }
    const tData = tierMap.get(tier);
    tData.count++;
    tData.prompt += prompt;
    tData.completion += comp;
    tData.total += tot;
    tData.cached += cached;

    // Model
    const model = r.model || 'gpt-4.1-mini';
    if (!modelMap.has(model)) {
      modelMap.set(model, { model, count: 0, prompt: 0, completion: 0, total: 0, cached: 0 });
    }
    const mData = modelMap.get(model);
    mData.count++;
    mData.prompt += prompt;
    mData.completion += comp;
    mData.total += tot;
    mData.cached += cached;
  });

  // Calculate costs per model
  let fleetCostUSD = 0;
  const modelBreakdown = [];
  modelMap.forEach((m, modelName) => {
    const rateInfo = rates[modelName] || { in: 1.00, out: 3.00, cached: 0.50, role: 'Inference Engine', badge: 'Core' };
    const uncachedPrompt = Math.max(0, m.prompt - m.cached);
    const costPrompt = (uncachedPrompt / 1000000) * rateInfo.in;
    const costCached = (m.cached / 1000000) * rateInfo.cached;
    const costComp = (m.completion / 1000000) * rateInfo.out;
    const modelCostUSD = costPrompt + costCached + costComp;

    fleetCostUSD += modelCostUSD;

    modelBreakdown.push({
      model: modelName,
      role: rateInfo.role,
      badge: rateInfo.badge,
      count: m.count,
      prompt_tokens: m.prompt,
      cached_tokens: m.cached,
      completion_tokens: m.completion,
      total_tokens: m.total,
      rate_label: `$${rateInfo.in.toFixed(2)} / $${rateInfo.out.toFixed(2)}`,
      cost_usd: modelCostUSD,
      cost_usd_formatted: '$' + modelCostUSD.toFixed(4),
      cost_inr_formatted: '₹' + (modelCostUSD * 83.00).toFixed(2),
      cost_share_pct: 0
    });
  });

  modelBreakdown.forEach(m => {
    m.cost_share_pct = fleetCostUSD > 0 ? Number(((m.cost_usd / fleetCostUSD) * 100).toFixed(1)) : 0;
  });
  modelBreakdown.sort((a, b) => b.total_tokens - a.total_tokens);

  // Tier distribution array
  const tierDistribution = [];
  tierMap.forEach((t) => {
    tierDistribution.push({
      tier: t.tier,
      name: t.tier === 'default' ? 'Default' : (t.tier === 'metadata_generation' ? 'Metadata Generation' : t.tier),
      description: t.tier === 'default' ? 'Primary inference & clinical chat' : 'Vector embeddings & safety filter',
      count: t.count,
      prompt_tokens: t.prompt,
      completion_tokens: t.completion,
      total_tokens: t.total,
      cached_tokens: t.cached,
      percentage: totalTokens > 0 ? Number(((t.total / totalTokens) * 100).toFixed(1)) : 0
    });
  });
  tierDistribution.sort((a, b) => b.total_tokens - a.total_tokens);

  // Time series (hourly or daily buckets)
  const timeBuckets = new Map();
  rows.forEach(r => {
    const d = new Date(r.created_at);
    // Bucket key: day or hour
    const key = selectedMonth === 'all' 
      ? d.toISOString().slice(0, 10) 
      : `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}`;
    if (!timeBuckets.has(key)) {
      timeBuckets.set(key, { label: key, prompt: 0, completion: 0, total: 0 });
    }
    const b = timeBuckets.get(key);
    b.prompt += (Number(r.prompt_tokens) || 0);
    b.completion += (Number(r.completion_tokens) || 0);
    b.total += (Number(r.total_tokens) || 0);
  });

  const timeSeries = Array.from(timeBuckets.values()).slice(0, 24);

  // Cache savings
  const cachedSavingsUSD = (totalCached / 1000000) * 1.25;

  return {
    kpi: {
      total_tokens: totalTokens,
      prompt_tokens: totalPrompt,
      completion_tokens: totalCompletion,
      cached_tokens: totalCached,
      prompt_pct: totalTokens > 0 ? Number(((totalPrompt / totalTokens) * 100).toFixed(1)) : 0,
      completion_pct: totalTokens > 0 ? Number(((totalCompletion / totalTokens) * 100).toFixed(1)) : 0,
      total_requests: rows.length,
      estimated_total_cost_usd: fleetCostUSD,
      estimated_total_cost_inr: fleetCostUSD * 83.00,
      cached_savings_usd: cachedSavingsUSD,
      savings_pct: fleetCostUSD > 0 ? Number(((cachedSavingsUSD / (fleetCostUSD + cachedSavingsUSD)) * 100).toFixed(1)) : 0
    },
    tier_distribution: tierDistribution,
    model_breakdown: modelBreakdown,
    time_series: timeSeries
  };
}

console.log(JSON.stringify(processTokenData(sampleRows, '2026-10', 'month'), null, 2));
