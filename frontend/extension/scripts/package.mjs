// Packages the built Chrome extension as one ready-to-load folder inside one zip:
//   dist/coding-journey-extension.zip
//     └── coding-journey-extension/   <- unzip, then "Load unpacked" this folder
//           ├── manifest.json
//           └── ...
// Run after `wxt build` (see the "package" script in package.json).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const built = join(dist, 'chrome-mv3');
const name = 'coding-journey-extension';
const folder = join(dist, 'package', name);
const zip = join(dist, `${name}.zip`);

if (!existsSync(join(built, 'manifest.json'))) {
  console.error('No build found at dist/chrome-mv3. Run `npm run build` first.');
  process.exit(1);
}

rmSync(join(dist, 'package'), { recursive: true, force: true });
rmSync(zip, { force: true });
cpSync(built, folder, { recursive: true });
// -X drops macOS extra attributes; -r recurses. Zip from dist/package so the archive holds one folder.
execFileSync('zip', ['-qrX', zip, name], { cwd: join(dist, 'package'), stdio: 'inherit' });
console.log(`Packaged ${name}/ -> dist/${name}.zip`);
