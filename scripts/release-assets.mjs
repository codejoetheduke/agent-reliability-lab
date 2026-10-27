import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const releaseTargets = [
  'x86_64-pc-windows-msvc',
  'x86_64-unknown-linux-gnu',
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
];

/** Use stable ASCII asset names before hashing; GitHub rewrites spaces on upload. */
export function releaseAssetName(name) {
  if (path.basename(name) !== name) throw new Error('Expected an installer basename.');
  return name.replace(/[^A-Za-z0-9._-]/g, '.');
}

export function collectReleaseAssets(files, output, target) {
  if (!releaseTargets.includes(target)) throw new Error('Unknown release target.');
  if (!files.length) throw new Error('No installer assets were produced.');
  mkdirSync(output, { recursive: true });
  const names = new Set();
  const sums = [];
  for (const file of files) {
    const name = releaseAssetName(path.basename(file));
    if (names.has(name)) throw new Error(`Installer filename collision: ${name}`);
    names.add(name);
    copyFileSync(file, path.join(output, name));
    sums.push(`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${name}`);
  }
  writeFileSync(path.join(output, `SHA256SUMS-${target}.txt`), sums.join('\n') + '\n');
}

/** Refuse partial or altered installers before creating/updating a release. */
export function verifyReleaseAssets(directory) {
  const names = readdirSync(directory);
  const installers = names.filter((name) => /\.(exe|msi|dmg|deb|rpm|AppImage)$/.test(name));
  if (installers.some((name) => releaseAssetName(name) !== name))
    throw new Error('Installer names must be normalized before checksum generation.');
  const verified = new Map();
  for (const target of releaseTargets) {
    const checksumName = `SHA256SUMS-${target}.txt`;
    if (!names.includes(checksumName)) throw new Error(`Missing build target: ${target}`);
    const lines = readFileSync(path.join(directory, checksumName), 'utf8').trim().split('\n');
    if (!lines.length) throw new Error(`Empty checksum manifest: ${target}`);
    for (const line of lines) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line.trim());
      if (!match || path.basename(match[2]) !== match[2] || !installers.includes(match[2]))
        throw new Error(`Invalid installer checksum entry: ${target}`);
      const [, expected, name] = match;
      const digest = createHash('sha256')
        .update(readFileSync(path.join(directory, name)))
        .digest('hex');
      if (digest !== expected) throw new Error(`Installer checksum mismatch: ${name}`);
      if (verified.has(name)) throw new Error(`Duplicate installer asset: ${name}`);
      verified.set(name, { name, sha256: digest, target });
    }
  }
  if (verified.size !== installers.length)
    throw new Error('An installer lacks a verified checksum.');
  return {
    files: [...installers, ...releaseTargets.map((target) => `SHA256SUMS-${target}.txt`)],
    installers: [...verified.values()],
  };
}
