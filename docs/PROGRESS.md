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
| 1.1 | Workspace root config (pnpm, TS 6 strict, prettier) + `packages/shared`: money (integer cents), Asia/Colombo dates, plate/phone normalisation, RBAC map; 58 tests | 03d5434 |
| 1.2 | API skeleton: zod env (demo- project guard), AppError codes, validation helper, health route, helmet/CORS/rate limit, pino redaction; 9 tests | 822d170 |
| 1.3 | Web skeleton: React 18 + Vite 8, Vitest (jsdom, Testing Library), Playwright config + smoke spec, brand favicon | ea189d5 |
| 1.4 | firebase/ (config, deny-all baseline rules, empty indexes, rules test harness) + emulator Dockerfile/compose committed as-is; rules tests excluded from `pnpm test`, run with `pnpm test:rules` | a6a220e |
| 1.5 | Root ESLint 9 flat config (typescript-eslint, react-hooks, jsx-a11y), zero warnings; Prettier applied to code (docs and firebase/ excluded) | 6f2b56b |
| 1.6 | GitHub Actions CI: install (frozen lockfile), typecheck, lint, format check, unit tests, build; no emulator | c1a91cb |
| 2.1 | Tailwind v4 + `packages/ui` token layer: brand palette, semantic light/dark colours, type scale, radius, elevation, motion, 44px touch spacing; tokens.ts for charts/PDF; cn() | 05b1a62 |
| 2.2 | Self-hosted variable fonts (Inter, Space Grotesk, Noto Sans Sinhala, Noto Sans Tamil, JetBrains Mono) via fontsource; font stacks fall back to Sinhala/Tamil | 862790d |
| 2.3 | Button (variants, 44px+ sizes, loading, asChild), Badge (tones, dot), Input (sizes, leading/trailing), Label, Textarea, Field (a11y wiring); 6 tests | 28e1184 |
| 2.4 | Select (options-driven, Field-compatible), Checkbox, Switch, RadioGroup (labelled), SegmentedControl (never empty); 4 tests | 6f8c6b3 |
| 2.5 | Dialog (sizes, labelled, close), Sheet (right/left/bottom, sticky footer), Toaster/toast (sonner, themed), Tooltip; 3 tests | 6bf6eb9 |
| 2.6 | Table primitives, Pagination (old pager shape via tested pageItems), EmptyState (empty/error/offline/denied), Skeleton, StatCard (delta, progress); 5 tests | 86e37ee |
| 2.7 | POS parts: VehicleClassTile (radio tile, price, shortcut), AddOnStepper (bounded qty, line total), DenominationCounter (notes + coins value, live total in cents), PinPad (taps + keyboard, completes at length); 6 tests | ca9ee61 |
| 2.8 | App shell: React Router 7, role-aware sidebar + mobile sheet nav, RequirePermission (permission-denied state), theme provider (light/dark/system), offline badge, skip link, temporary dev session; 3 tests | (next) |
| 1.6a | CI and runtime on Node 22 LTS (Node 20 is EOL; jsdom/undici 8 failed on it) | 6c34e8a |

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
