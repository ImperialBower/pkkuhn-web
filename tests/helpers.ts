import { type Page } from '@playwright/test';

/**
 * The six possible deals, in the order produced by the `deal()` WASM export.
 * Index = floor(rand * 6).  Each entry's `rand` maps cleanly to that index.
 */
export const DEALS = [
  { p0: 'J', p1: 'Q', rand: 0.083 }, // 0
  { p0: 'J', p1: 'K', rand: 0.183 }, // 1
  { p0: 'Q', p1: 'J', rand: 0.350 }, // 2
  { p0: 'Q', p1: 'K', rand: 0.517 }, // 3
  { p0: 'K', p1: 'J', rand: 0.683 }, // 4
  { p0: 'K', p1: 'Q', rand: 0.850 }, // 5
] as const;

/**
 * Replace `Math.random` with a fixed sequence before the page loads.
 * Must be called before `page.goto()`.
 *
 * Call order in the app:
 *   1. deal(Math.random())          — determines the cards
 *   2. gto_action(..., Math.random()) — determines the AI's sampled action
 *
 * Once the sequence is exhausted the last value is repeated.
 */
export async function mockRandom(page: Page, values: number[]): Promise<void> {
  await page.addInitScript(({ vals }: { vals: number[] }) => {
    let idx = 0;
    Math.random = () => {
      const v = vals[Math.min(idx, vals.length - 1)];
      idx++;
      return v;
    };
  }, { vals: values });
}

/** Wait for the WASM module to finish booting (Deal button becomes enabled). */
export async function waitForBoot(page: Page): Promise<void> {
  await page.waitForSelector('#btn-deal:not([disabled])', { timeout: 10_000 });
}

/**
 * Wait until P0 can act again (enabled action buttons) or the hand has ended
 * (Deal Again button enabled).  Handles the 700 ms AI think delay.
 */
export async function waitForTurn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const btns = document.querySelectorAll<HTMLButtonElement>('#action-area button');
      return [...btns].some(b => !b.disabled);
    },
    { timeout: 10_000 },
  );
}
