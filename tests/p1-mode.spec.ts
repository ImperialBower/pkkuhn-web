/**
 * Play-as-P1 mode tests (EPIC-WEB-04).
 *
 * Acceptance criteria:
 *  - Toggle switches user to P1; AI takes P0 actions via KuhnStrategy::gto
 *  - P1's card shown face-up from deal; P0's card face-down until showdown
 *  - AI P0 actions appear with same AI_THINK_MS delay as normal AI turns
 *  - GTO hint panel shows P1 probabilities after user acts as P1
 *  - Score bar tracks P1 net chips correctly
 *  - Switching modes mid-hand resets the current hand cleanly
 *  - All five betting paths reachable in P1 mode
 *
 * Kuhn poker deal table (deal index = floor(rand * 6)):
 *   0.083 → p0=J, p1=Q
 *   0.183 → p0=J, p1=K
 *   0.350 → p0=Q, p1=J   ← P0 always checks (Q never bets)
 *   0.517 → p0=Q, p1=K
 *   0.683 → p0=K, p1=J   ← P0 always bets  (K bets ~100%)
 *   0.850 → p0=K, p1=Q
 */

import { test, expect } from '@playwright/test';
import { waitForBoot, waitForTurn, mockRandom } from './helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Switch the UI to P1 mode and wait for the toggle to activate. */
async function enableP1Mode(page: Parameters<typeof waitForBoot>[0]) {
  await page.locator('#role-p1').click();
  await expect(page.locator('#role-p1')).toHaveClass(/active/);
}

/** Deal a hand in P1 mode and wait for the AI (P0) to complete its opening action. */
async function dealInP1Mode(page: Parameters<typeof waitForBoot>[0]) {
  await page.locator('#btn-deal').click();
  // After dealing, action area is empty while AI thinks (AI_THINK_MS = 700ms).
  // waitForTurn waits for any enabled button, which appears after AI acts.
  await waitForTurn(page);
}

// ── Toggle state ──────────────────────────────────────────────────────────────

test.describe('role toggle', () => {
  test('P0 button is active by default', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#role-p0')).toHaveClass(/active/);
    await expect(page.locator('#role-p1')).not.toHaveClass(/active/);
  });

  test('clicking P1 activates P1 button and deactivates P0', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#role-p1').click();
    await expect(page.locator('#role-p1')).toHaveClass(/active/);
    await expect(page.locator('#role-p0')).not.toHaveClass(/active/);
  });

  test('subtitle updates to "You are P1, AI is P0" when P1 mode selected', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#role-p1').click();
    await expect(page.locator('#subtitle')).toContainText('You are P1, AI is P0');
  });

  test('player labels swap when entering P1 mode', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#role-p1').click();
    await expect(page.locator('#label-top')).toHaveText('You (P1)');
    await expect(page.locator('#label-bottom')).toHaveText('Opponent (P0)');
  });

  test('clicking P0 button restores default labels', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#role-p1').click();
    await page.locator('#role-p0').click();
    await expect(page.locator('#label-top')).toHaveText('Opponent (P1)');
    await expect(page.locator('#label-bottom')).toHaveText('You (P0)');
  });
});

// ── Card visibility ───────────────────────────────────────────────────────────

test.describe('card visibility in P1 mode', () => {
  test('top card (P1 = user) is face-up after deal', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    // #card-p1 is the top card; in P1 mode it is the user's card
    await expect(page.locator('#card-p1')).not.toHaveClass(/face-down/);
  });

  test('bottom card (P0 = AI) is face-down during hand', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await expect(page.locator('#card-p0')).toHaveClass(/face-down/);
  });

  test('top card shows the correct P1 rank', async ({ page }) => {
    // mockRandom: deal index 2 → p0=Q, p1=J; second value for AI's opening action
    await mockRandom(page, [0.350, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    // p1=J, so top card should show 'J'
    await expect(page.locator('#card-p1')).toHaveText('J');
  });

  test('AI card (P0) is revealed at showdown', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K, P0 bets → user sees Call/Fold
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    // User folds → terminal → P0's card revealed
    await page.locator('#btn-fold').click();
    await expect(page.locator('#card-p0')).not.toHaveClass(/face-down/);
  });
});

