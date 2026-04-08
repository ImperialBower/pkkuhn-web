/**
 * Tests for the collapsible Nash Strategy Table panel (EPIC-WEB-02).
 *
 * The panel renders all 12 info sets (4 groups × 3 cards) and live-updates
 * when the alpha slider moves.  Active-row highlighting tracks P0's current
 * info set during a hand.
 *
 * Reference values at slider max (alpha = 0.333, just under 1/3):
 *
 *   P0 opening:
 *     J  Check 66.7%  Bet 33.3%
 *     Q  Check 100.0% Bet  0.0%
 *     K  Check  0.1%  Bet 99.9%   (3 * 0.333 = 0.999)
 *
 *   P1 after P0 checks (hardcoded — not alpha-parameterised):
 *     J  Check 66.7%  Bet 33.3%
 *     Q  Check 100.0% Bet  0.0%
 *     K  Check  0.0%  Bet 100.0%
 *
 *   P1 after P0 bets (hardcoded):
 *     J  Fold 100.0% Call   0.0%
 *     Q  Fold  66.7% Call  33.3%
 *     K  Fold   0.0% Call 100.0%
 *
 *   P0 facing check→bet  (alpha = 0.333):
 *     J  Fold 100.0% Call   0.0%
 *     Q  Fold  33.4% Call  66.6%   (call = 0.333 + 1/3 ≈ 0.6663)
 *     K  Fold   0.0% Call 100.0%
 */

import { test, expect, type Locator } from '@playwright/test';
import { DEALS, mockRandom, waitForBoot, waitForTurn } from './helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the `.st-card-row` whose card label matches `card` inside the strategy
 * section whose header text contains `sectionText`.
 */
function stratRow(page: ReturnType<typeof expect>['page'] extends never ? never : Parameters<typeof expect>[0] extends Locator ? never : import('@playwright/test').Page, sectionText: string, card: string): Locator {
  const section = page.locator('.st-section').filter({
    has: page.locator('.st-section-header', { hasText: sectionText }),
  });
  return section.locator('.st-card-row').filter({
    has: page.locator('.st-card-label', { hasText: card }),
  });
}

/** Find a `.st-action` inside `row` whose label matches `action`. */
function actionInRow(row: Locator, action: string): Locator {
  return row.locator('.st-action').filter({
    has: row.page().locator('.st-act-label', { hasText: action }),
  });
}

// ── Panel visibility ──────────────────────────────────────────────────────────

test.describe('panel visibility', () => {
  test('panel is collapsed by default', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    // <details> is closed → strategy-body content not visible
    await expect(page.locator('#strategy-body')).not.toBeVisible();
  });

  test('clicking the summary expands the panel', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).toBeVisible();
  });

  test('clicking the summary again collapses the panel', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).not.toBeVisible();
  });

  test('alpha note in header shows 1/3 at default slider', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#strategy-alpha-note')).toContainText('1/3');
  });
});

// ── Content at default alpha ──────────────────────────────────────────────────

test.describe('table content at default alpha (0.333)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click(); // open panel
  });

  test('renders 4 section headers', async ({ page }) => {
    await expect(page.locator('.st-section-header')).toHaveCount(4);
  });

  test('renders 12 card rows total', async ({ page }) => {
    await expect(page.locator('.st-card-row')).toHaveCount(12);
  });

  test('P0-opening J: Bet = 33.3%', async ({ page }) => {
    const row = stratRow(page, 'P0 opening', 'J');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('33.3%');
  });

  test('P0-opening Q: Check = 100.0%', async ({ page }) => {
    const row = stratRow(page, 'P0 opening', 'Q');
    const act = actionInRow(row, 'Check');
    await expect(act.locator('.st-pct')).toHaveText('100.0%');
  });

  test('P0-opening K: Bet ≈ 100% (99.9% at slider 333)', async ({ page }) => {
    const row = stratRow(page, 'P0 opening', 'K');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('99.9%');
  });

  test('P1-after-check K: Bet = 100.0% (always bets)', async ({ page }) => {
    const row = stratRow(page, 'P0 checks', 'K');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('100.0%');
  });

  test('P1-after-check J: Bet = 33.3% (hardcoded bluff)', async ({ page }) => {
    const row = stratRow(page, 'P0 checks', 'J');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('33.3%');
  });

  test('P1-after-bet J: Fold = 100.0%', async ({ page }) => {
    const row = stratRow(page, 'P0 bets', 'J');
    const act = actionInRow(row, 'Fold');
    await expect(act.locator('.st-pct')).toHaveText('100.0%');
  });

  test('P1-after-bet K: Call = 100.0%', async ({ page }) => {
    const row = stratRow(page, 'P0 bets', 'K');
    const act = actionInRow(row, 'Call');
    await expect(act.locator('.st-pct')).toHaveText('100.0%');
  });

  test('P0-check-bet Q: Call = 66.6% (alpha + 1/3 ≈ 0.6663)', async ({ page }) => {
    const row = stratRow(page, 'facing', 'Q');
    const act = actionInRow(row, 'Call');
    await expect(act.locator('.st-pct')).toHaveText('66.6%');
  });
});

