// Exercise the frozen binary from a fresh working directory with no credentials.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const triple = spawnSync('rustc', ['--print', 'host-tuple'], { encoding: 'utf8' }).stdout.trim();
const binary =
  process.env.LAB_SIDECAR_BINARY ||
  path.join(
    root,
    'apps/desktop/src-tauri/binaries',
    `reliability-backend-${triple}${process.platform === 'win32' ? '.exe' : ''}`,
  );
const directory = mkdtempSync(path.join(tmpdir(), 'reliability-sidecar-'));
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const token = randomBytes(32).toString('hex');
const credentials = path.join(directory, 'private-test-settings.json');
writeFileSync(credentials, '{}');
const proxy = createServer();
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const proxyPort = proxy.address().port;
await new Promise((resolve) => proxy.close(resolve));
const environment = {
  ...process.env,
  LAB_DATA_DIR: directory,
  LAB_PORT: String(port),
  LAB_PARENT_MANAGED: '1',
  LAB_SESSION_TOKEN: token,
  LAB_CREDENTIALS_FILE: credentials,
  LAB_DEFAULT_PROVIDER: 'gemini',
  OPENAI_API_KEY: '',
  NOTION_API_KEY: '',
  NOTION_ROOT_PAGE_IDS: '',
  HTTPS_PROXY: `http://127.0.0.1:${proxyPort}`,
  HTTP_PROXY: `http://127.0.0.1:${proxyPort}`,
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
};
delete environment.GEMINI_API_KEY;
delete environment.GOOGLE_API_KEY;
const child = spawn(binary, [], {
  cwd: directory,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: environment,
});
let diagnostics = '';
child.stderr.on('data', (chunk) => {
  diagnostics = (diagnostics + chunk).slice(-2000);
});
const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
const sockets = [];
const base = `http://127.0.0.1:${port}`;
async function request(route, options = {}) {
  return fetch(base + route, {
    ...options,
    headers: { 'X-Lab-Token': token, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(4000),
  });
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await request('/session')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Extracting/starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, `Frozen backend did not become ready: ${diagnostics}`);
  assert.equal((await (await request('/health')).json()).mode, 'live');
  assert.equal((await fetch(base + '/session')).status, 401);
  const configuration = await (await request('/config')).json();
  assert.equal(configuration.default_provider, 'gemini');
  assert.equal(configuration.gemini_configured, false);
  assert.equal(
    (
      await request('/agent/query', {
        method: 'POST',
        body: JSON.stringify({ question: 'Who owns Atlas?', allow_external_transmission: true }),
      })
    ).status,
    503,
  );
  // Initialize the actual HTTPS stack without sending a request to Google.
  // A refused connection to an unused local proxy must be a safe provider error.
  writeFileSync(credentials, JSON.stringify({ GEMINI_API_KEY: 'unit-test-not-a-real-key' }));
  const unavailable = await request('/agent/query', {
    method: 'POST',
    body: JSON.stringify({
      question: 'Who owns Atlas?',
      provider: 'gemini',
      allow_external_transmission: true,
    }),
  });
  assert.equal(unavailable.status, 502, `HTTPS initialization failed: ${diagnostics}`);
  assert.equal((await unavailable.json()).code, 'provider_error');
  writeFileSync(credentials, '{}');
  const answer = await (
    await request('/agent/query', {
      method: 'POST',
      body: JSON.stringify({ question: 'Who owns Atlas?', provider: 'mock' }),
    })
  ).json();
  assert.equal(answer.answer, 'Atlas owner is Maya Chen.');
  assert.equal(answer.simulated, true);
  const run = await (
    await request('/runs', {
      method: 'POST',
      body: JSON.stringify({ provider: 'mock', label: 'Frozen binary verification' }),
    })
  ).json();
  let detail;
  for (let i = 0; i < 80; i++) {
    detail = await (await request(`/runs/${run.id}`)).json();
    if (detail.status === 'completed') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(detail.status, 'completed');
  assert.equal(detail.summary.tests_passed, 29);
  // Close during an actual in-flight evaluation, using a local stalled proxy.
  // No request reaches Google, and the dummy credential cannot authorize one.
  writeFileSync(credentials, JSON.stringify({ GEMINI_API_KEY: 'unit-test-not-a-real-key' }));
  let signalConnected;
  const connected = new Promise((resolve) => {
    signalConnected = resolve;
  });
  proxy.on('connection', (socket) => {
    sockets.push(socket);
    signalConnected();
  });
  await new Promise((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve));
  const pending = await request('/runs', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'gemini',
      allow_external_transmission: true,
      label: 'Interrupted frozen evaluation',
    }),
  });
  assert.equal(pending.status, 202);
  await Promise.race([
    connected,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Provider request did not reach the local test proxy.')),
        3000,
      ).unref(),
    ),
  ]);
  // Graceful parent-pipe closure must stop active work and the bootloader.
  child.stdin.end();
  const code = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000)),
  ]);
  assert.equal(code, 0, 'Frozen backend did not stop when its parent closed stdin.');
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
  console.log(
    `Frozen backend verified on ${process.platform}/${process.arch}: live defaults, authorization, fixtures, 29 cases, parent shutdown.`,
  );
} finally {
  for (const socket of sockets) socket.destroy();
  if (proxy.listening) await new Promise((resolve) => proxy.close(resolve));
  if (!child.stdin.writableEnded) child.stdin.end();
  if (child.exitCode === null) child.kill();
}
