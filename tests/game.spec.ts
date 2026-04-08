/**
 * Core game-flow tests.
 *
 * Deterministic scenarios used throughout:
 *
 *   DEALS[4]  P0=K, P1=J — P1 always folds to a bet (Fold prob = 1.0)
 *   DEALS[1]  P0=J, P1=K — P1 always calls a bet  (Call prob = 1.0)
 *   DEALS[5]  P0=K, P1=Q — P1 always checks back after P0 checks (Check prob = 1.0)
 *   DEALS[2]  P0=Q, P1=J — P1 always folds to a bet (Fold prob = 1.0)
 *   DEALS[3]  P0=Q, P1=K — P1 always bets after P0 checks (Bet prob = 1.0)
 *
 * The AI's `rand` argument (second mock value) does not affect the outcome in
 * these scenarios because the relevant probabilities are 0 or 1.
 */

import { test, expect } from '@playwright/test';
import { DEALS, mockRandom, waitForBoot, waitForTurn } from './helpers';

// ── Page load ─────────────────────────────────────────────────────────────────

test.describe('page load', () => {
  test('shows Deal button and initial status after WASM boots', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#btn-deal')).toBeVisible();
    await expect(page.locator('#btn-deal')).toHaveText('Deal');
    await expect(page.locator('#status')).toHaveText('Deal to start a new hand.');
  });

  test('score counters start at zero', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#sc-wins')).toHaveText('0');
    await expect(page.locator('#sc-losses')).toHaveText('0');
    await expect(page.locator('#sc-chips')).toHaveText('0');
  });

  test('both cards are face-down before the first deal', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#card-p0')).toHaveClass(/face-down/);
    await expect(page.locator('#card-p1')).toHaveClass(/face-down/);
  });
});

// ── Dealing ───────────────────────────────────────────────────────────────────

test.describe('dealing', () => {
  test('P0 card is face-up, P1 card is face-down after deal', async ({ page }) => {
    await mockRandom(page, [DEALS[0].rand]);
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#card-p0')).not.toHaveClass(/face-down/);
    await expect(page.locator('#card-p1')).toHaveClass(/face-down/);
    await expect(page.locator('#status')).toHaveText('Your turn. You act first.');
  });

  test('Check and Bet buttons appear after deal', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('.btn-check')).toBeVisible();
    await expect(page.locator('.btn-bet')).toBeVisible();
  });

  test('P0=J card has .jack class and shows "J"', async ({ page }) => {
    await mockRandom(page, [DEALS[0].rand]); // P0=J
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#card-p0')).toHaveClass(/jack/);
    await expect(page.locator('#card-p0')).toHaveText('J');
  });

  test('P0=Q card has .queen class and shows "Q"', async ({ page }) => {
    await mockRandom(page, [DEALS[2].rand]); // P0=Q
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#card-p0')).toHaveClass(/queen/);
    await expect(page.locator('#card-p0')).toHaveText('Q');
  });

  test('P0=K card has .king class and shows "K"', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand]); // P0=K
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#card-p0')).toHaveClass(/king/);
    await expect(page.locator('#card-p0')).toHaveText('K');
  });

  test('pot starts at 2 after deal', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#pot-chips')).toHaveText('2');
  });

  test('history row is empty after deal', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');

    await expect(page.locator('#history-row .action-chip')).toHaveCount(0);
  });
});

// ── P0=K vs P1=J: P0 bets → P1 always folds ──────────────────────────────────

test.describe('K-J: P0 bets, P1 folds (deterministic)', () => {
  test.beforeEach(async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5]); // P0=K, P1=J, AI rand irrelevant
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
  });

  test('P0 wins 1 chip', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#status')).toContainText('win 1 chip');
    await expect(page.locator('#status')).toHaveClass(/win/);
  });

  test("P1's card is revealed as J at hand end", async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#card-p1')).not.toHaveClass(/face-down/);
    await expect(page.locator('#card-p1')).toHaveText('J');
    await expect(page.locator('#card-p1')).toHaveClass(/jack/);
  });

  test('win counter and chip total increment', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#sc-wins')).toHaveText('1');
    await expect(page.locator('#sc-chips')).toHaveText('+1');
  });

  test('Deal Again replaces action buttons', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#btn-deal')).toHaveText('Deal Again');
    await expect(page.locator('.btn-bet')).not.toBeVisible();
    await expect(page.locator('.btn-check')).not.toBeVisible();
  });

  test('history shows Bet then Fold chips', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.bet')).toBeVisible();
    await expect(page.locator('#history-row .action-chip.fold')).toBeVisible();
  });

  test('pot is 3 after bet (before fold)', async ({ page }) => {
    await page.click('.btn-bet');
    // Pot updates when P0's bet is applied, before AI folds.
    // After the fold the pot is shown but the hand ends, leaving it at 3.
    await waitForTurn(page);
    await expect(page.locator('#pot-chips')).toHaveText('3');
  });
});

// ── P0=J vs P1=K: P0 bets → P1 always calls ──────────────────────────────────

