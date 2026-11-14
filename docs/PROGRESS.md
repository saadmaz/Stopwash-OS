# Progress

> A fresh session starts here. Read this file, then `DECISIONS.md`, then the phase you're on.

## Current state
- **Phase:** 0 (Discovery & spec): done
- **Next:** Phase 1 (Foundation)
- **Branch:** `main`. Push after every phase.

## Environment notes (this machine)
- Git over HTTPS needs `http.sslBackend=schannel` (set in this repo's local config, not globally).
- pnpm 9.15.4 via corepack.
- No JDK installed. The Firebase emulators run in Docker (`docker compose up emulators`), see D-020. Docker Desktop must be running.
- Reference repos are cloned read-only in `../_ref/` (Stopwash-POS-HTML, Stopwash-Website).

## Phase log

### Phase 0: Discovery & spec (done)
Built:
- Read `SWOMS2.5.html` end to end (all ~190 functions), README, SYSTEM_SUMMARY, attendance notes, and the website's tokens, fonts, logo, content and assets.
- `PRD.md`, `PARITY.md` (≈150 rows), `ARCHITECTURE.md` (Mermaid), `DATA_MODEL.md`, `DECISIONS.md` (D-001…D-024).

Findings worth knowing (bugs in the old app, fixed by design here):
- Mitts and Power/Water faults never triggered the WhatsApp alert (status string mismatch).
- Cash-out manager approval was collected but saved as "N/A".
- The Accounts "expenses" KPI read a field that doesn't exist, so it was always 0.
- Payroll daily counts used the UTC date, so orders after 18:30 SL time landed on the next day.
- The YEARLY sales tab had no date window.
- Receipt numbers were computed client-side and could collide.
- The variance > LKR 2,000 supervisor override is missing from the old README but exists in the code.

## Needs Saad
- **Rotate the old secrets.** The old Firebase project config (`stopwash-dashboard-001`), passcodes 5252/6225/0706 and WhatsApp number 94767885404 are public in `Stopwash-POS-HTML`. Tighten that project's Firestore rules, or shut it down once the migration is done.
- A real Firebase project for production (not used during the build; emulators only).
- Native-speaker review of the Sinhala and Tamil strings (`docs/i18n-review.md`, created in Phase 2).
- Real logo files and photography (the website itself still uses a text wordmark and placeholder images).

## Known issues
- None yet.
