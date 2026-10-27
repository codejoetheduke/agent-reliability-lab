// Re-test the embedded executable after Tauri has applied bundle signing.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const directory = 'apps/desktop/src-tauri/target/release/bundle/macos';
const applications = readdirSync(directory).filter((name) => name.endsWith('.app'));
if (applications.length !== 1) throw new Error('Expected exactly one macOS application bundle.');
const binary = path.resolve(directory, applications[0], 'Contents/MacOS/reliability-backend');
const result = spawnSync(process.execPath, ['scripts/smoke-sidecar.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, LAB_SIDECAR_BINARY: binary },
});
process.exit(result.status ?? 1);
