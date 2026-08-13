import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts");
const docs = path.resolve(scripts, "../docs");
const retired = [
  "run-plan-review-flow.ps1", "run-parallel-plan-review-flow.ps1", "run-step-review-flow.ps1", "run-parallel-step-review-flow.ps1",
  "run-review-fix-cycle.ps1", "run-parallel-review-fix-cycle.ps1", "route-packet.ps1", "route-latest-output.ps1", "send-message.ps1",
  "reply-question.ps1", "inspect-parallel-run.ps1", "init-router-runtime.ps1", "wait-latest-output.ps1", "validate-packet.ps1",
];

test("all admitted competing lifecycle paths fail closed", () => {
  for (const name of retired) {
    const content = readFileSync(path.join(scripts, name), "utf8");
    const marker = content.indexOf("FAL_EXPLICIT_STAGE_ROUTER_RETIRED");
    const firstTransport = content.search(/Invoke-RestMethod|Invoke-WebRequest|\/command|\/message|\/question/);
    assert.ok(marker >= 0, `${name} lacks retirement marker`);
    assert.ok(firstTransport < 0 || marker < firstTransport, `${name} can reach transport before retirement`);
  }
});

test("FSR-019: retired wrappers exit at the retirement marker before transport", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-retired-wrapper-"));
  const harness = [
    "$ScriptPath=$env:FAL_TEST_SCRIPT",
    "$tokens=$null; $errors=$null",
    "$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$errors)",
    "if($errors.Count -ne 0){throw 'fixture parser failed'}",
    "$bound=@{}",
    "foreach($parameter in $ast.ParamBlock.Parameters){",
    "  $mandatory=$false",
    "  foreach($attribute in $parameter.Attributes){if($attribute.TypeName.Name -eq 'Parameter'){foreach($argument in $attribute.NamedArguments){if($argument.ArgumentName -eq 'Mandatory' -and $argument.Argument.Extent.Text -match '\\$true|^true$'){$mandatory=$true}}}}",
    "  if($mandatory){",
    "    $name=$parameter.Name.VariablePath.UserPath; $type=$parameter.StaticType.FullName",
    "    $fixture='fixture'; foreach($attribute in $parameter.Attributes){if($attribute.TypeName.Name -eq 'ValidateSet' -and $attribute.PositionalArguments.Count -gt 0){$fixture=$attribute.PositionalArguments[0].Extent.Text.Trim([char]39,[char]34)}}",
    "    if($type -match 'Int'){ $bound[$name]=1 } elseif($type -match 'Boolean|SwitchParameter'){ $bound[$name]=$true } elseif($type -match '\\[\\]$'){ $bound[$name]=@($fixture) } else { $bound[$name]=$fixture }",
    "  }",
    "}",
    "& $ScriptPath @bound",
  ].join("; ");
  try {
    for (const name of retired) {
      const script = path.join(scripts, name);
      const env: NodeJS.ProcessEnv = {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        PATH: process.env.PATH,
        TEMP: root,
        TMP: root,
        USERPROFILE: root,
        OPENCODE_SERVER_USERNAME: "fixture-user",
        OPENCODE_SERVER_PASSWORD: "fixture-password",
        OPENCODE_SERVER_URL: "http://127.0.0.1:1",
        OC_ROUTER_RUNTIME_ROOT: path.join(root, "runtime"),
        OC_ROUTER_CONTROL_REGISTRY: path.join(root, "unreachable-registry.json"),
        FAL_TEST_SCRIPT: script,
      };
      const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", harness], { encoding: "utf8", timeout: 5_000, windowsHide: true, env });
      assert.equal(result.error, undefined, `${name} timed out or failed to launch`);
      assert.notEqual(result.status, 0, `${name} unexpectedly succeeded`);
      const output = `${result.stdout}\n${result.stderr}`;
      const marker = output.indexOf("FAL_EXPLICIT_STAGE_ROUTER_RETIRED");
      const transport = output.search(/Invoke-RestMethod|Invoke-WebRequest|\/command|\/message|\/question|HTTP [1-5][0-9][0-9]/i);
      assert.ok(marker >= 0, `${name} did not execute its retirement marker: ${output}`);
      assert.ok(transport < 0 || marker < transport, `${name} emitted transport-shaped output before retirement`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy diagnostic write modes fail closed", () => {
  const latest = readFileSync(path.join(scripts, "read-latest-output.ps1"), "utf8");
  const extract = readFileSync(path.join(scripts, "extract-track-response-block.ps1"), "utf8");
  assert.match(latest, /FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE/);
  assert.match(extract, /FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE/);
  assert.ok(latest.indexOf("FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE") < latest.indexOf("Set-Content"));
  assert.ok(extract.indexOf("FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE") < extract.indexOf("Set-Content"));
});

test("new entrypoint never installs or embeds a transport endpoint", () => {
  const launcher = readFileSync(path.join(scripts, "Invoke-OCRouter.ps1"), "utf8");
  assert.doesNotMatch(launcher, /npm\s+(install|ci)|Invoke-RestMethod|https?:\/\//i);
  assert.match(launcher, /OC_ROUTER_CONTROL_REGISTRY/);
  assert.match(launcher, /ExpectedAttestationSha256/);
  assert.doesNotMatch(launcher, /&\s+node\.exe/i);
});

test("FSR-047: compiled production Git identity matches launcher attestation", () => {
  const cli = readFileSync(path.resolve(scripts, "../runtime/src/cli.ts"), "utf8");
  const attestation = JSON.parse(readFileSync(path.resolve(scripts, "../runtime/executable-attestation.json"), "utf8")) as { git_executable_path: string; git_executable_sha256: string };
  assert.equal(cli.includes(JSON.stringify(attestation.git_executable_path)), true);
  assert.equal(cli.includes(JSON.stringify(attestation.git_executable_sha256)), true);
  assert.doesNotMatch(cli, /OC_ROUTER_VERIFIED_ATTESTATION_SHA256/);
});

test("FSR-021: launcher pins attestation, Node, and compiled entry before execution", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-launcher-attestation-"));
  try {
    const copiedScripts = path.join(root, "scripts");
    const copiedRuntime = path.join(root, "runtime");
    mkdirSync(copiedScripts);
    mkdirSync(path.join(copiedRuntime, "dist", "src"), { recursive: true });
    copyFileSync(path.join(scripts, "Invoke-OCRouter.ps1"), path.join(copiedScripts, "Invoke-OCRouter.ps1"));
    copyFileSync(path.resolve(scripts, "../runtime/executable-attestation.json"), path.join(copiedRuntime, "executable-attestation.json"));
    copyFileSync(path.resolve(scripts, "../runtime/dist/src/cli.js"), path.join(copiedRuntime, "dist", "src", "cli.js"));
    const powershell = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const run = () => spawnSync(powershell, ["-NoProfile", "-File", path.join(copiedScripts, "Invoke-OCRouter.ps1"), "-Operation", "get-run", "-RunId", "fixture"], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: root, PATH: root } });

    writeFileSync(path.join(copiedRuntime, "dist", "src", "cli.js"), "tampered\n");
    const distTamper = run();
    assert.notEqual(distTamper.status, 0);
    assert.match(distTamper.stderr, /Compiled router entry hash mismatch/);

    copyFileSync(path.resolve(scripts, "../runtime/dist/src/cli.js"), path.join(copiedRuntime, "dist", "src", "cli.js"));
    const manifest = JSON.parse(readFileSync(path.join(copiedRuntime, "executable-attestation.json"), "utf8"));
    manifest.compiled_entry_sha256 = "0".repeat(64);
    writeFileSync(path.join(copiedRuntime, "executable-attestation.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    const manifestTamper = run();
    assert.notEqual(manifestTamper.status, 0);
    assert.match(manifestTamper.stderr, /Executable attestation hash mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-028: launcher excludes ambient Node bootstrap code", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-launcher-node-options-"));
  try {
    const sentinel = path.join(root, "preload-ran.txt");
    const preload = path.join(root, "preload.cjs");
    writeFileSync(preload, `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, process.env.OPENCODE_SERVER_PASSWORD || "missing")\n`);
    const launcher = path.join(scripts, "Invoke-OCRouter.ps1");
    const result = spawnSync(path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-File", launcher, "-Operation", "get-run", "-RunId", "missing-run"], {
      encoding: "utf8",
      env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: root, OPENCODE_SERVER_PASSWORD: "fixture-private", NODE_OPTIONS: `--require=${preload}`, NODE_PATH: root },
    });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(sentinel), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-034: launcher environment helper excludes NODE_PATH and restores the same process", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-launcher-environment-helper-"));
  try {
    const moduleRoot = path.join(root, "modules");
    const moduleDir = path.join(moduleRoot, "ambient-sentinel");
    mkdirSync(moduleDir, { recursive: true });
    const sentinel = path.join(root, "node-path-ran.txt");
    writeFileSync(path.join(moduleDir, "index.js"), `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "ran")\n`);
    const launcher = path.join(scripts, "Invoke-OCRouter.ps1");
    const helper = [
      `$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${JSON.stringify(launcher)},[ref]$tokens,[ref]$errors)`,
      '$fn=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Invoke-WithRouterEnvironment"},$true)',
      'Invoke-Expression $fn.Extent.Text',
      '$beforeNodePath=[Environment]::GetEnvironmentVariable("NODE_PATH","Process")',
      '$beforeSentinel=[Environment]::GetEnvironmentVariable("OC_ROUTER_RESTORE_SENTINEL","Process")',
      `Invoke-WithRouterEnvironment { [Environment]::SetEnvironmentVariable("CHILD_ONLY","child","Process"); & ${JSON.stringify(process.execPath)} -e 'require("ambient-sentinel")' } | Out-Null`,
      '$success=(([Environment]::GetEnvironmentVariable("NODE_PATH","Process") -ceq $beforeNodePath) -and ([Environment]::GetEnvironmentVariable("OC_ROUTER_RESTORE_SENTINEL","Process") -ceq $beforeSentinel) -and ($null -eq [Environment]::GetEnvironmentVariable("CHILD_ONLY","Process")))',
      'try { Invoke-WithRouterEnvironment { [Environment]::SetEnvironmentVariable("CHILD_ONLY","child","Process"); throw "fixture" } } catch {}',
      '$failure=(([Environment]::GetEnvironmentVariable("NODE_PATH","Process") -ceq $beforeNodePath) -and ([Environment]::GetEnvironmentVariable("OC_ROUTER_RESTORE_SENTINEL","Process") -ceq $beforeSentinel) -and ($null -eq [Environment]::GetEnvironmentVariable("CHILD_ONLY","Process")))',
      'if(-not ($success -and $failure)){exit 9}',
    ].join(";");
    const result = spawnSync(path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-Command", helper], {
      encoding: "utf8",
      env: { ...process.env, NODE_PATH: moduleRoot, OC_ROUTER_RESTORE_SENTINEL: "original" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(sentinel), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hot cheatsheet exposes only the explicit lifecycle entrypoint", () => {
  const cheatsheet = readFileSync(path.join(docs, "session-router-cheatsheet.md"), "utf8").replace(/\r\n/g, "\n");
  const hotStart = cheatsheet.indexOf("## Current lifecycle entrypoint");
  const hotEnd = cheatsheet.indexOf("Read-only context pressure:");
  assert.ok(hotStart >= 0 && hotEnd > hotStart, "hot lifecycle section is missing");
  const hot = cheatsheet.slice(hotStart, hotEnd);
  assert.match(hot, /Invoke-OCRouter\.ps1 -Operation invoke-stage/);
  for (const name of retired) assert.doesNotMatch(hot, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("gitignore admits exact runtime sources while generated runtime remains ignored", () => {
  const ignore = readFileSync(path.resolve(scripts, "../../../.gitignore"), "utf8").replace(/\r\n/g, "\n");
  for (const line of [
    "!/tools/oc-session-router/scripts/Invoke-OCRouter.ps1",
    "!/tools/oc-session-router/runtime/package.json",
    "!/tools/oc-session-router/runtime/package-lock.json",
    "!/tools/oc-session-router/runtime/tsconfig.json",
    "!/tools/oc-session-router/runtime/src/**",
    "!/tools/oc-session-router/runtime/test/**",
    "!/tools/oc-session-router/runtime/fixtures/**",
  ]) assert.match(ignore, new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.match(ignore, /^\/tools\/oc-session-router\/runtime\/\*$/m);
  assert.doesNotMatch(ignore, /^!\/tools\/oc-session-router\/runtime\/(?:dist|node_modules)\//m);
});
