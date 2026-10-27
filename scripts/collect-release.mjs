import { readdirSync } from 'node:fs';
import path from 'node:path';
import { collectReleaseAssets } from './release-assets.mjs';

const target = process.argv[2];
if (!/^[a-zA-Z0-9_-]+$/.test(target ?? '')) throw new Error('Provide the release target.');
const output = path.resolve('.local/release-assets', target);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)],
  );
}
const files = walk('apps/desktop/src-tauri/target/release/bundle').filter((file) =>
  /\.(exe|msi|dmg|deb|rpm|AppImage)$/.test(file),
);
collectReleaseAssets(files, output, target);
console.log(`Collected ${files.length} installers for ${target}.`);
