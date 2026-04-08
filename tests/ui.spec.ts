/**
 * UI component tests: P0 hint panel, AI strategy panel, alpha slider,
 * history chips, and pot counter.
 *
 * GTO reference values at alpha = 1/3 (from KuhnStrategy::build):
 *
 *   P0 empty history:
 *     J → Check 66.7%, Bet 33.3%
 *     Q → Check 100.0%, Bet 0.0%
 *     K → Check 0.0%,   Bet 100.0%
 *
 *   P1 after Check:
 *     J → Check 66.7%, Bet 33.3%   (hardcoded; not parameterised by alpha)
 *     Q → Check 100.0%, Bet 0.0%
 *     K → Check 0.0%,   Bet 100.0%
 *
 *   P1 after Bet:
 *     J → Fold 100.0%, Call 0.0%
 *     Q → Fold 66.7%,  Call 33.3%
 *     K → Fold 0.0%,   Call 100.0%
 */

import { test, expect, type Locator } from '@playwright/test';
import { DEALS, mockRandom, waitForBoot, waitForTurn } from './helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a prob-row inside `container` whose label matches `action`. */
function probRow(container: Locator, action: string): Locator {
  return container.locator('.prob-row').filter({
    has: container.page().locator(`.prob-label:text("${action}")`),
  });
}

// ── P0 hint panel ─────────────────────────────────────────────────────────────

