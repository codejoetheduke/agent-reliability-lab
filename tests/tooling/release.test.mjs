import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { releaseTargets, verifyReleaseAssets } from '../../scripts/release-assets.mjs';

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
