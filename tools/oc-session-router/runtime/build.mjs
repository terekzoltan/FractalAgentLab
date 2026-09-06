import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
// Clean this generated tree so stale V1 executables cannot ship with V2.
if (path.dirname(output) !== root || (existsSync(output) &&
    (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output))) {
  throw new Error('Build output is not the local generated dist directory');
}
rmSync(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.json')],
  { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw new Error('TypeScript compiler could not start');
process.exitCode = result.status ?? 1;
