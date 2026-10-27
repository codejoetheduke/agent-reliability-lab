import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const releaseTargets = [
  'x86_64-pc-windows-msvc',
  'x86_64-unknown-linux-gnu',
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
];

/** Refuse partial or altered installers before creating/updating a release. */
export function verifyReleaseAssets(directory) {
  const names = readdirSync(directory);
  const installers = names.filter((name) => /\.(exe|msi|dmg|deb|rpm|AppImage)$/.test(name));
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