test.describe('P0 hint panel', () => {
  test('is hidden before P0 acts', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await expect(page.locator('#p0-panel')).not.toBeVisible();
  });

  test('appears as soon as P0 acts', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await expect(page.locator('#p0-panel')).toBeVisible();
  });

  test('hides when a new hand is dealt', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5, DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#p0-panel')).toBeVisible();

    await page.click('#btn-deal');
    await expect(page.locator('#p0-panel')).not.toBeVisible();
  });

  test('P0=K at alpha=1/3 — Bet shows ~100% (99.9% at slider max of 0.333)', async ({ page }) => {
    // Slider max = 333/1000 = 0.333 (just under exact 1/3).
    // K bets with 3 * 0.333 = 0.999, displayed as 99.9%.
    await mockRandom(page, [DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check'); // valid (suboptimal) choice to stay in the hand
    await expect(page.locator('#p0-panel')).toBeVisible();

    const row = probRow(page.locator('#p0-prob-rows'), 'Bet');
    await expect(row.locator('.prob-pct')).toHaveText('99.9%');
  });

  test('P0=Q at alpha=1/3 — Check shows 100.0%', async ({ page }) => {
    // Q never bets: bet_prob = 0
    await mockRandom(page, [DEALS[3].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check');
    await expect(page.locator('#p0-panel')).toBeVisible();

    const row = probRow(page.locator('#p0-prob-rows'), 'Check');
    await expect(row.locator('.prob-pct')).toHaveText('100.0%');
  });

  test('P0=J at alpha=1/3 — Bet shows 33.3%', async ({ page }) => {
    // J bets with probability alpha = 1/3 ≈ 33.3%
    await mockRandom(page, [DEALS[0].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check');
    await expect(page.locator('#p0-panel')).toBeVisible();

    const row = probRow(page.locator('#p0-prob-rows'), 'Bet');
    await expect(row.locator('.prob-pct')).toHaveText('33.3%');
  });

  test('updates live when alpha slider moves to 0', async ({ page }) => {
    // At alpha=0: K bets with 3*0 = 0%
    await mockRandom(page, [DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check'); // P0 acts → hint panel shown
    await expect(page.locator('#p0-panel')).toBeVisible();

    await page.locator('#alpha-slider').fill('0');
    await page.locator('#alpha-slider').dispatchEvent('input');

    const row = probRow(page.locator('#p0-prob-rows'), 'Bet');
    await expect(row.locator('.prob-pct')).toHaveText('0.0%');
  });

  test('shows Fold/Call probabilities at Check-Bet decision point', async ({ page }) => {
    // P0=Q, P1=K: P0 checks → P1 always bets → P0 faces Check-Bet
    // At alpha=1/3: P0(Q) calls with alpha + 1/3 = 2/3 ≈ 66.7%
    await mockRandom(page, [DEALS[3].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    // First P0 action (Check) — hint panel shows P0's opening strategy
    await page.click('.btn-check');
    await waitForTurn(page); // wait for P1=K to bet back

    // Second P0 action — hint panel updates to the Check-Bet info set
    await page.click('.btn-call'); // or fold; we trigger the hint before acting
    // Actually we need the hint to appear for the *second* P0 decision.
    // The panel updates when P0 acts, so after the Call click we can read it.
    // But the hand ends immediately after Call, so read it right away.
    await expect(page.locator('#p0-panel')).toBeVisible();
    // alpha = 0.333, call_prob = 0.333 + 1/3 ≈ 0.6663 → displayed as 66.6%
    const callRow = probRow(page.locator('#p0-prob-rows'), 'Call');
    await expect(callRow.locator('.prob-pct')).toHaveText('66.6%');
  });
});

// ── AI strategy panel ─────────────────────────────────────────────────────────

test.describe('AI strategy panel', () => {
  test('is hidden before AI acts', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await expect(page.locator('#ai-panel')).not.toBeVisible();
  });

  test('appears after AI acts', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P1=J will fold
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check'); // P0 checks → triggers AI turn
    await waitForTurn(page);
    await expect(page.locator('#ai-panel')).toBeVisible();
  });

  test('hides when a new hand is dealt', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5, DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);

    await page.click('#btn-deal');
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#ai-panel')).toBeVisible();

    await page.click('#btn-deal');
    await expect(page.locator('#ai-panel')).not.toBeVisible();
  });

  test('P1=J after Bet — Fold shows 100.0%', async ({ page }) => {
    // J always folds to a bet regardless of alpha
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P0=K, P1=J
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);

    const row = probRow(page.locator('#prob-rows'), 'Fold');
    await expect(row.locator('.prob-pct')).toHaveText('100.0%');
  });

  test('P1=K after Check — Bet shows 100.0%', async ({ page }) => {
    // K always bets after a check regardless of alpha
    await mockRandom(page, [DEALS[3].rand, 0.5]); // P0=Q, P1=K
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check');
    await waitForTurn(page);

    const row = probRow(page.locator('#prob-rows'), 'Bet');
    await expect(row.locator('.prob-pct')).toHaveText('100.0%');
  });

  test('P1=Q after Check — Check shows 100.0%', async ({ page }) => {
    // Q never bets after a check (hardcoded in KuhnStrategy)
    await mockRandom(page, [DEALS[5].rand, 0.5]); // P0=K, P1=Q
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check');
    await waitForTurn(page);

    const row = probRow(page.locator('#prob-rows'), 'Check');
    await expect(row.locator('.prob-pct')).toHaveText('100.0%');
  });
});

// ── Alpha slider ──────────────────────────────────────────────────────────────

test.describe('alpha slider', () => {
  test('displays "1/3" at maximum (default)', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#alpha-display')).toHaveText('1/3');
  });

  test('displays "0" at minimum', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#alpha-slider').fill('0');
    await page.locator('#alpha-slider').dispatchEvent('input');
    await expect(page.locator('#alpha-display')).toHaveText('0');
  });

  test('displays a decimal at a mid-range value', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#alpha-slider').fill('167');
    await page.locator('#alpha-slider').dispatchEvent('input');
    await expect(page.locator('#alpha-display')).toHaveText('0.167');
  });

  test('hint text mentions Nash equilibrium at maximum', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#alpha-hint')).toContainText('Nash equilibrium');
  });

  test('hint text mentions "never bluffs" at minimum', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#alpha-slider').fill('0');
    await page.locator('#alpha-slider').dispatchEvent('input');
    await expect(page.locator('#alpha-hint')).toContainText('never bluffs');
  });
});

// ── History chips ─────────────────────────────────────────────────────────────

test.describe('history chips', () => {
  test('Bet chip has .bet class', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await expect(page.locator('#history-row .action-chip.bet')).toBeVisible();
  });

  test('Fold chip has .fold class', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P1=J always folds
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.fold')).toBeVisible();
  });

  test('Call chip has .call class', async ({ page }) => {
    await mockRandom(page, [DEALS[1].rand, 0.5]); // P1=K always calls
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.call')).toBeVisible();
  });

  test('Check chips have .check class', async ({ page }) => {
    await mockRandom(page, [DEALS[5].rand, 0.5]); // P1=Q always checks back
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.check')).toHaveCount(2);
  });
});
