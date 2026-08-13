import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { GitWorktreeReader, _test } from "../src/worktree-reader.js";
import { sha256 } from "../src/contracts.js";

function gitExecutable(): { path: string; sha256: string } {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(command, ["git"], { encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error("Git test executable is unavailable");
  const executable = result.stdout.split(/\r?\n/).find(Boolean)!;
  return { path: executable, sha256: sha256(readFileSync(executable)) };
}

test("FSR-011: porcelain-v1 NUL parser handles ordinary and renamed paths", () => {
  assert.deepEqual(_test.parsePorcelainV1Z(Buffer.from("M  file one.txt\0R  new.txt\0old.txt\0", "utf8")), [
    { status: "M ", path: "file one.txt" },
    { status: "R ", path: "new.txt", original_path: "old.txt" },
  ]);
  assert.throws(() => _test.parsePorcelainV1Z(Buffer.from("R  new.txt\0", "utf8")), /rename/i);
  assert.throws(() => _test.parsePorcelainV1Z(Buffer.from("M  ../escape\0", "utf8")), /safe relative path/i);
});

test("FSR-011: production reader fails closed outside a Git worktree", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-worktree-reader-"));
  try {
    const executable = gitExecutable();
    assert.throws(() => new GitWorktreeReader(executable.path, executable.sha256).inspect(root), /Git worktree inspection failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-022: Git child environment excludes unrelated and credential values", () => {
  const env = _test.gitEnvironment({ ...process.env, OPENCODE_SERVER_PASSWORD: "secret", OC_ROUTER_SENTINEL: "private", PATH: "attacker" });
  assert.equal(env.OPENCODE_SERVER_PASSWORD, undefined);
  assert.equal(env.OC_ROUTER_SENTINEL, undefined);
  assert.equal(env.PATH, undefined);
  assert.equal(env.GIT_NO_REPLACE_OBJECTS, "1");
  assert.equal(env.GIT_OPTIONAL_LOCKS, "0");
});

test("FSR-025: protected real Git reader proves clean, dirty, staged, rename, and untracked states", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-worktree-real-git-"));
  const executable = gitExecutable();
  const git = (...args: string[]) => {
    const result = spawnSync(executable.path, ["-C", root, ...args], { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git("init");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "user.name", "Fixture");
    writeFileSync(path.join(root, "tracked.txt"), "one\n");
    git("add", "tracked.txt");
    git("commit", "-m", "initial");
    const reader = new GitWorktreeReader(executable.path, executable.sha256);
    const clean = reader.inspect(root);
    assert.equal(clean.status_clean, true);
    assert.deepEqual(clean.staged_paths, []);
    assert.equal(clean.head_parent_count, 0);
    assert.equal(clean.sole_parent_sha256, "INELIGIBLE");
    assert.deepEqual(clean.committed_paths, ["tracked.txt"]);

    writeFileSync(path.join(root, "tracked.txt"), "two\n");
    const dirty = reader.inspect(root);
    assert.equal(dirty.has_unstaged_or_untracked, true);
    git("add", "tracked.txt");
    const staged = reader.inspect(root);
    assert.deepEqual(staged.staged_paths, ["tracked.txt"]);
    assert.equal(staged.has_unstaged_or_untracked, false);
    git("commit", "-m", "second");
    const committed = reader.inspect(root);
    assert.equal(committed.head_parent_count, 1);
    assert.equal(committed.sole_parent_sha256, clean.head_sha256);
    assert.deepEqual(committed.committed_paths, ["tracked.txt"]);
    assert.match(committed.head_tree_sha256, /^[a-f0-9]{64}$/);

    git("mv", "tracked.txt", "renamed.txt");
    assert.deepEqual(reader.inspect(root).staged_paths, ["renamed.txt"]);
    git("reset", "--hard", "HEAD");
    writeFileSync(path.join(root, "untracked.txt"), "new\n");
    const untracked = reader.inspect(root);
    assert.equal(untracked.has_unstaged_or_untracked, true);
    assert.notEqual(untracked.status_sha256, clean.status_sha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-050: local replacement refs cannot forge protected Git proof", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-worktree-replace-ref-"));
  const executable = gitExecutable();
  const git = (...args: string[]) => {
    const result = spawnSync(executable.path, ["-C", root, ...args], { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git("init");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "user.name", "Fixture");
    writeFileSync(path.join(root, "tracked.txt"), "one\n");
    git("add", "tracked.txt");
    git("commit", "-m", "initial");
    const initial = git("rev-parse", "HEAD");
    writeFileSync(path.join(root, "tracked.txt"), "two\n");
    git("add", "tracked.txt");
    git("commit", "-m", "second");
    const reader = new GitWorktreeReader(executable.path, executable.sha256);
    const actual = reader.inspect(root);
    git("replace", "HEAD", initial);
    assert.notEqual(git("rev-parse", "HEAD^{tree}"), git("rev-parse", "--no-replace-objects", "HEAD^{tree}"));
    assert.deepEqual(reader.inspect(root), actual);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-050: local fsmonitor configuration cannot execute during protected Git proof", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-worktree-fsmonitor-"));
  const executable = gitExecutable();
  const git = (...args: string[]) => {
    const result = spawnSync(executable.path, ["-C", root, ...args], { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git("init");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "user.name", "Fixture");
    writeFileSync(path.join(root, "tracked.txt"), "one\n");
    git("add", "tracked.txt");
    git("commit", "-m", "initial");
    const sentinel = path.join(root, "fsmonitor-invoked");
    const hook = path.join(root, "fsmonitor-hook.sh");
    writeFileSync(hook, `#!/bin/sh\nprintf invoked > '${sentinel.replace(/'/g, "'\\''")}'\n`);
    if (process.platform !== "win32") chmodSync(hook, 0o700);
    git("config", "core.fsmonitor", hook.replace(/\\/g, "/"));
    new GitWorktreeReader(executable.path, executable.sha256).inspect(root);
    assert.equal(existsSync(sentinel), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
