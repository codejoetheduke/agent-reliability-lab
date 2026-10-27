// The only release writer. Runs after every quality/build job has succeeded.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { verifyReleaseAssets } from './release-assets.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const tag = process.env.RELEASE_TAG;
const token = process.env.GITHUB_TOKEN;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!token || !repository || tag !== `v${version}`)
  throw new Error('Release tag must match the package version.');
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};
async function api(route, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}${route}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (response.status === 404 && !options.method) return null;
  if (!response.ok) throw new Error(`GitHub release request failed (${response.status}).`);
  if (response.status === 204) return null;
  return response.json();
}
const directory = '.local/release-downloads';
const verified = verifyReleaseAssets(directory);
const manifest = {
  version,
  tag,
  source_commit: process.env.GITHUB_SHA,
  default_provider: 'gemini',
  credentials_embedded: false,
  signing: { windows: 'unsigned private preview', macos: 'ad-hoc, not notarized' },
  installers: verified.installers,
};
writeFileSync(
  path.join(directory, 'release-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
let release = await api(`/releases/tags/${encodeURIComponent(tag)}`);
if (release && !release.draft) {
  if (release.target_commitish === process.env.GITHUB_SHA) {
    console.log(`This source revision is already published: ${release.html_url}`);
    process.exit(0);
  }
  throw new Error('The tag already has a published release; use a new version.');
}
release ??= await api('/releases', {
  method: 'POST',
  body: JSON.stringify({
    tag_name: tag,
    name: `Agent Reliability Lab ${tag}`,
    draft: true,
    prerelease: true,
    target_commitish: process.env.GITHUB_SHA,
    body: readFileSync('docs/release-notes.md', 'utf8'),
  }),
});
try {
  const files = [...verified.files, 'release-manifest.json'];
  for (const name of files) {
    const existing = release.assets?.find((asset) => asset.name === name);
    if (existing) await api(`/releases/assets/${existing.id}`, { method: 'DELETE' });
    const response = await fetch(
      `${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: readFileSync(path.join(directory, name)),
      },
    );
    if (!response.ok)
      throw new Error(`Installer upload failed (${response.status}); release remains a draft.`);
  }
  await api(`/releases/${release.id}`, { method: 'PATCH', body: JSON.stringify({ draft: false }) });
  console.log(`Published private preview release: ${release.html_url}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
