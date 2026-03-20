# Coding-Vertical-Learning-Loop-v01.md

## Purpose

This document defines the private learning loop for the future coding vertical.

The central idea is simple:

> the real moat is not the headline idea, but the accumulated operating judgment

This learning loop is therefore private by default.

---

## What should be learned and tracked

The coding vertical should eventually track at least these categories:

### 1. Review effectiveness

Questions:
- which reviews found real bugs?
- which reviews missed important issues?
- which review styles produced too many false positives?

### 2. Gate correctness

Questions:
- which `hold` decisions were clearly correct?
- which `pass_with_warnings` calls were too lenient?
- which gates blocked for weak reasons?

### 3. Prompt-variant outcomes

Questions:
- which prompt variants improved clarity?
- which variants reduced false positives?
- which variants caused overconfidence or verbosity drift?

### 4. Planning-template effectiveness by repo zone

Questions:
- which plan formats worked best in runtime-heavy zones?
- which worked in docs/ops-heavy zones?
- where did shared-zone planning repeatedly fail?

### 5. Failure corpus

Track examples of:
- wrong plans
- bad reviews
- false-green gates
- missed regressions
- misleading traces or artifact contradictions

### 6. Trace-derived heuristics

Track lessons such as:
- repeated orchestration failure patterns
- misleading trace shapes
- routing lessons grounded in observed failures

### 7. Benchmark gold sets

Over time, collect:
- representative coding tasks
- strong plan examples
- strong review examples
- justified `hold` / `pass` decisions

### 8. Meta Coordinator playbook refinements

Questions:
- which sequencing decisions reduced churn?
- which blocked-state calls were correct?
- when did a design-only batch prevent premature implementation?
- which policy updates were actually worth making?

---

## Raw vs distilled storage

### Raw evidence

Recommended local path:
- `data/private_learning/coding/`

Suggested raw files later:
- `review_effectiveness.jsonl`
- `gate_correctness.jsonl`
- `prompt_variants.jsonl`
- `planning_templates.jsonl`
- `failure_corpus/`
- `trace_notes/`

These stay under `data/`, so they remain ignored locally by default.

### Distilled policy knowledge

Keep durable conclusions in versioned private docs such as:

- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- future benchmark or runbook docs

---

## Update cadence

Review the learning loop when:

- several meaningful coding reviews have accumulated
- a repeated failure pattern is visible
- a gate decision looks suspicious in hindsight
- a prompt/template change appears to materially help or hurt

Do not update the policy after every tiny anecdote.

---

## Privacy rule

These learning assets are private by default because they may contain:

- the strongest practical heuristics
- repo-specific planning patterns
- tuned prompt language
- real failure corpora
- early benchmark gold sets

Public release, if any, should be sanitized and partial.

---

## How this should affect the project

The learning loop should improve the coding vertical by feeding back into:

- planning policy
- review/gate policy
- benchmark design
- prompt evolution
- sequencing and readiness decisions

If it does not change decisions over time, it is not doing useful work.
