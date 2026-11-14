# Progress

> A fresh session starts here. Read this file, then `DECISIONS.md`, then `PARITY.md`.

## Current state
- **Working mode:** small steps (about 300 lines or fewer), one commit + push per step. Plan in the step log below.
- **Next step:** see the last line of the step log.
- **Data backend:** in-memory repositories (`DATA_BACKEND=memory`). The Firestore adapters are stubs, and Saad wires up Firebase himself.
- **Figma:** not connected (checked 2026-11-15: no Figma MCP tools in the session). Check again at Phase F.

## Environment notes (this machine)
- Git over HTTPS needs `http.sslBackend=schannel` (set in this repo's local config).
- pnpm 9.15.4 via corepack. TypeScript 6.0 (typescript-eslint does not support 7 yet).
- Reference repos are cloned read-only in `../_ref/`.
- Do NOT start the emulators or run the firebase CLI (Saad handles Firebase).

## Step log
Each line: step · what changed · commit. A commit can't contain its own hash, so the hash is filled in by the next step's commit (D-025).

| Step | What changed | Commit |
|---|---|---|
| 0 | Discovery docs: PRD, PARITY, ARCHITECTURE, DATA_MODEL, DECISIONS | df000d1 |
| 1.1 | Workspace root config (pnpm, TS 6 strict, prettier) + `packages/shared`: money (integer cents), Asia/Colombo dates, plate/phone normalisation, RBAC map; 58 tests | (next) |

## Findings from Phase 0 (old-app bugs fixed by design)
- Mitts and Power/Water faults never triggered the WhatsApp alert (status string mismatch).
- Cash-out manager approval was collected but saved as "N/A".
- The Accounts "expenses" KPI read a field that doesn't exist, so it was always 0.
- Payroll daily counts used the UTC date, so orders after 18:30 SL time landed on the next day.
- The YEARLY sales tab had no date window.
- Receipt numbers were computed client-side and could collide.
- The variance > LKR 2,000 supervisor override exists in the code but not in the old README.

## Needs Saad
- **Firebase (all of it).** Firestore adapters for every repository (`apps/api/src/repos/firestore/*`, currently stubs that throw), Firebase Auth custom-token issuer (stub), `firestore.rules` / `storage.rules` beyond the deny-all baseline, `firestore.indexes.json` (indexes listed in `DATA_MODEL.md`), rules unit tests (`pnpm test:rules`, needs the emulator), the real project config and deploy.
- **Figma:** the Figma MCP is not connected in this session. Expected account: w2053223@westminster.ac.uk (student team).
- **Rotate the old secrets.** The old Firebase config (`stopwash-dashboard-001`), passcodes 5252/6225/0706 and WhatsApp number 94767885404 are public in `Stopwash-POS-HTML`.
- Native-speaker review of the Sinhala/Tamil strings.
- Real logo files and photography (the website itself still uses a text wordmark and placeholder images).

## Known issues
- None yet.
