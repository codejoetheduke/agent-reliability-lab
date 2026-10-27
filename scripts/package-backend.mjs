import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const python =
  process.env.LAB_PYTHON || path.join(root, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python))
  throw new Error('Create .venv or set LAB_PYTHON to the build interpreter.');
const target = spawnSync('rustc', ['--print', 'host-tuple'], { encoding: 'utf8' });
if (target.status !== 0 || !/^[a-zA-Z0-9_-]+$/.test(target.stdout.trim()))
  throw new Error('Rust host target is unavailable.');
const triple = target.stdout.trim();
const build = path.join(root, '.local', 'sidecar-build');
const result = spawnSync(
  python,
  [
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onefile',
    '--name',
    'reliability-backend',
    '--collect-data',
    'reliability_lab',
    '--distpath',
    path.join(build, 'dist'),
    '--workpath',
    path.join(build, 'work'),
    '--specpath',
    build,
    path.join(root, 'scripts/backend-entry.py'),
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const directory = path.join(root, 'apps/desktop/src-tauri/binaries');
mkdirSync(directory, { recursive: true });
const name = `reliability-backend-${triple}${windows ? '.exe' : ''}`;
const destination = path.join(directory, name);
copyFileSync(path.join(build, 'dist', `reliability-backend${windows ? '.exe' : ''}`), destination);
if (!windows) chmodSync(destination, 0o755);
console.log(`Packaged Python backend for ${triple}.`);