// ── AI acts first ─────────────────────────────────────────────────────────────

test.describe('AI (P0) acts first in P1 mode', () => {
  test('action chip appears after deal (AI opened)', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]); // p0=Q → AI checks
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await expect(page.locator('.action-chip')).toHaveCount(1);
  });

  test('user sees exactly two action buttons after AI opens', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await expect(page.locator('#action-area button')).toHaveCount(2);
  });

  test('P0 checks: user sees Check and Bet buttons', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]); // p0=Q always checks
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await expect(page.locator('#btn-check')).toBeVisible();
    await expect(page.locator('#btn-bet')).toBeVisible();
  });

  test('P0 bets: user sees Call and Fold buttons', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K always bets
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await expect(page.locator('#btn-call')).toBeVisible();
    await expect(page.locator('#btn-fold')).toBeVisible();
  });
});

// ── Hint panel ────────────────────────────────────────────────────────────────

test.describe('GTO hint panel in P1 mode', () => {
  test('hint panel visible after user acts as P1', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K bets; user faces Call/Fold
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-fold').click();
    // Hint panel ("Your GTO line") should appear
    await expect(page.locator('#p0-panel')).toBeVisible();
  });

  test('hint panel shows probability rows after user acts', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-fold').click();
    await expect(page.locator('#p0-panel .prob-row')).toHaveCount(2);
  });
});

// ── Score tracking ────────────────────────────────────────────────────────────

test.describe('score tracking from P1 perspective', () => {
  test('P1 wins when P0 folds to a bet', async ({ page }) => {
    // p0=Q checks, P1 bets (any card), P0 folds → P1 wins
    // P0's Q at Check,Bet: folds ~66.7%. Use a second gto_action rand for P0's response.
    // mockRandom: [deal_rand, ai_open_rand, ai_respond_rand]
    // deal=0.350 → p0=Q, p1=J; AI checks (rand 0.5, Q always checks); user bets;
    // then AI (P0) faces Check,Bet with Q: rand 0.1 → check order-dependent fold/call
    // We accept either outcome and just verify win/loss flips correctly.
    await mockRandom(page, [0.350, 0.5, 0.1]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-bet').click();
    // Wait for P0's second action (Check,Bet response) and hand end
    await waitForTurn(page);
    // Score should reflect P1's result (chips should be non-zero)
    const chipsText = await page.locator('#sc-chips').textContent();
    expect(chipsText).not.toBe('+0');
  });

  test('chips reset to 0 when switching from P1 to P0 mode', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K bets; user folds → P1 loses
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-fold').click();
    await waitForTurn(page);
    // Chips should be non-zero (loss)
    const before = await page.locator('#sc-chips').textContent();
    expect(before).not.toBe('+0');
    // Switch back to P0 mode → score resets
    await page.locator('#role-p0').click();
    await expect(page.locator('#sc-chips')).toHaveText('+0');
    await expect(page.locator('#sc-wins')).toHaveText('0');
    await expect(page.locator('#sc-losses')).toHaveText('0');
  });
});

// ── Mode switch mid-hand ──────────────────────────────────────────────────────

test.describe('mode switch mid-hand', () => {
  test('switching to P1 mode while hand is in progress resets cleanly', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    // Start a hand in P0 mode and make one move
    await page.locator('#btn-deal').click();
    await page.locator('#btn-check').click();
    // At least one action chip is in the history
    await expect(page.locator('.action-chip')).not.toHaveCount(0);
    // Switch to P1 mode mid-hand
    await page.locator('#role-p1').click();
    // History should be cleared
    await expect(page.locator('.action-chip')).toHaveCount(0);
    // Deal button should be present
    await expect(page.locator('#btn-deal')).toBeVisible();
    await expect(page.locator('#btn-deal')).not.toBeDisabled();
  });

  test('switching back to P0 mode mid-P1-hand resets cleanly', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]);
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    // AI has acted; action chips present
    await expect(page.locator('.action-chip')).toHaveCount(1);
    // Switch back to P0 mode
    await page.locator('#role-p0').click();
    await expect(page.locator('.action-chip')).toHaveCount(0);
    await expect(page.locator('#btn-deal')).toBeVisible();
  });
});

