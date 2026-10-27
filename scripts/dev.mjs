import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const mode = process.argv[2] ?? 'desktop';
// Only the local session nonce reaches the UI. Provider credentials stay in Python.
process.env.LAB_SESSION_TOKEN = randomBytes(32).toString('hex');
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) {
    if (child.exitCode !== null) continue;
    if (windows)
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Already exited. */
      }
    }
  }
  process.exit(code);
}

function start(command, args, cwd = root, { visible = false } = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    detached: !windows,
    windowsHide: !visible,
  });
  children.push(child);
  child.on('error', () => {
    console.error('A local process could not start. Check prerequisites.');
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(new Error(`Port ${port} is occupied. Stop the existing service first.`)),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('SIGHUP', () => stop());
process.on('exit', () => {
  if (!stopping) stop(1);
});

try {
  if (!['desktop', 'web', 'production'].includes(mode)) throw new Error('Unknown launch mode.');
  const python =
    process.env.LAB_PYTHON ||
    path.join(root, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
  if (!existsSync(python))
    throw new Error(
      'Python environment missing. Follow README setup or set LAB_PYTHON to an absolute interpreter path.',
    );
  await requireFreePort(8765);
  if (mode !== 'production') await requireFreePort(1420);
  start(python, [
    '-m',
    'uvicorn',
    'reliability_lab.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    '8765',
    '--no-access-log',
    '--timeout-graceful-shutdown',
    '2',
  ]);
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:8765/health', {
        signal: AbortSignal.timeout(500),
      });
      const body = await response.json();
      healthy =
        response.ok &&
        body.service === 'agent-reliability-lab' &&
        ['mock', 'live'].includes(body.mode);
      if (healthy) break;
    } catch {
      /* Backend is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error('Local backend did not become healthy within 15 seconds.');
  console.log('Local backend ready · http://127.0.0.1:8765');
  if (mode === 'web') {
    start(
      process.execPath,
      [path.join(root, 'node_modules/vite/bin/vite.js')],
      path.join(root, 'apps/desktop'),
    );
  } else if (mode === 'production') {
    const binary = path.join(
      root,
      'apps/desktop/src-tauri/target/release',
      windows ? 'agent-reliability-lab.exe' : 'agent-reliability-lab',
    );
    if (!existsSync(binary))
      throw new Error('Build the native application first: npm run build:desktop');
    start(binary, [], root, { visible: true });
  } else {
    start(
      process.execPath,
      [path.join(root, 'scripts/native.mjs'), 'dev'],
      path.join(root, 'apps/desktop'),
    );
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
