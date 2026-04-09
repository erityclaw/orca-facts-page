#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {
    projectUrl: '',
    profileDir: path.resolve('.state/playwright-stitch'),
    timeoutMs: 240000,
    outFile: '',
    screenTitles: [],
    headless: false,
    manualSelect: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const n = argv[i + 1];

    if (a === '--project-url' && n) {
      args.projectUrl = n;
      i += 1;
    } else if (a === '--profile-dir' && n) {
      args.profileDir = path.resolve(n);
      i += 1;
    } else if (a === '--timeout-ms' && n) {
      args.timeoutMs = Number(n);
      i += 1;
    } else if (a === '--out-file' && n) {
      args.outFile = path.resolve(n);
      i += 1;
    } else if (a === '--screen-title' && n) {
      args.screenTitles.push(n);
      i += 1;
    } else if (a === '--screen-titles' && n) {
      args.screenTitles.push(...n.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (a === '--headless') {
      args.headless = true;
    } else if (a === '--no-manual-select') {
      args.manualSelect = false;
    }
  }

  return args;
}

function usage() {
  return `
Usage:
  node scripts/stitch_export_to_figma.mjs \
    --project-url "https://stitch.withgoogle.com/..." \
    [--screen-title "Exploration Dashboard"] \
    [--screen-titles "A,B,C"] \
    [--out-file ./tmp/figma-link.txt] \
    [--profile-dir ./.state/playwright-stitch] \
    [--timeout-ms 240000] \
    [--headless] \
    [--no-manual-select]

Notes:
  - First run: keep headful mode (default) so you can sign into Stitch/Figma.
  - By default, script pauses for manual screen selection before export.
`;
}

async function clickIfVisible(locator) {
  if (await locator.count()) {
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      return true;
    }
  }
  return false;
}

async function autoSelectScreens(page, titles) {
  for (const title of titles) {
    const row = page.locator(`text=${title}`).first();
    if (!(await row.count())) {
      console.warn(`⚠️ Could not find screen title: ${title}`);
      continue;
    }

    try {
      await row.scrollIntoViewIfNeeded();
      await row.click({ timeout: 5000 });
      console.log(`✓ Attempted select: ${title}`);
    } catch {
      console.warn(`⚠️ Could not click screen title: ${title}`);
    }
  }
}

async function clickExportButton(page) {
  const candidates = [
    page.getByRole('button', { name: /export to figma/i }),
    page.getByRole('menuitem', { name: /export to figma/i }),
    page.locator('button:has-text("Export to Figma")'),
    page.locator('[aria-label*="Export to Figma" i]'),
    page.locator('text=/Export to Figma/i').locator('..').locator('button').first(),
  ];

  for (const locator of candidates) {
    try {
      if (await clickIfVisible(locator)) {
        return true;
      }
    } catch {
      // try next selector
    }
  }

  return false;
}

async function findFigmaLink(page, timeoutMs) {
  const started = Date.now();
  const figmaRegex = /https:\/\/www\.figma\.com\/[^"]+/i;

  while (Date.now() - started < timeoutMs) {
    const anchor = page.locator('a[href*="figma.com"]').first();
    if (await anchor.count()) {
      const href = await anchor.getAttribute('href');
      if (href && /figma\.com/i.test(href)) return href;
    }

    const copyButton = page.getByRole('button', { name: /copy link|copy figma link/i }).first();
    if (await copyButton.count()) {
      try {
        await copyButton.click({ timeout: 1000 });
        const clip = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch {
            return '';
          }
        });
        if (clip && /figma\.com/i.test(clip)) return clip;
      } catch {
        // continue
      }
    }

    const html = await page.content();
    const match = html.match(figmaRegex);
    if (match?.[0]) return match[0];

    await page.waitForTimeout(1200);
  }

  return '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.projectUrl) {
    console.error('❌ --project-url is required.');
    console.error(usage());
    process.exit(1);
  }

  await fs.mkdir(args.profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(args.profileDir, {
    headless: args.headless,
    viewport: { width: 1400, height: 900 },
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    console.log(`→ Opening project: ${args.projectUrl}`);
    await page.goto(args.projectUrl, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });

    const exportVisible = await page.getByRole('button', { name: /export to figma/i }).first().isVisible().catch(() => false);
    if (!exportVisible) {
      console.log('ℹ️ If prompted, sign in to Stitch/Figma in this browser window.');
    }

    if (args.screenTitles.length > 0) {
      console.log(`→ Attempting automatic screen selection (${args.screenTitles.length})...`);
      await autoSelectScreens(page, args.screenTitles);
    }

    if (args.manualSelect) {
      const rl = readline.createInterface({ input, output });
      await rl.question('Select screens in the UI, then press Enter here to continue export...');
      rl.close();
    }

    console.log('→ Clicking Export to Figma...');
    const clicked = await clickExportButton(page);
    if (!clicked) {
      throw new Error('Could not find/click "Export to Figma" button.');
    }

    console.log('→ Waiting for Figma link...');
    const figmaLink = await findFigmaLink(page, args.timeoutMs);
    if (!figmaLink) {
      throw new Error('Export action triggered, but no Figma link was detected.');
    }

    console.log(`\n✅ Figma link:\n${figmaLink}\n`);

    if (args.outFile) {
      await fs.mkdir(path.dirname(args.outFile), { recursive: true });
      await fs.writeFile(args.outFile, `${figmaLink}\n`, 'utf8');
      console.log(`Saved: ${args.outFile}`);
    }
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
