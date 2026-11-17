# ADR-0025: Step-by-step delivery

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Work ships in small steps (about 300 changed lines or fewer), one conventional commit and one push per step, with a line in `PROGRESS.md`. The commit hash for a step is filled in by the next step's commit, because a commit can't contain its own hash and history is never rewritten.

## Alternatives considered

None recorded.

## Rationale

Not recorded.
