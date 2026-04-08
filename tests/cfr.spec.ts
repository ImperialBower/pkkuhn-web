/**
 * CFR Convergence panel tests.
 *
 * Acceptance criteria (EPIC-WEB-03):
 *  - run_cfr(1 000) → exploitability < 0.05
 *  - run_cfr(100 000) → exploitability < 0.002
 *  - Strategy comparison table shows all 12 info sets with Learned + Nash columns
 *  - UI does not freeze at 100 000 iterations
 *  - Panel is collapsed by default
 *
 * GTO reference at α=1/3 (used as Nash column baseline):
 *   P0 opening:  J bet 33.3%, K bet 99.9%, Q bet 0.0%
 *   P1 after check: K bet 100%, Q check 100%, J check~66.7%
 *   P1 after bet:   J fold 100%, Q fold~66.7%, K call 100%
 *   P0 facing chk-bet: K call 100%, Q call~66.7%
 */

import { test, expect, type Locator } from '@playwright/test';
import { waitForBoot } from './helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a .cfr-card-row inside a section whose header text contains `sectionText`,
 *  filtered to the row whose .cfr-card-label text matches `card`. */
function cfrRow(page: Parameters<typeof waitForBoot>[0], sectionText: string, card: string): Locator {
  const section = page.locator('.cfr-section').filter({
    has: page.locator('.cfr-section-header', { hasText: sectionText }),
  });
  return section.locator('.cfr-card-row').filter({
    has: page.locator('.cfr-card-label', { hasText: card }),
  });
}

/** Get the percentage text from the Learned or Nash column for the given action. */
function cfrActionPct(
  row: Locator,
  col: 'learned' | 'nash',
  action: string,
): Locator {
  const colIdx = col === 'learned' ? 1 : 2; // 0=card label, 1=learned, 2=nash
  // .cfr-card-row is a grid; the nth child (1-indexed) is the column we want
  const colEl = row.locator(`.cfr-actions-col`).nth(col === 'learned' ? 0 : 1);
  return colEl
    .locator('.cfr-action')
    .filter({ has: row.page().locator('.cfr-act-label', { hasText: action }) })
    .locator('.cfr-pct');
}

// ── Panel visibility ──────────────────────────────────────────────────────────

test.describe('CFR panel visibility', () => {
  test('panel is collapsed by default', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#cfr-wrap')).not.toHaveAttribute('open');
    await expect(page.locator('#cfr-body .cfr-section')).toHaveCount(0);
  });

  test('Run and Step buttons are enabled after boot', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#cfr-run')).not.toBeDisabled();
    await expect(page.locator('#cfr-step')).not.toBeDisabled();
  });

  test('idle message shown before first Run', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await expect(page.locator('.cfr-idle')).toBeVisible();
  });

  test('panel opens and closes on click', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await expect(page.locator('#cfr-wrap')).toHaveAttribute('open', '');
    await page.locator('#cfr-wrap summary').click();
    await expect(page.locator('#cfr-wrap')).not.toHaveAttribute('open');
  });
});

// ── Run button ────────────────────────────────────────────────────────────────

test.describe('Run button', () => {
  test('renders comparison table after click', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    await expect(page.locator('.cfr-section')).toHaveCount(4);
    await expect(page.locator('.cfr-card-row')).toHaveCount(12);
  });

  test('shows exploitability value', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    await expect(page.locator('.cfr-exploit-val')).toBeVisible();
    const text = await page.locator('.cfr-exploit-val').textContent();
    // Should be a 4-decimal number
    expect(text).toMatch(/^\d+\.\d{4}$/);
  });

  test('shows iteration badge', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    await expect(page.locator('.cfr-iter-badge')).toContainText('1,000 iterations');
  });

  test('shows both Learned and Nash column headers', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    await expect(page.locator('.cfr-col-hdr', { hasText: 'Learned' })).toHaveCount(4);
    await expect(page.locator('.cfr-col-hdr', { hasText: 'Nash' })).toHaveCount(4);
  });
});

// ── Exploitability thresholds ─────────────────────────────────────────────────

