# ADR 0001: Extension vs Standalone Browser

## Status

Accepted

## Date

2026-02-26

## Context

The product goal is to make markdown-first browsing useful quickly for real users.

Two options were evaluated:

1. Build a standalone browser.
2. Build a browser extension on top of existing browsers.

## Decision

Build and iterate as a browser extension.

## Rationale

- Faster time-to-value by reusing mature browser engines and distribution channels.
- Lower implementation and maintenance surface for networking, rendering, and updates.
- Immediate compatibility with existing user workflows (Edge/Chromium and Firefox).
- Easier incremental iteration on negotiation, rendering, and UX.

## Consequences

- Rapid MVP delivery and multi-browser support.
- Lower adoption friction than a new browser install.
- Ongoing constraints from extension APIs and permission models.
- Cross-browser compatibility maintenance remains required.
