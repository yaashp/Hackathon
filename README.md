# DevSight AI — Visual Audit Workspace

A complete, self-contained mirror of [DevSight AI](https://devsight-2wcsgqx7.manus.space).

## Overview

DevSight AI is an interactive prototype demonstrating an end-to-end visual audit workspace:
- **01 / Browser Evidence**: Simulated mobile (390 × 844) and desktop (1440 × 900) views showing responsive layout issues, plus synthetic browser console & DOM inspection signals.
- **02 / Audit Signals & Perspectives**: Multi-angle analysis (Security Reviewer, Code Quality & Performance, Socratic Mentor, Visual QA Reviewer).
- **03 / Review Queue & Findings**: Detailed diagnostic breakdown (such as mobile card overflow and missing accessible labels) with root cause hypotheses and Socratic hints.
- **04 / Patch Review & Verification Loop**: Interactive diff viewer, one-click simulated patch approval, and before/after verification preview.
- **Additional Views**: Run History, Project Settings, and Privacy & Limitations.

---

## File Structure

| File | Description |
|------|-------------|
| [`index.html`](./index.html) | Standalone, self-contained application entrypoint with clean local paths (opens directly in any browser). |
| [`index.original.html`](./index.original.html) | Exact byte-for-byte replica of the live website, including original hosting metadata. |
| [`styles.css`](./styles.css) | Complete stylesheet (~50KB) containing all UI components, layout grids, device frames, syntax diff colors, and theme tokens. |
| [`app.js`](./app.js) | Full client-side state machine (~20KB) powering the audit simulation, modal dialogs, tab switching, patch staging, and verification flows. |
| [`safety.js`](./safety.js) | URL and path safety validation routines (`isLoopbackUrl`, `isSafeDisplayPath`). |
| [`devsight-mark.svg`](./devsight-mark.svg) | Vector brand icon for DevSight AI. |
| [`favicon.ico`](./favicon.ico) | Application favicon. |
| [`robots.txt`](./robots.txt) | Robots exclusion rules. |
| [`sitemap.xml`](./sitemap.xml) | XML sitemap. |
| [`__manus/pwa/manifest.webmanifest`](./__manus/pwa/manifest.webmanifest) | Web app manifest for standalone display. |

---

## How to Run

### Option 1: Direct File Open
Simply double-click [`index.html`](./index.html) in your file manager to open it directly in any modern browser.

### Option 2: Local HTTP Server
Using Node.js:
```bash
npx serve .
# or
npx http-server .
```
Or with Python:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.