test.describe('J-K: P0 bets, P1 calls (deterministic showdown)', () => {
  test.beforeEach(async ({ page }) => {
    await mockRandom(page, [DEALS[1].rand, 0.5]); // P0=J, P1=K, AI rand irrelevant
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
  });

  test('P0 loses 2 chips at showdown (J < K)', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#status')).toContainText('lose 2 chips');
    await expect(page.locator('#status')).toHaveClass(/lose/);
  });

  test('loss counter and chip total decrement', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#sc-losses')).toHaveText('1');
    await expect(page.locator('#sc-chips')).toHaveText('-2');
  });

  test('history shows Bet then Call chips', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.bet')).toBeVisible();
    await expect(page.locator('#history-row .action-chip.call')).toBeVisible();
  });

  test('pot reaches 4 after Bet + Call', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#pot-chips')).toHaveText('4');
  });
});

// ── P0=K vs P1=Q: P0 checks → P1 always checks back ─────────────────────────

test.describe('K-Q: P0 checks, P1 checks back (deterministic showdown)', () => {
  test.beforeEach(async ({ page }) => {
    await mockRandom(page, [DEALS[5].rand, 0.5]); // P0=K, P1=Q
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
  });

  test('P0 wins 1 chip at showdown (K > Q)', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#status')).toContainText('win 1 chip');
  });

  test('history shows two Check chips', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip.check')).toHaveCount(2);
  });

  test('pot stays at 2 (no bet)', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#pot-chips')).toHaveText('2');
  });
});

// ── P0=Q vs P1=J: P0 bets → P1 always folds ─────────────────────────────────

test.describe('Q-J: P0 bets, P1 folds (deterministic)', () => {
  test.beforeEach(async ({ page }) => {
    await mockRandom(page, [DEALS[2].rand, 0.5]); // P0=Q, P1=J
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
  });

  test('P0 wins 1 chip', async ({ page }) => {
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#status')).toContainText('win 1 chip');
  });
});

// ── P0=Q vs P1=K: check-bet path ─────────────────────────────────────────────

test.describe('Q-K: P0 checks, P1 always bets back, P0 gets second decision', () => {
  test.beforeEach(async ({ page }) => {
    await mockRandom(page, [DEALS[3].rand, 0.5]); // P0=Q, P1=K
    await page.goto('/');
    await waitForBoot(page);
    await page.click('#btn-deal');
  });

  test('P0 receives Call and Fold buttons after P1 bets back', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('.btn-call')).toBeVisible();
    await expect(page.locator('.btn-fold')).toBeVisible();
  });

  test('P0 folding loses 1 chip', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await page.click('.btn-fold');
    await expect(page.locator('#status')).toContainText('lose 1 chip');
    await expect(page.locator('#status')).toHaveClass(/lose/);
  });

  test('P0 calling and losing at showdown (Q < K) loses 2 chips', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await page.click('.btn-call');
    await expect(page.locator('#status')).toContainText('lose 2 chips');
  });

  test('pot reaches 3 after Check + Bet', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await expect(page.locator('#pot-chips')).toHaveText('3');
  });

  test('history shows Check, Bet, Fold after P0 folds', async ({ page }) => {
    await page.click('.btn-check');
    await waitForTurn(page);
    await page.click('.btn-fold');
    await expect(page.locator('#history-row .action-chip.check')).toBeVisible();
    await expect(page.locator('#history-row .action-chip.bet')).toBeVisible();
    await expect(page.locator('#history-row .action-chip.fold')).toBeVisible();
  });
});

// ── Multi-hand scoring ────────────────────────────────────────────────────────

test.describe('score accumulates across hands', () => {
  test('win then loss nets the correct chip total', async ({ page }) => {
    // Hand 1: P0=K, P1=J → P0 bets, P1 folds → +1
    // Hand 2: P0=J, P1=K → P0 bets, P1 calls, showdown J<K → -2
    await mockRandom(page, [DEALS[4].rand, 0.5, DEALS[1].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#sc-chips')).toHaveText('+1');

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#sc-chips')).toHaveText('-1');
    await expect(page.locator('#sc-wins')).toHaveText('1');
    await expect(page.locator('#sc-losses')).toHaveText('1');
  });

  test('history clears between hands', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5, DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#history-row .action-chip')).toHaveCount(2);

    await page.click('#btn-deal'); // Deal Again
    await expect(page.locator('#history-row .action-chip')).toHaveCount(0);
  });

  test('P1 card goes face-down again on the next deal', async ({ page }) => {
    await mockRandom(page, [DEALS[4].rand, 0.5, DEALS[4].rand, 0.5]);
    await page.goto('/');
    await waitForBoot(page);

    await page.click('#btn-deal');
    await page.click('.btn-bet');
    await waitForTurn(page);
    await expect(page.locator('#card-p1')).not.toHaveClass(/face-down/);

    await page.click('#btn-deal');
    await expect(page.locator('#card-p1')).toHaveClass(/face-down/);
  });
});
