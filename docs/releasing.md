# Desktop release process

## Pipeline

1. Pull requests and main pushes run backend tests, Ruff, TypeScript, ESLint, frontend tests, credential-pattern checks, and frontend builds on Windows/macOS/Linux.
2. Linux also runs real-service Chromium workflows.
3. Four native jobs freeze Python, verify the resulting executable from a fresh directory, lint Rust, and build installers.
4. Only when every job succeeds are downloadable build artifacts retained.
5. A version tag runs that same workflow. The publishing job requires all targets, uploads installers/checksums to a draft, then publishes the private preview. An upload failure leaves a draft instead of a partial published release.

Actions are pinned to verified immutable commits. Jobs have read-only repository permission except the final publisher's contents-write permission. No Gemini, OpenAI, or Notion token is needed or embedded in CI. GitHub Actions usage for a private repository follows the account's included minutes/storage and configured limits.

| Runner       | Target                   | Assets          |
| ------------ | ------------------------ | --------------- |
| Windows      | x86_64-pc-windows-msvc   | NSIS .exe       |
| Ubuntu 22.04 | x86_64-unknown-linux-gnu | .deb, .AppImage |
| macOS ARM    | aarch64-apple-darwin     | .dmg            |
| macOS Intel  | x86_64-apple-darwin      | .dmg            |

Python must be frozen natively on each architecture; Rust cross-compilation alone is insufficient. The minimum macOS bundle target is 13.0. Linux compatibility is bounded by the build image's glibc and required WebKitGTK libraries. Windows ARM and Linux ARM are not current targets.

## Create a release

Update root/frontend package versions, Cargo version, backend version, API version contracts, and release notes consistently. Commit the release candidate and verify the main CI run. Create a matching version tag, for example:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The publisher rejects a tag that does not match package.json. It verifies all four target checksum manifests exist. The release is marked prerelease for this private preview. Use the GitHub Actions run and release assets as the actual build evidence; generating YAML alone is not proof that another OS works.

Local Windows packaging can target the installer explicitly:

```sh
npm run package:backend
npm run test:sidecar
node scripts/native.mjs build --bundles nsis
```

## Signing and distribution limits

The current private preview has no Windows Authenticode certificate or Apple Developer notarization credentials. macOS bundles use ad-hoc signing. These are not signed/notarized public installers, and OS trust warnings or blocks can occur. Do not bypass security barriers; use a signed build or source-development workflow.

Before public distribution, supply the supported Tauri signing/notarization configuration, keep certificates/passwords in protected CI secrets, and verify signatures on each asset. Do not commit signing keys. Add a signed updater only after its trust and rollback model is designed. A public Notion connection also needs the supported OAuth flow and appropriate review; internal workspace tokens are not public desktop authentication.

The private release bundles no provider credential or Notion workspace. Every user connects their own permitted test sources and provider account. The app does not enable paid billing or change provider account settings.
