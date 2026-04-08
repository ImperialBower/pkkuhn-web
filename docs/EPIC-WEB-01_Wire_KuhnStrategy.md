# EPIC-WEB-01: Wire `gto_action` through `KuhnStrategy`

**Status: Open**
**Depends on:** `pkcore >= 0.0.39` (`KuhnStrategy`, `KuhnInfoSet`, `KuhnState::info_set`)

---

## Problem

`gto_action` in `src/lib.rs` encodes P1's Nash equilibrium in a hand-written `match` table
(lines 217–273). This duplicates logic that already lives in `pkcore::KuhnStrategy` and
creates a silent divergence risk: if the library's strategy constants change, the shim will
not know.

It also only covers P1's two information sets. P0's strategy (the opener's betting
frequencies with J/Q/K) is never returned to the front-end, leaving half the game-theory
content of `pkcore` invisible to the user.

---

## Goal

Replace the hand-coded table with calls through the `pkcore` strategy API, and extend the
response to include the acting player's full info-set probabilities regardless of which
player is acting.

---

## API changes in `src/lib.rs`

### Replace `gto_action`

The current signature:
```rust
pub fn gto_action(p1_card: &str, history: &str, alpha: f64, rand: f64) -> String
```

becomes a thin wrapper:

```rust
// Reconstruct state at the current history, identify whose turn it is,
// build KuhnStrategy::gto(alpha), look up action_probs for that player's
// info set, sample, and return.
```

Key steps:
1. Parse cards and history; replay into `KuhnState` (same as `apply_action` does).
2. Call `KuhnStrategy::gto(alpha)` — returns `Err` only if alpha is out of range; the
   slider already clamps to `[0, 1/3]` so this should always succeed.
3. Call `state.info_set(current_player)` to get the `KuhnInfoSet` key.
4. Call `strategy.action_probs(&info_set)` to get `&[(KuhnAction, f64)]`.
5. Sample with `rand`; return `{ action, probabilities }` as before.

The `gto_action` export signature does not need to change. The front-end JSON contract is
unchanged.

### Rename / generalize

Optionally rename `gto_action` to `strategy_action` in a future pass to reflect that it
can serve either player, but that is cosmetic and can wait.

---

## New export: `p0_hint`

```rust
/// Return P0's GTO probabilities for the current info set without sampling an action.
/// Used by the hint panel to show what P0 *should* have done.
///
/// Returns JSON: `{ probabilities: [{action, prob}] }`
#[wasm_bindgen]
pub fn p0_hint(p0_card: &str, history: &str, alpha: f64) -> String
```

This calls `KuhnStrategy::gto(alpha).action_probs(&state.info_set(0))` and serializes
the result. No sampling — just probabilities.

---

## Front-end changes (`www/index.html`)

- After P0 acts, call `p0_hint(p0Card, historyBeforeAction, alpha)` and show the
  probabilities in a new "Your GTO line" panel (same visual style as the existing AI panel).
- This panel appears below the table, collapses when a new deal starts, and updates live
  when the alpha slider moves (re-call with the last captured state).

---

## Acceptance criteria

- [ ] `gto_action` calls `KuhnStrategy::gto` internally; the match table in `lib.rs` is removed.
- [ ] `p0_hint` is exported and returns correct probabilities for all three P0 info sets
      (empty history with J / Q / K).
- [ ] Front-end displays the P0 hint panel after each P0 action.
- [ ] Alpha slider movement live-updates both the AI panel and the P0 hint panel.
- [ ] All six deals × all reachable action sequences return consistent results between
      `gto_action` and `p0_hint`.
