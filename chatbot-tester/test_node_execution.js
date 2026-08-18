const fs = require('fs');

function testScript(filePath, inputQuery) {
  let code = fs.readFileSync(filePath, 'utf8');
  const $json = { query: { chatInput: inputQuery, sessionId: 'session-123' } };
  const $input = { first: () => ({ json: $json }) };
  const $getWorkflowStaticData = () => ({});
  const $ = () => ({ first: () => ({ json: $json }) });
  
  const fn = new Function('$json', '$input', '$getWorkflowStaticData', '$', code);
  return fn($json, $input, $getWorkflowStaticData, $);
}

console.log("=== Testing 1.js ===");
console.log("1. Gibberish:", testScript('1.js', 'fuihDfuhnsDIO gfjpISDJgfpisSDJGF'));
console.log("2. Non-English:", testScript('1.js', 'Hola, ¿cómo estás?'));
console.log("3. Follow up question:", testScript('1.js', 'how many times a week should I be using this?'));

console.log("\n=== Testing 2.js ===");
console.log("1. Gibberish:", testScript('2.js', 'fuihDfuhnsDIO gfjpISDJgfpisSDJGF'));
console.log("2. Non-English:", testScript('2.js', 'Hola, ¿cómo estás?'));
console.log("3. Follow up question:", testScript('2.js', 'how many times a week should I be using this?'));
