# EPIC-WEB-03: CFR Convergence Panel

**Status: Complete**
**Depends on:** EPIC-WEB-01, EPIC-WEB-02

---

## Problem

`pkcore` includes a full vanilla CFR implementation (`KuhnCfr`) that provably converges
to the Nash equilibrium. The web demo currently presents only the analytical GTO solution
and gives the user no way to see *how* or *why* that solution is correct. A learner who
wants to understand CFR — the algorithm behind modern poker solvers — has no entry point
in the UI.

`pkcore`'s `EPIC-17` `kuhn_cfr` terminal example already demonstrates this convergence
with a table of snapshots at logarithmic iteration counts. Bringing that content into the
browser makes it accessible without a Rust toolchain.

---

## Goal

Add a "CFR Trainer" section that lets the user run CFR in the browser, watch exploitability
decay, and compare the learned strategy side-by-side with the analytical Nash table.

---

## New exports

### `run_cfr`

```rust
/// Run `iterations` of vanilla CFR and return the learned strategy + exploitability.
///
/// Returns JSON:
/// {
///   "iterations": 1000,
///   "exploitability": 0.0312,
///   "rows": [
///     { "player": 0, "history": "", "card": "J",
///       "learned": [{action, prob}, ...],
///       "nash":    [{action, prob}, ...]
///     },
///     ... 12 rows ...
///   ]
/// }
#[wasm_bindgen]
pub fn run_cfr(iterations: u32) -> String
```

Implementation:
1. `let mut cfr = KuhnCfr::new(); cfr.train(iterations);`
2. `let learned = cfr.average_strategy();`
3. `let nash = KuhnStrategy::default();` (alpha = 1/3)
4. For each of the 12 info sets, include both `learned` and `nash` probabilities.
5. Include `cfr.exploitability()` in the response.

WASM note: `KuhnCfr::train(100_000)` is cheap enough to run synchronously — the full tree
is only 12 info sets. If profiling shows it blocks the UI thread at high iteration counts,
wrap in a `setTimeout` chain or expose an `async` variant.

### `exploitability_at`

```rust
/// Return exploitability after `iterations` of CFR (no strategy rows).
/// Useful for polling in a step-by-step animation.
///
/// Returns JSON: `{ "iterations": N, "exploitability": f64 }`
#[wasm_bindgen]
pub fn exploitability_at(iterations: u32) -> String
```

---

## Front-end changes (`www/index.html`)

### Panel structure

```
▼ CFR Convergence  [Run]  [  1 000  ▾]
──────────────────────────────────────────────────────
Exploitability: 0.0312  (target < 0.050 at 1 000 iter)

Iterations  Exploitability
       100  0.142
     1 000  0.031
    10 000  0.008
   100 000  0.002

Strategy comparison (after 1 000 iterations):
  Info set          Learned           Nash (α=1/3)
  P0 J (open)       Bet  31.4%        Bet  33.3%
  ...12 rows...
```

### Controls

- Iteration preset dropdown: `100 / 1 000 / 10 000 / 100 000`.
- "Run" button triggers `run_cfr(N)` and renders results.
- "Step through" toggle runs the four presets sequentially with a short delay,
  animating the exploitability value decreasing.

### Exploitability target indicators

Color-code the exploitability cell:
- Red: above `0.05`
- Yellow: `0.005 – 0.05`
- Green: below `0.005`

These thresholds match the acceptance criteria in `pkcore` EPIC-17, Phase 3.

---

## Acceptance criteria

- [x] `run_cfr(1000)` returns exploitability < 0.05 (matches pkcore EPIC-17 target).
- [x] `run_cfr(100000)` returns exploitability < 0.002.
- [x] Strategy comparison table shows all 12 info sets with both learned and Nash columns.
- [x] UI does not freeze at 100 000 iterations (verify on mid-range hardware).
- [x] Panel is collapsed by default.