test.describe('exploitability thresholds', () => {
  test('1 000 iterations: exploitability < 0.05 (yellow or green)', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-preset').selectOption('1000');
    await page.locator('#cfr-run').click();

    const val = await page.locator('.cfr-exploit-val').textContent();
    const num = parseFloat(val ?? '1');
    expect(num).toBeLessThan(0.05);

    const cls = await page.locator('.cfr-exploit-val').getAttribute('class');
    expect(cls).toMatch(/yellow|green/);
  });

  test('100 000 iterations: exploitability < 0.002 (green)', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-preset').selectOption('100000');
    await page.locator('#cfr-run').click();

    const val = await page.locator('.cfr-exploit-val').textContent();
    const num = parseFloat(val ?? '1');
    expect(num).toBeLessThan(0.002);

    const cls = await page.locator('.cfr-exploit-val').getAttribute('class');
    expect(cls).toContain('green');
  });

  test('100 iterations: exploitability is not yet converged (not green)', async ({ page }) => {
    // Kuhn CFR is small enough that 100 iterations often lands in yellow (< 0.05).
    // We simply verify it has not reached the fully-converged green threshold (< 0.005).
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-preset').selectOption('100');
    await page.locator('#cfr-run').click();

    const val = await page.locator('.cfr-exploit-val').textContent();
    const num = parseFloat(val ?? '0');
    expect(num).toBeGreaterThan(0.005);

    const cls = await page.locator('.cfr-exploit-val').getAttribute('class');
    expect(cls).toMatch(/red|yellow/);
  });
});

// ── Nash column values ────────────────────────────────────────────────────────

test.describe('Nash column values (should always match α=1/3)', () => {
  test('P0(K) opening — Nash Bet = 100.0% (uses exact 1/3, not slider 0.333)', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    const pct = cfrActionPct(cfrRow(page, 'opening', 'K'), 'nash', 'Bet');
    await expect(pct).toHaveText('100.0%');
  });

  test('P0(Q) opening — Nash Bet = 0.0%', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    const pct = cfrActionPct(cfrRow(page, 'opening', 'Q'), 'nash', 'Bet');
    await expect(pct).toHaveText('0.0%');
  });

  test('P1(K) after P0 checks — Nash Bet = 100.0%', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    const pct = cfrActionPct(cfrRow(page, 'checks', 'K'), 'nash', 'Bet');
    await expect(pct).toHaveText('100.0%');
  });

  test('P1(J) after P0 bets — Nash Fold = 100.0%', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#cfr-wrap summary').click();
    await page.locator('#cfr-run').click();
    const pct = cfrActionPct(cfrRow(page, 'bets', 'J'), 'nash', 'Fold');
    await expect(pct).toHaveText('100.0%');
  });
});

// ── Step button ───────────────────────────────────────────────────────────────

test.describe('Step button animation', () => {
  test('step-through ends with 100 000-iteration result', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    // Step auto-opens the panel and animates through 100/1k/10k/100k
    await page.locator('#cfr-step').click();
    // Wait for the step-through to complete (4 × 900ms + some margin)
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('cfr-step') as HTMLButtonElement;
        return btn && !btn.disabled && btn.textContent === 'Step';
      },
      { timeout: 15_000 },
    );

    // Final result should be 100 000 iterations
    await expect(page.locator('.cfr-iter-badge')).toContainText('100,000 iterations');

    // Exploitability should be green at 100k iterations
    const cls = await page.locator('.cfr-exploit-val').getAttribute('class');
    expect(cls).toContain('green');
  });

  test('step-through auto-opens the panel', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    // Panel starts closed
    await expect(page.locator('#cfr-wrap')).not.toHaveAttribute('open');
    await page.locator('#cfr-step').click();
    // After clicking Step the panel should open immediately
    await expect(page.locator('#cfr-wrap')).toHaveAttribute('open', '');
    // Wait for completion so we don't leave background work running
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('cfr-step') as HTMLButtonElement;
        return btn && btn.textContent === 'Step';
      },
      { timeout: 15_000 },
    );
  });
});

// ── No horizontal overflow (mobile sanity) ────────────────────────────────────

test('no horizontal overflow with CFR panel open at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await waitForBoot(page);
  await page.locator('#cfr-wrap summary').click();
  await page.locator('#cfr-run').click();
  await expect(page.locator('.cfr-card-row')).toHaveCount(12);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
