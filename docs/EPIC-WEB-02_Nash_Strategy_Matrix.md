# EPIC-WEB-02: Full Nash Strategy Matrix Panel

**Status: Open**
**Depends on:** EPIC-WEB-01 (requires `KuhnStrategy` wired in the shim)

---

## Problem

The current UI shows probabilities for one info set at a time — whichever happened to
arise in the current hand. A player who wants to understand the complete Nash equilibrium
must play many hands and mentally assemble the picture. The full 12-row strategy table
(4 info sets × J/Q/K for each player) is never shown.

`pkcore`'s `EPIC-17` `kuhn_tree` example renders exactly this table in the terminal. The
web front-end should offer the same view, live-updating with the alpha slider.

---

## Goal

Add a collapsible "Nash Strategy Table" panel below the alpha slider that renders all
four information sets with their action probabilities at the current alpha value.

---

## New export: `full_strategy_table`

```rust
/// Return the complete GTO strategy table for the current alpha.
///
/// Returns JSON:
/// {
///   "rows": [
///     { "player": 0, "history": "", "card": "J", "probabilities": [{action, prob}, ...] },
///     ...12 rows total...
///   ]
/// }
#[wasm_bindgen]
pub fn full_strategy_table(alpha: f64) -> String
```

Implementation: iterate over all combinations of `(player, history_prefix, card)`,
construct the `KuhnInfoSet`, call `KuhnStrategy::gto(alpha).action_probs()`, and
serialize. This is a pure read — no game state needed.

The 12 info sets are:

| Player | History (what they saw) | Cards |
|---|---|---|
| P0 | `""` (acts first) | J, Q, K |
| P1 | `"Check"` (P0 checked) | J, Q, K |
| P1 | `"Bet"` (P0 bet) | J, Q, K |
| P0 | `"Check,Bet"` (P0 checked, P1 bet back) | J, Q, K |

---

## Front-end changes (`www/index.html`)

### Panel structure

```
▼ Nash Strategy Table  (alpha = 1/3)
──────────────────────────────────────────────
P0 acting first
  J   [Bet ████░░░░░░  33%]  [Check ██████░░  67%]
  Q   [Bet ░░░░░░░░░░   0%]  [Check ██████████ 100%]
  K   [Bet ██████████ 100%]  [Check ░░░░░░░░░░  0%]
──────────────────────────────────────────────
P1 after P0 checks
  J   [Check ██████░░  67%]  [Bet ████░░░░░░  33%]
  ...
```

The panel collapses / expands with a click on the header. Default: **collapsed**.

### Alpha slider integration

`full_strategy_table` is called on every `input` event on the alpha slider (in addition
to the existing `updateAlphaDisplay`). The table rows re-render with the new probabilities
so the user can watch the strategy shift in real time as they move from α=0 to α=1/3.

### Highlight active info set

When a hand is in progress, the row(s) corresponding to the current info set should be
highlighted (outline or background tint) so the user can see their current position in
the full table.

---

## Acceptance criteria

- [ ] `full_strategy_table` is exported and returns all 12 info-set rows.
- [ ] Panel renders correctly at α=0 and α=1/3 (spot-check against EPIC-17 tables).
- [ ] Alpha slider movement live-updates the table.
- [ ] Active info set row is highlighted during a hand.
- [ ] Panel is collapsed by default and does not obstruct the main game table on mobile.
