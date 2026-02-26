# Plan: Overview

## Goal

Ship and iterate a browser extension that makes markdown-first reading practical in daily browsing.

## Current scope

- Browser extension only (no standalone browser).
- Support Chromium/Edge and Firefox builds.
- Prefer native markdown responses when available.
- Provide readable fallback rendering when markdown is not available.

## What is already built

- Multi-target build outputs: `dist/chromium` and `dist/firefox`.
- Toolbar-driven mode controls with badge state.
- Reader rendering pipeline with markdown conversion fallback.
- TOC and raw markdown mode.

## Near-term priorities

- Security hardening from the gap analysis.
- Reduce permissions and tighten request scope where possible.
- Improve rendering reliability across more sites.

## Tracking

- Architecture and technical boundaries: `plans/02-architecture.md`
- Milestones and sequencing: `plans/03-milestones.md`
- UX direction and constraints: `plans/04-ux.md`
- Security hardening plan: `plans/05-security-gap-analysis.md`
