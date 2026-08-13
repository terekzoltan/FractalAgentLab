import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { assertSafeRelativePath, canonicalize, sha256 } from "./contracts.js";

export interface WorktreeProof {
  schema_version: "worktree-proof.v1";
  head_sha256: string;
  head_tree_sha256: string;
  head_parent_count: number;
  sole_parent_sha256: string;
  committed_paths: string[];
  index_sha256: string;
  status_sha256: string;
  staged_paths: string[];
  status_clean: boolean;
  has_unstaged_or_untracked: boolean;
}

export interface WorktreeReader {
  inspect(root: string): WorktreeProof;
}

interface PorcelainRecord {
  status: string;
  path: string;
  original_path?: string;
}

const MAXIMUM_GIT_OUTPUT = 4 * 1024 * 1024;
const GIT_TIMEOUT_MS = 10_000;

export class GitWorktreeReader implements WorktreeReader {
  private readonly executable: string;
  private readonly executableSha256: string;

  constructor(executable: string, expectedSha256: string) {
    if (!path.isAbsolute(executable) || lstatSync(executable).isSymbolicLink()) throw new Error("Git executable must be an ordinary absolute file");
    this.executable = realpathSync(executable);
    this.executableSha256 = expectedSha256;
    if (sha256(readFileSync(this.executable)) !== expectedSha256) throw new Error("Git executable hash mismatch");
  }

  inspect(root: string): WorktreeProof {
    if (!path.isAbsolute(root)) throw new Error("Git worktree root must be absolute");
    if (lstatSync(this.executable).isSymbolicLink()) throw new Error("Git executable must remain an ordinary file");
    if (sha256(readFileSync(this.executable)) !== this.executableSha256) throw new Error("Git executable hash drifted");
    const head = runGit(this.executable, root, ["rev-parse", "--verify", "HEAD"]);
    const headTree = runGit(this.executable, root, ["rev-parse", "--verify", "HEAD^{tree}"]);
    const parentRow = runGit(this.executable, root, ["rev-list", "--parents", "-n", "1", "HEAD"]).toString("utf8").trim().split(/\s+/);
    const parentCount = parentRow.length - 1;
    const soleParentSha256 = parentCount === 1 ? sha256(parentRow[1]!) : "INELIGIBLE";
    const committed = nulStrings(runGit(this.executable, root, parentCount === 0
      ? ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", "HEAD"]
      : ["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "HEAD^", "HEAD"]), "committed path").sort();
    if (new Set(committed).size !== committed.length) throw new Error("Git committed path output contains duplicates");
    const index = runGit(this.executable, root, ["ls-files", "--stage", "-z"]);
    const status = runGit(this.executable, root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    const statusRecords = parsePorcelainV1Z(status);
    const staged = nulStrings(runGit(this.executable, root, ["diff", "--cached", "--name-only", "-z"]), "staged path");
    if (new Set(staged).size !== staged.length) throw new Error("Git staged path output contains duplicates");
    return {
      schema_version: "worktree-proof.v1",
      head_sha256: sha256(head.toString("utf8").trim()),
      head_tree_sha256: sha256(headTree.toString("utf8").trim()),
      head_parent_count: parentCount,
      sole_parent_sha256: soleParentSha256,
      committed_paths: committed,
      index_sha256: sha256(index),
      status_sha256: sha256(status),
      staged_paths: staged,
      status_clean: statusRecords.length === 0,
      has_unstaged_or_untracked: statusRecords.some((record) => record.status === "??" || record.status[1] !== " "),
    };
  }
}

export function worktreeProofSha256(proof: WorktreeProof): string {
  return sha256(canonicalize(proof));
}

function runGit(executable: string, root: string, args: readonly string[]): Buffer {
  const env = gitEnvironment(process.env);
  const result = spawnSync(executable, [
    "--no-optional-locks",
    "--no-replace-objects",
    "-c", "core.quotepath=false",
    "-c", "core.fsmonitor=false",
    "-C", root,
    ...args,
  ], {
    shell: false,
    windowsHide: true,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: MAXIMUM_GIT_OUTPUT,
    encoding: "buffer",
    env,
  });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) throw new Error("Git worktree inspection failed");
  return result.stdout;
}

function gitEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of process.platform === "win32" ? ["SystemRoot", "WINDIR", "TEMP", "TMP"] : ["HOME", "TMPDIR"]) if (source[key] !== undefined) env[key] = source[key];
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  env.GIT_NO_REPLACE_OBJECTS = "1";
  env.GIT_OPTIONAL_LOCKS = "0";
  env.LC_ALL = "C";
  return env;
}

function nulStrings(bytes: Buffer, label: string): string[] {
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new Error(`Git ${label} output is not NUL terminated`);
  return bytes.subarray(0, -1).toString("utf8").split("\0").map((value) => {
    assertSafeRelativePath(value, label);
    return value;
  });
}

function parsePorcelainV1Z(bytes: Buffer): PorcelainRecord[] {
  const values = nulStrings(bytes, "status path");
  const records: PorcelainRecord[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (value.length < 4 || value[2] !== " ") throw new Error("Git porcelain-v1 status record is malformed");
    const status = value.slice(0, 2);
    const filePath = value.slice(3);
    assertSafeRelativePath(filePath, "status path");
    if (/[RC]/.test(status)) {
      const originalPath = values[index + 1];
      if (!originalPath) throw new Error("Git porcelain-v1 rename record is incomplete");
      assertSafeRelativePath(originalPath, "status rename path");
      records.push({ status, path: filePath, original_path: originalPath });
      index += 1;
    } else {
      records.push({ status, path: filePath });
    }
  }
  return records;
}

export const _test = { parsePorcelainV1Z, gitEnvironment };
