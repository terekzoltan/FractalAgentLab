# Public-Export-Review-Template-v01.md

## Purpose

Use this template during `visibility-release-review` whenever material may be exported from the private lab repo to the public portfolio repo.

---

## Candidate

- source path:
- artifact name:
- owner/session:
- requested public target path:

---

## Classification

- operational class:
  - `local-only`
  - `private-canonical`
  - `public-sanitizable`
  - `never-public`
- visibility result:
  - `public allowed`
  - `public-sanitizable`
  - `rejected/private-only`

---

## Sanitization check

- contains raw traces or raw eval evidence?
- contains tuned prompts or private heuristics?
- contains failure-corpus details?
- contains benchmark gold-set details?
- contains repo-specific sensitive planning patterns?
- contains secrets, provider detail, or other operationally sensitive material?

Required sanitization actions:
-

---

## Public-value check

- is this understandable without private context?
- is this technically honest?
- is this polished enough to represent the project publicly?
- does it add real value to the public repo?

---

## Decision

- recommendation:
- rationale:
- approved public path (if any):
- follow-up actions:

---

## Meta sign-off

- reviewed by:
- date:
- status:
