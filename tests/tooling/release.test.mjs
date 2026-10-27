import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectReleaseAssets,
  releaseTargets,
  verifyReleaseAssets,
} from '../../scripts/release-assets.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'release-manifest-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const target of releaseTargets) {
    const name = `${target}.dmg`;
    const bytes = Buffer.from(`temporary test bytes for ${target}`);
    writeFileSync(path.join(directory, name), bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(path.join(directory, `SHA256SUMS-${target}.txt`), `${hash}  ${name}\n`);
  }
  return directory;
}
test('every required target and installer checksum must be verified', (t) => {
  const result = verifyReleaseAssets(fixture(t));
  assert.equal(result.installers.length, 4);
  assert.deepEqual(new Set(result.installers.map((item) => item.target)), new Set(releaseTargets));
});
test('a missing platform blocks publication', (t) => {
  const directory = fixture(t);
  rmSync(path.join(directory, `SHA256SUMS-${releaseTargets[0]}.txt`));
  assert.throws(() => verifyReleaseAssets(directory), /Missing build target/);
});
test('altered installer bytes block publication', (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, `${releaseTargets[0]}.dmg`), 'altered');
  assert.throws(() => verifyReleaseAssets(directory), /checksum mismatch/);
});
test('an unverified extra installer blocks publication', (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, 'unexpected.exe'), 'unverified');
  assert.throws(() => verifyReleaseAssets(directory), /lacks a verified checksum/);
});

test('installer names with spaces are normalized before checksums and publication', (t) => {
  const directory = fixture(t);
  const input = path.join(directory, 'input');
  mkdirSync(input);
  const original = path.join(input, 'Agent Reliability Lab_0.1.1_x64-setup.exe');
  const bytes = Buffer.from('actual installer bytes remain unchanged');
  writeFileSync(original, bytes);
  rmSync(path.join(directory, `${releaseTargets[0]}.dmg`));
  collectReleaseAssets([original], directory, releaseTargets[0]);
  const result = verifyReleaseAssets(directory);
  const installer = result.installers.find((item) => item.target === releaseTargets[0]);
  assert.equal(installer.name, 'Agent.Reliability.Lab_0.1.1_x64-setup.exe');
  assert.deepEqual(readFileSync(path.join(directory, installer.name)), bytes);
  assert(readdirSync(directory).includes(installer.name));
});

test('unsafe unnormalized names block publication', (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, 'Name with spaces.exe'), 'unverified');
  assert.throws(() => verifyReleaseAssets(directory), /normalized before checksum/);
});

test('normalization cannot silently overwrite an installer', (t) => {
  const directory = fixture(t);
  const input = path.join(directory, 'input');
  mkdirSync(input);
  const files = ['Agent Lab.exe', 'Agent.Lab.exe'].map((name) => path.join(input, name));
  for (const file of files) writeFileSync(file, 'installer');
  assert.throws(() => collectReleaseAssets(files, directory, releaseTargets[0]), /collision/);
});
