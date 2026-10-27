import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function nativeEnvironment() {
  if (process.platform !== 'win32' || process.env.VSCMD_VER) return process.env;
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio/Installer/vswhere.exe',
  );
  if (!existsSync(vswhere)) return process.env;
  // Include installations with incomplete metadata: their tools may still be usable.
  const lookup = spawnSync(
    vswhere,
    ['-latest', '-all', '-products', '*', '-property', 'installationPath'],
    { encoding: 'utf8', windowsHide: true },
  );
  const installation = lookup.stdout?.trim();
  if (!installation || /[\r\n"]/u.test(installation)) return process.env;
  const developerScript = path.join(installation, 'Common7/Tools/VsDevCmd.bat');
  if (!existsSync(developerScript)) return process.env;
  const setup = spawnSync(
    'cmd.exe',
    ['/d', '/s', '/c', `call "${developerScript}" -no_logo -arch=x64 >nul && set`],
    { encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true },
  );
  if (setup.status !== 0)
    throw new Error(
      'Visual Studio environment setup failed. Repair the C++ workload and Windows SDK.',
    );
  const environment = { ...process.env };
  const toolVariable =
    /^(path|include|lib|libpath|windows.*|vc.*|vs.*|visualstudio.*|universalcrt.*|ucrt.*|framework.*|extension.*|netfx.*|__vscmd.*|preferredtoolarchitecture)$/iu;
  for (const line of setup.stdout.split(/\r?\n/u)) {
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    if (!toolVariable.test(key)) continue;
    const prior = Object.keys(environment).find((name) => name.toLowerCase() === key.toLowerCase());
    if (prior) delete environment[prior];
    environment[key] = line.slice(separator + 1);
  }
  console.log('Using the installed Visual Studio developer tools.');
  return environment;
}

try {
  const cargo = process.argv[2] === '--cargo';
  const child = spawn(
    cargo ? 'cargo' : process.execPath,
    cargo
      ? process.argv.slice(3)
      : [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'), ...process.argv.slice(2)],
    {
      cwd: path.join(root, cargo ? 'apps/desktop/src-tauri' : 'apps/desktop'),
      env: nativeEnvironment(),
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  child.on('error', () => {
    console.error('The Tauri process could not start.');
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
