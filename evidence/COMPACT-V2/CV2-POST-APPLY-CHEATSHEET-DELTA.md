# COMPACT-V2 Post-Apply Cheatsheet Delta

## Owner Request

After restart, the Owner requested restoration of the copyable password environment
setup line in `session-router-cheatsheet.md`. The detailed reference already
contained the same placeholder-only command.

## Change

The quick server-start block now includes:

```powershell
$env:OPENCODE_SERVER_PASSWORD = "<PASSWORD_FROM_PRIVATE_RUNTIME>"
```

No real credential is stored. Adjacent text requires local replacement of the
placeholder and prohibits placing the real credential in documentation, events,
policies, or normal command output.

## Identity

- Applied transaction adapter binding, preserved as history:
  `54c3b3773ed2043dbc6c2932188f6d80c3b6807b171c41b28046d32251fae912`
- Current post-apply adapter/docs-test successor:
  `compact-v2-adapter-40a911d0abebdfb8`
- Current adapter manifest:
  `40a911d0abebdfb8d53be928a73c83bfc2363829e057ee1b5857f425c9589332`
- Cheatsheet SHA-256:
  `06f740d0c98a03cfddafc982e622001575aa84147ec5fdae584ecac57bd9d3ea`
- Global generation test SHA-256:
  `f44339ff2187d8cd94ffbb1bbb03b64200c254950c4a9012568f867d3fc828dd`

The historical transaction manifest and apply receipt are not rewritten to claim
that this later documentation change was part of the reviewed global apply.

Post-apply verification uses `Live` mode. `Candidate` mode intentionally requires
the seven existing global targets to equal their pre-apply baseline and therefore
is not a valid lifecycle check after successful application.

## Maintainer Closeout Check

- Placeholder syntax matches the existing reference command and is valid
  PowerShell environment assignment.
- The value is a non-secret placeholder; no credential, endpoint, port, session
  identity, or workstation root was introduced.
- `Live` mode passes after restart and still proves all eight global payloads equal
  the approved candidate.
- Removing the temporary current-adapter assertion restores the correct lifecycle
  boundary: the historical transaction continues to verify its candidate,
  baseline, operation count, and all before/after payload hashes without claiming
  later adapter-documentation bytes belonged to that transaction.
- `git diff --check` reports no whitespace error.

POST_APPLY_DOCS_DELTA_ACCEPTED