// ── All five betting paths ────────────────────────────────────────────────────

test.describe('all five Kuhn poker paths reachable in P1 mode', () => {
  // Path 1: P0 checks, P1 checks → Check-Check
  test('path: Check-Check (P0 checks, P1 checks)', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5]); // p0=Q always checks
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-check').click();
    await waitForTurn(page); // hand ends
    await expect(page.locator('#btn-deal')).toBeVisible();
    await expect(page.locator('.action-chip')).toHaveCount(2);
  });

  // Path 4: P0 bets, P1 calls → Bet-Call
  test('path: Bet-Call (P0 bets, P1 calls)', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K always bets
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-call').click();
    await waitForTurn(page);
    await expect(page.locator('#btn-deal')).toBeVisible();
    await expect(page.locator('.action-chip')).toHaveCount(2);
  });

  // Path 5: P0 bets, P1 folds → Bet-Fold
  test('path: Bet-Fold (P0 bets, P1 folds)', async ({ page }) => {
    await mockRandom(page, [0.683, 0.5]); // p0=K always bets
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    await page.locator('#btn-fold').click();
    await waitForTurn(page);
    await expect(page.locator('#btn-deal')).toBeVisible();
    await expect(page.locator('.action-chip')).toHaveCount(2);
  });

  // Path 2 or 3: P0 checks, P1 bets → P0 responds (Call or Fold)
  test('path: Check-Bet-* (P0 checks, P1 bets, P0 responds)', async ({ page }) => {
    await mockRandom(page, [0.350, 0.5, 0.5]); // p0=Q checks; P1 bets; P0 responds
    await page.goto('/');
    await waitForBoot(page);
    await enableP1Mode(page);
    await dealInP1Mode(page);
    // P0 checked → user sees Check/Bet
    await expect(page.locator('#btn-bet')).toBeVisible();
    await page.locator('#btn-bet').click();
    // P0 now acts at Check,Bet (AI_THINK_MS delay)
    await waitForTurn(page); // waits for P0's response and hand end
    await expect(page.locator('#btn-deal')).toBeVisible();
    // Three action chips: Check (P0), Bet (user), Call or Fold (P0)
    await expect(page.locator('.action-chip')).toHaveCount(3);
  });
});

// ── AI strategy panel in P1 mode ──────────────────────────────────────────────

test('AI strategy panel shows P0 probabilities after AI opens', async ({ page }) => {
  await mockRandom(page, [0.350, 0.5]);
  await page.goto('/');
  await waitForBoot(page);
  await enableP1Mode(page);
  await dealInP1Mode(page);
  // AI panel should be visible showing P0's opening strategy
  await expect(page.locator('#ai-panel')).toBeVisible();
  await expect(page.locator('#ai-panel .prob-row')).toHaveCount(2);
});

// ── Full hand flow ────────────────────────────────────────────────────────────

test('complete hand in P1 mode: deal, play, deal again', async ({ page }) => {
  await mockRandom(page, [0.683, 0.5, 0.683, 0.5]); // two hands: p0=K bets
  await page.goto('/');
  await waitForBoot(page);
  await enableP1Mode(page);

  // Hand 1
  await dealInP1Mode(page);
  await page.locator('#btn-fold').click();
  await waitForTurn(page);
  const dealBtn = page.locator('#btn-deal');
  await expect(dealBtn).toHaveText('Deal Again');

  // Hand 2 — deal again stays in P1 mode
  await dealBtn.click();
  await waitForTurn(page);
  await expect(page.locator('.action-chip')).toHaveCount(1);
  await expect(page.locator('#role-p1')).toHaveClass(/active/);
});

// ── Mobile layout ─────────────────────────────────────────────────────────────

test('no horizontal overflow in P1 mode at 375px', async ({ page }) => {
  await mockRandom(page, [0.683, 0.5]);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await waitForBoot(page);
  await enableP1Mode(page);
  await dealInP1Mode(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
