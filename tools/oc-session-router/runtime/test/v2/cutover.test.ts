import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const routerRoot = path.dirname(runtimeRoot);

test("default build and test scripts select V2 and required SQLite runtime support", () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts.build, "node build.mjs");
  assert.match(manifest.scripts.test!, /--experimental-sqlite/);
  assert.match(manifest.scripts.test!, /--test\s+dist\/test\/v2\/\*\.test\.js/);
  assert.doesNotMatch(manifest.scripts.test!, /dist\/test\/\*\.test\.js/);
  const config = JSON.parse(readFileSync(path.join(runtimeRoot, "tsconfig.json"), "utf8")) as { include: string[] };
  assert.ok(config.include.includes("src/v2/**/*.ts"));
  assert.ok(config.include.includes("test/v2/**/*.ts"));
  assert.ok(config.include.every(pattern => /^(src|test)\/v2\//.test(pattern)));
});

test("representative V1 executable and P0B controllers are retired; pure telemetry remains", () => {
  for (const relative of ["src/cli.ts", "src/control-plane.ts", "executable-attestation.json"]) {
    assert.equal(existsSync(path.join(runtimeRoot, relative)), false, relative);
  }
  for (const relative of ["Initialize-OCRouterControlPlane.ps1", "invoke-session-compact-lite.ps1"]) {
    assert.equal(existsSync(path.join(routerRoot, "scripts", relative)), false, relative);
  }
  assert.equal(existsSync(path.join(routerRoot, "scripts/session-context-status-core.ps1")), true);
  assert.equal(existsSync(path.join(routerRoot, "scripts/test-session-context-status.ps1")), true);
});

test("facades reach only the V2 entry and shared observation action", () => {
  const launcher = readFileSync(path.join(routerRoot, "scripts/Invoke-OCRouter.ps1"), "utf8");
  assert.match(launcher, /dist\\src\\v2\\cli\.js/);
  assert.doesNotMatch(launcher, /dist\\src\\cli\.js|P0B_ISOLATED|control-registry|executable-attestation|Invoke-Expression/i);
  const status = readFileSync(path.join(routerRoot, "scripts/session-context-status.ps1"), "utf8");
  assert.match(status, /Invoke-OCRouter\.ps1/);
  assert.match(status, /Action\s*=\s*'observe-session'/);
  assert.doesNotMatch(status, /Invoke-RestMethod|oc-router-common|session-context-status-core|\$Password/);
});

test("copied build cleans only its disposable dist before invoking its fake compiler", t => {
  const fixture = mkdtempSync(path.join(runtimeRoot, ".router-v2-cutover-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(fixture)), runtimeRoot);
    assert.ok(path.basename(fixture).startsWith(".router-v2-cutover-"));
    rmSync(fixture, { recursive: true, force: true });
  });
  assert.notEqual(path.resolve(fixture), runtimeRoot);
  copyFileSync(path.join(runtimeRoot, "build.mjs"), path.join(fixture, "build.mjs"));
  mkdirSync(path.join(fixture, "dist/src"), { recursive: true });
  mkdirSync(path.join(fixture, "dist/test"), { recursive: true });
  writeFileSync(path.join(fixture, "dist/src/cli.js"), "throw new Error('stale V1 fixture');\n");
  writeFileSync(path.join(fixture, "dist/test/old.test.js"), "// stale V1 test fixture\n");
  writeFileSync(path.join(fixture, "not-generated.txt"), "preserve fixture source\n");
  writeFileSync(path.join(fixture, "tsconfig.json"), "{}\n");
  const compilerRoot = path.join(fixture, "node_modules/typescript");
  mkdirSync(path.join(compilerRoot, "bin"), { recursive: true });
  writeFileSync(path.join(compilerRoot, "package.json"), '{"type":"commonjs"}\n');
  writeFileSync(path.join(compilerRoot, "bin/tsc"), `
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
if (fs.existsSync(path.join(root, 'dist'))) throw new Error('Generated V1 tree survived until compiler invocation');
fs.mkdirSync(path.join(root, 'dist/src/v2'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/src/v2/cli.js'), '// fresh V2 fixture output\\n');
fs.writeFileSync(path.join(root, 'compiler-call.json'), JSON.stringify({ arguments: process.argv.slice(2) }));
`);
  // Never invoke the real repository build inside its active compiled test suite.
  const result = spawnSync(process.execPath, [path.join(fixture, "build.mjs")], { cwd: fixture, encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(existsSync(path.join(fixture, "dist/src/cli.js")), false);
  assert.equal(existsSync(path.join(fixture, "dist/test/old.test.js")), false);
  assert.equal(existsSync(path.join(fixture, "dist/src/v2/cli.js")), true);
  assert.equal(readFileSync(path.join(fixture, "not-generated.txt"), "utf8"), "preserve fixture source\n");
  const invocation = JSON.parse(readFileSync(path.join(fixture, "compiler-call.json"), "utf8")) as { arguments: string[] };
  assert.deepEqual(invocation.arguments, ["-p", path.join(fixture, "tsconfig.json")]);
});
