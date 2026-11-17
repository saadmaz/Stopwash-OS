# Translation review (Sinhala / Tamil)

<!-- nav -->
<sub><a href="../README.md">Project README</a> · <a href="README.md">Documentation index</a></sub>

Source language: English (`apps/web/src/i18n/locales/en.json`).

- Keys under `legacy.*` are copied unchanged from SWOMS 2.5, so staff already know them.
- Every other Sinhala and Tamil string is a first draft and needs a native-speaker check before go-live.
- A test (`i18n.test.ts`) fails if a key or `{{placeholder}}` is missing in any language.

How to review: open `si.json` / `ta.json` next to `en.json`, fix wording in place, and keep the keys and `{{placeholders}}` unchanged.

| File | Status |
|---|---|
| `si.json` | Needs review (except `legacy.*`) |
| `ta.json` | Needs review (except `legacy.*`) |
