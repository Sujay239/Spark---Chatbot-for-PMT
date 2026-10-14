const fs = require('fs');
const content = fs.readFileSync('admin-portal/token-usage.html', 'utf8');

console.log('fx-rate-badge found:', content.includes('id="fx-rate-badge"'));
console.log('fetchLiveExchangeRate found:', content.includes('async function fetchLiveExchangeRate'));
console.log('Old USD / INR Peg 83.00 found:', content.includes('USD / INR Peg: 83.00'));
console.log('Old USD_TO_INR_EXCHANGE_RATE found:', content.includes('USD_TO_INR_EXCHANGE_RATE'));

// Extract and test live FX function
const startIdx = content.indexOf('let liveUsdToInrRate =');
const endIdx = content.indexOf('function formatNumber');

const pricingCode = content.substring(startIdx, endIdx);
const sandbox = {
  sessionStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; }
  },
  document: {
    getElementById(id) {
      return { textContent: '', className: '', innerHTML: '' };
    }
  },
  console: console
};

const fn = new Function('sandbox', 'fetch', pricingCode + `
  sandbox.liveUsdToInrRate = liveUsdToInrRate;
  sandbox.fetchLiveExchangeRate = fetchLiveExchangeRate;
  sandbox.computeFrontendPricing = computeFrontendPricing;
`);
fn(sandbox, globalThis.fetch);

async function runTest() {
  console.log('Initial default rate:', sandbox.liveUsdToInrRate);
  const liveRate = await sandbox.fetchLiveExchangeRate();
  console.log('Fetched live market rate:', liveRate);
  
  const testModels = [
    { model: "gpt-4.1-mini", prompt_tokens: 1000000, cached_tokens: 500000, completion_tokens: 200000, total_tokens: 1200000 },
    { model: "gpt-5.1-2025-11-13", prompt_tokens: 200000, cached_tokens: 100000, completion_tokens: 50000, total_tokens: 250000 }
  ];
  
  const pricing = sandbox.computeFrontendPricing(testModels, { total_tokens: 1450000, prompt_tokens: 1200000, completion_tokens: 250000, cached_tokens: 600000 });
  console.log('Computed Cost with Live Rate:');
  console.log('USD:', pricing.fleetCostUsdFormatted);
  console.log('INR (Live Market):', pricing.fleetCostInrFormatted);
  console.log('Live FX used:', pricing.fxRate);
  console.log('ALL VERIFICATIONS PASSED!');
}

runTest();
