import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');

function fail(message) {
  console.error('KODEX VALIDATION FAILED:', message);
  process.exit(1);
}

if (!html.includes('<script>') || !html.includes('</script>')) {
  fail('index.html does not contain the expected inline script.');
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1])
  .filter(s => s.trim());

if (!scripts.length) fail('No JavaScript blocks found.');

for (let i = 0; i < scripts.length; i++) {
  try {
    new vm.Script(scripts[i], { filename: `index.html<script#${i + 1}>` });
  } catch (error) {
    fail(`JavaScript syntax error in script #${i + 1}: ${error.message}`);
  }
}

for (const file of ['index.html', 'sw.js', 'meiocglogo.png', 'indexes/search.json']) {
  if (!fs.existsSync(file)) fail(`Required file missing: ${file}`);
}

const index = JSON.parse(fs.readFileSync('indexes/search.json', 'utf8'));
if (!Array.isArray(index) || index.length === 0) {
  fail('indexes/search.json is not a populated card array.');
}

const requiredStrings = [
  'function init()',
  'function openCard(',
  'function renderQAs(',
  'function translateText(',
  "navigator.serviceWorker.register('sw.js?v=9')"
];

for (const needle of requiredStrings) {
  if (!html.includes(needle)) fail(`Expected application function/registration missing: ${needle}`);
}

console.log(`KodeX validation passed: ${index.length.toLocaleString()} cards, JavaScript syntax valid, required assets present.`);
