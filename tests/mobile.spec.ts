/**
 * Mobile layout tests for the Nash Strategy Table panel.
 *
 * Verifies that:
 *  - No horizontal overflow at 375 px (iPhone SE) or 320 px (narrow)
 *  - The strategy panel is collapsed by default at mobile widths
 *  - The panel can be opened and closed on mobile
 *  - All 12 table rows are visible when the panel is expanded
 *  - The alpha slider still updates the table correctly on mobile
 *  - The game table is not obstructed by the strategy panel
 */

import { test, expect } from '@playwright/test';
import { waitForBoot } from './helpers';

// ── Shared overflow check ─────────────────────────────────────────────────────

/**
 * Returns true if the page has horizontal scroll (content wider than viewport).
 * Uses scrollWidth of <html> which catches overflow from any descendant.
 */
async function hasHorizontalOverflow(page: Parameters<typeof waitForBoot>[0]): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}

// ── iPhone SE (375 × 667) ─────────────────────────────────────────────────────

test.describe('375 px viewport (iPhone SE)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('no horizontal overflow on initial load', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('strategy panel is collapsed by default', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#strategy-wrap')).not.toHaveAttribute('open');
    await expect(page.locator('#strategy-body')).not.toBeVisible();
  });

  test('strategy panel opens and closes on tap', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    // Open
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).toBeVisible();
    await expect(page.locator('#strategy-wrap')).toHaveAttribute('open', '');

    // Close
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).not.toBeVisible();
  });

  test('no horizontal overflow when strategy panel is open', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('all 12 strategy rows are present when expanded', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('.st-card-row')).toHaveCount(12);
  });

  test('all 4 section headers are visible when expanded', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('.st-section-header')).toHaveCount(4);
  });

  test('strategy rows update when alpha slider moves', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();

    // At default alpha=333 (≈1/3), P0(K) row shows "99.9%" for Bet
    const kingRow = page
      .locator('.st-section')
      .first()
      .locator('.st-card-row')
      .filter({ has: page.locator('.st-card-label.king') });
    const kingBetAction = kingRow
      .locator('.st-action')
      .filter({ has: page.locator('.st-act-label', { hasText: 'Bet' }) });
    const kingBetPct = kingBetAction.locator('.st-pct');
    await expect(kingBetPct).toHaveText('99.9%');

    // Move slider to 0 → P0(K) Bet becomes 0.0%
    await page.locator('#alpha-slider').fill('0');
    await page.locator('#alpha-slider').dispatchEvent('input');
    await expect(kingBetPct).toHaveText('0.0%');
  });

  test('game table is visible above the fold', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    // .table should be within the first screenful
    const tableBounds = await page.locator('.table').boundingBox();
    expect(tableBounds).not.toBeNull();
    expect(tableBounds!.y).toBeLessThan(667); // top within first viewport height
    expect(tableBounds!.y).toBeGreaterThanOrEqual(0);
  });
});

// ── 320 px (narrow) ───────────────────────────────────────────────────────────

test.describe('320 px viewport (narrow)', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('no horizontal overflow on initial load', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('no horizontal overflow when strategy panel is open', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('#strategy-body')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('all 12 strategy rows render without clipping', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.locator('#strategy-wrap summary').click();
    await expect(page.locator('.st-card-row')).toHaveCount(12);

    // Verify no row extends beyond the viewport width
    const rows = page.locator('.st-card-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(320 + 1); // 1px tolerance
      }
    }
  });

  test('strategy panel collapsed by default', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await expect(page.locator('#strategy-body')).not.toBeVisible();
  });
});
