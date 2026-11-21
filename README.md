# โรงชิพ – แอปลงค่าประจำวัน (prototype)

Vite + React + TypeScript PWA, base `/chip-dept/` (service worker scope `/chip-dept/` only).

- `npm install` · `npm run dev` · `npm run build` · `npm run preview` (port 4174)
- Data: IndexedDB in the browser; optional Google Sheet sync via `apps-script/Code.gs` (guide: `apps-script/คู่มือตั้งค่า Google Sheet.md`).
- Sample data: `public/seed-2569-11.json` (1–16 Nov 2569, extracted from the Excel by `src-data/extract.py`).
- Analysis of the Excel: `ANALYSIS.md`.
- Tests (need `npm run preview` running):
  - `npx tsx tests/calc-verify.ts` – app formulas vs Excel values
  - `node tests/e2e.mjs chromium|webkit` – UI flows, phone/tablet/desktop, PWA scope, offline
  - `node tests/sync-e2e.mjs` – two devices syncing through Code.gs (mocked Sheet)
  - `node tests/apps-script-mock.mjs` – Code.gs unit check
