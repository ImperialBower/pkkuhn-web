# EPIC-WEB-04: Play as P1 (Responder Mode)

**Status: Complete**
**Depends on:** EPIC-WEB-01 (P0 hint panel needed for symmetric feedback)

---

## Problem

The demo always assigns the user to P0 (first to act). P1 faces the harder decisions in
Kuhn poker: bluffing with a Jack after P0 checks, calling down with a Queen after P0 bets.
These are the information sets where mixed strategies matter most, and a player training
to understand GTO reasoning needs to experience them from the inside.

---

## Goal

Add a "Play as P1" toggle. When active, the AI plays P0 (using `KuhnStrategy::gto`) and
the user responds as P1. The GTO hint panel (from EPIC-WEB-01) shows P1's optimal
probabilities for the current info set, giving the same post-action feedback symmetrically.

---

## No new WASM exports required

The existing `gto_action` already calls into `KuhnStrategy` (post EPIC-WEB-01) and can
serve either player once the shim is generalized. The front-end needs only to swap
which player is human and which is AI.

One small addition: `gto_action` currently takes `p1_card` because P1 was always the AI.
Rename the parameter semantically to `ai_card` in the front-end call, or add a thin
`gto_action_for_player(player: usize, ...)` export if the shim needs to target P0 vs P1
specifically.

---

## Front-end changes (`www/index.html`)

### Toggle control

```
[ Play as P0 ]  [ Play as P1 ]     ← tab / radio toggle, persists across deals
```

Place above the table, below the subtitle.

### P1 mode game flow

1. **Deal**: both cards dealt, P1's card shown face-up (user's card); P0's card face-down.
2. **AI acts as P0**: `gto_action` called for P0; AI action rendered with a short delay
   and shown in the history row.
3. **User acts as P1**: action buttons rendered for P1's legal actions at this history.
4. If the game continues (Check → user's action → possible further P0 response):
   the AI acts again as P0 for the final decision.
5. **End of hand**: both cards revealed; payoff shown from P1's perspective (flip sign
   of the P0-centric payoff array).
6. **Hint panel**: shows P1's GTO probabilities for the info set just played.

### Score bar

P1 mode tracks P1's net chips (negation of `payoff[0]`). Wins/losses are from P1's
perspective. The score bar label changes to "You (P1)".

### Hint panel in P1 mode

The same "Your GTO line" panel from EPIC-WEB-01 activates here, populated with P1's
info-set probabilities. Because P1 acts at most once per hand (in the current game tree),
the hint always appears at the end of P1's action.

---

## Acceptance criteria

- [x] "Play as P1" toggle switches the user to P1; AI takes P0 actions using `KuhnStrategy::gto`.
- [x] P1's card is shown face-up from deal; P0's card is face-down until showdown.
- [x] AI P0 actions appear with the same `AI_THINK_MS` delay as AI P1 actions in P0 mode.
- [x] GTO hint panel shows P1 probabilities after the user acts as P1.
- [x] Score bar tracks P1 net chips correctly.
- [x] Switching modes mid-hand resets the current hand cleanly.
- [x] All five betting paths reachable in P1 mode (P0 can check or bet; user can respond).