// ── Content at alpha = 0 ──────────────────────────────────────────────────────

test.describe('table content at alpha = 0', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#alpha-slider').fill('0');
    await page.locator('#alpha-slider').dispatchEvent('input');
    await page.locator('#strategy-wrap summary').click();
  });

  test('alpha note updates to 0', async ({ page }) => {
    await expect(page.locator('#strategy-alpha-note')).toContainText('0');
  });

  test('P0-opening J: Bet = 0.0%', async ({ page }) => {
    const row = stratRow(page, 'P0 opening', 'J');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('0.0%');
  });

  test('P0-opening K: Bet = 0.0% (3 * 0 = 0)', async ({ page }) => {
    const row = stratRow(page, 'P0 opening', 'K');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('0.0%');
  });

  test('P1-after-check J: Bet still = 33.3% (not alpha-parameterised)', async ({ page }) => {
    const row = stratRow(page, 'P0 checks', 'J');
    const act = actionInRow(row, 'Bet');
    // P1's bluff after a check is hardcoded at 1/3, unaffected by the slider.
    await expect(act.locator('.st-pct')).toHaveText('33.3%');
  });
});

// ── Live slider update ────────────────────────────────────────────────────────

test.describe('live slider update', () => {
  test('P0-opening J Bet probability tracks alpha slider', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    // At alpha = 0.200 → J bets 20.0%
    await page.locator('#alpha-slider').fill('200');
    await page.locator('#alpha-slider').dispatchEvent('input');

    const row = stratRow(page, 'P0 opening', 'J');
    const act = actionInRow(row, 'Bet');
    await expect(act.locator('.st-pct')).toHaveText('20.0%');
  });
});

// ── Active row highlighting ───────────────────────────────────────────────────

test.describe('active row highlighting', () => {
  test('P0=K opening row is highlighted after deal', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand]); // P0=K
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    await page.click('#btn-deal');

    // The row for P0 opening with K should be active.
    const row = stratRow(page, 'P0 opening', 'K');
    await expect(row).toHaveClass(/active/);
  });

  test('highlight clears after P0 acts (AI is thinking)', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P0=K, P1=J
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    await page.click('#btn-deal');
    await page.click('.btn-check'); // P0 acts → clearActiveRow

    // No row should be active while AI is thinking.
    await expect(page.locator('.st-card-row.active')).toHaveCount(0);
  });

  test('highlight clears after hand ends', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P0=K, P1=J — fold
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);

    await expect(page.locator('.st-card-row.active')).toHaveCount(0);
  });

  test('check-bet row highlighted for P0 second decision', async ({ page }) => {
    await mockRandom(page, [DEALS[3].rand, 0.5]); // P0=Q, P1=K always bets back
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    await page.click('#btn-deal');
    await page.click('.btn-check');
    await waitForTurn(page); // AI bets back → P0 faces Check-Bet

    // The Check→Bet row for Q should now be highlighted.
    const row = stratRow(page, 'facing', 'Q');
    await expect(row).toHaveClass(/active/);
  });
});
