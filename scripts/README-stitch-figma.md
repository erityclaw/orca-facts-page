# Stitch → Figma automation (Playwright)

## 1) Install deps

```bash
npm i -D playwright
npx playwright install chromium
```

## 2) Run

```bash
node scripts/stitch_export_to_figma.mjs \
  --project-url "https://stitch.withgoogle.com/..." \
  --screen-titles "Exploration Dashboard,Site Profile: Yandi B-12" \
  --out-file ./tmp/figma-link.txt
```

By default, the script pauses so you can manually select screens in Stitch before export.

## Useful flags

- `--no-manual-select` skip the pause (use only if auto-selection works for your layout)
- `--screen-title "..."` repeatable alternative to `--screen-titles`
- `--profile-dir ./.state/playwright-stitch` persistent login profile
- `--headless` run without visible browser (not recommended for first run)
