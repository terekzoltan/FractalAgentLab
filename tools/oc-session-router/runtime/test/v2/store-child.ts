import { OperationStore, type StoreCheckpoint } from "../../src/v2/state-store.js";
import { StoreError, type ActionInput, type TerminalOutcome } from "../../src/v2/contracts.js";

const [, , databasePath, serialized] = process.argv;
if (!databasePath || !serialized) throw new Error("Missing disposable store fixture");
const input = JSON.parse(serialized) as {
  mode: "prepare" | "dispatch" | "finish";
  action?: ActionInput;
  operationId?: string;
  outcome?: TerminalOutcome;
  crash?: StoreCheckpoint;
};
const store = new OperationStore(databasePath, {
  checkpoint: point => { if (point === input.crash) process.exit(93); },
});
process.stdout.write(`${JSON.stringify({ ready: true })}\n`);
process.stdin.once("data", () => {
  try {
    const result = input.mode === "prepare" ? store.prepareAction(input.action!)
      : input.mode === "dispatch" ? store.startDispatch(input.operationId!)
        : store.finish(input.operationId!, input.outcome!);
    process.stdout.write(`${JSON.stringify({ result })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: error instanceof StoreError ? error.code : "UNEXPECTED" })}\n`);
    process.exitCode = 1;
  } finally {
    store.close();
    process.stdin.destroy();
  }
});
