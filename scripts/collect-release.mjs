import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!/^[a-zA-Z0-9_-]+$/.test(target ?? '')) throw new Error('Provide the release target.');
const output = path.resolve('.local/release-assets', target);
mkdirSync(output, { recursive: true });
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)],
  );
}
const files = walk('apps/desktop/src-tauri/target/release/bundle').filter((file) =>
  /\.(exe|msi|dmg|deb|rpm|AppImage)$/.test(file),
);
if (!files.length) throw new Error('No installer assets were produced.');
const sums = [];
for (const file of files) {
  const name = path.basename(file);
  copyFileSync(file, path.join(output, name));
  sums.push(`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${name}`);
}
writeFileSync(path.join(output, `SHA256SUMS-${target}.txt`), sums.join('\n') + '\n');
console.log(`Collected ${files.length} installers for ${target}.`);
