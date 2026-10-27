// CI guardrail: scan only versioned files, never local credentials or user data.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const patterns = [
  /(?:sk-proj-|ntn_)[A-Za-z0-9_-]{24,}/,
  /AIza[A-Za-z0-9_-]{35}/,
  /AQ\.[A-Za-z0-9_-]{40,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
];
const failures = [];
for (const file of files) {
  if (/(^|\/)(api-keys\.txt|credentials\.json|\.env|node_modules|__pycache__)(\/|$)/.test(file))
    failures.push(`${file}: prohibited versioned path`);
  const data = readFileSync(file).toString('utf8');
  if (patterns.some((pattern) => pattern.test(data)))
    failures.push(`${file}: credential pattern detected`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Source credential guard passed (${files.length} versioned files).`);
