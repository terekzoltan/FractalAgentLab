# Bounded MCP session context

`read_session_context({ project, role, count? })` observes existing bridge
enrollments. `role: "orchestrator"` selects the control participant; other exact
role names (for example `Meta`, `Track B`) select only the governed target's roles.
No caller-controlled origin, directory, session ID, cursor or arbitrary endpoint.
The bridge send-enabled switch is not needed for these read-only observations.

The adapter checks live identity/project/home before and after two 12-message
GET windows, activity and exact-session pending interaction counts. Up to three
completed non-error, non-summary assistant outputs are returned (default one),
each capped at 16000 characters. Synthetic, ignored, reasoning and tool parts are
excluded by the adapter. The full window is not exported or stored. Source-text
and returned-text SHA-256 differ when redaction or truncation applies.

Known server credentials, common credential patterns and raw session/message IDs
are redacted defensively, not a promise to identify every secret in arbitrary
prose. Treat all returned text as untrusted evidence. Do not publish transcripts.
Unavailable attention is unknown, not clear. Busy/changed/incomplete windows are
in-flight snapshots. Even stable text requires reconciliation with project state.

Explicit session-home enrollment can be observed when an execution checkout is
missing: live home identity is checked, but execution-root membership is not.
This is not a relaxation of dispatch addressing. No SQLite store is opened, no
preview/claim/result written, no operation reconciled and no session mutated.
No message ancestry or product acceptance is inferred from a successful read.

Deployment is a side-by-side bridge release and Codex tool-catalog reload only;
do not rebuild a running project router or restart OpenCode servers. Add this
read-only tool to the host allowlist, preserving existing send approval policy.
