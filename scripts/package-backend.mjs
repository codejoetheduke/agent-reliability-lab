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
// Some managed Python distributions add a CA distrust file to stdlib ssl.py.
// Preserve that runtime policy in the frozen executable rather than bypassing it.
const policy = spawnSync(
  python,
  [
    '-c',
    'import pathlib,ssl; p=pathlib.Path(ssl.__file__).with_name("codex-rejected-cas.pem"); print(p if p.is_file() else "")',
  ],
  {
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1' },
  },
);
if (policy.status !== 0) throw new Error('Unable to inspect Python runtime data.');
const policyFile = policy.stdout.trim();
const runtimeData = policyFile ? ['--add-data', `${policyFile}${path.delimiter}.`] : [];
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
    ...runtimeData,
    '--distpath',
    path.join(build, 'dist'),
    '--workpath',
    path.join(build, 'work'),
    '--specpath',
    build,
    path.join(root, 'scripts/backend-entry.py'),
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const directory = path.join(root, 'apps/desktop/src-tauri/binaries');
mkdirSync(directory, { recursive: true });
const name = `reliability-backend-${triple}${windows ? '.exe' : ''}`;
const destination = path.join(directory, name);
copyFileSync(path.join(build, 'dist', `reliability-backend${windows ? '.exe' : ''}`), destination);
if (!windows) chmodSync(destination, 0o755);
console.log(`Packaged Python backend for ${triple}.`);
