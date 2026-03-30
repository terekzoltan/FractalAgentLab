# Docs Layout

This directory is organized by document role.

## Core root docs

Keep only higher-level cross-wave documents at the root, for example:

- repo structure and visibility policy
- cross-wave design docs
- long-lived track strategy notes

## Wave docs

- `docs/wave0/` = Wave 0 delivery, reports, and acceptance docs
- `docs/wave1/` = Wave 1 implementation, stabilization, evidence, and closeout docs

## Private/public split

- `docs/private/` = private canonical planning, coordination-adjacent doctrine, and gatekept strategy
- `docs/public/` = public-safe staging surface only

## Legacy docs

- `docs/legacy/` = superseded or archival planning material kept only for historical reference

## Practical rule

When adding a new markdown file:

- put wave-scoped delivery/evidence docs into the matching `wave*/` folder
- keep private doctrine in `docs/private/`
- keep public-safe staging material in `docs/public/`
- leave only cross-wave/root-level references in `docs/`
