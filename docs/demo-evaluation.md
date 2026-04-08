# Demo Utility Evaluation — pkkuhn-web

*Evaluated against the `pkcore` library surface as exposed through the WASM shim in `src/lib.rs` and the trainer UI in `www/index.html`.*

---

## What the demo is

`pkkuhn-web` is a single-page Kuhn Poker Trainer: the user plays as P0 against a GTO AI (P1) rendered
entirely in the browser via a compiled WebAssembly module. It exposes three stateless WASM functions
(`deal`, `apply_action`, `gto_action`) that the HTML/JS front-end calls through `wasm-bindgen`.

---

## What the demo demonstrates about `pkcore`

### Strengths

**Complete game loop.**
The demo exercises the full `KuhnState` lifecycle — construction, legal-action enumeration, action
application, and terminal detection — with every reachable hand combination (6 deals × up to 4 actions).
Any consumer of `pkcore` who wants to drive the state machine from an outside loop can read `lib.rs`
as a working template.

**Stateless JSON API.**
Each WASM export takes plain scalar / string arguments and returns a JSON string. There are no
`#[wasm_bindgen]`-annotated structs, so the JS side holds no opaque Rust handles. This design pattern
is portable: the same contract could be served over HTTP, used in a Node CLI, or tested with `jq`.
It is a strong implicit argument that `pkcore`'s primitives are cheap to copy and reconstruct.

**Mixed-strategy visualization.**
The probability bars that appear after each AI move are the most educationally valuable part of the
demo. They expose the core idea of Kuhn poker — that optimal play is a *mixed* strategy parameterized
by a single scalar α — to anyone who has never read a game-theory textbook. The live slider makes
the Nash equilibrium (α = 1/3) a tactile discovery rather than a formula.

**Alpha-parameter pedagogy.**
The slider that ranges from "never bluffs" to "Nash equilibrium" lets the user deliberately exploit
a sub-optimal opponent, which teaches the concept of exploitability far better than prose could.
This is a concrete demonstration of why `pkcore` needs an α parameter at all.

---

### Limitations

**GTO logic is re-implemented in the shim, not delegated to `pkcore`.**
The hand-coded strategy table in `lib.rs:217–273` encodes P1's Nash equilibrium directly in the
web layer rather than calling `pkcore`'s own `KuhnStrategy` type (referenced only in a comment:
*"Nash equilibrium (pkcore KuhnStrategy table)"*). Two consequences:

1. If `pkcore`'s strategy constants change, the shim silently diverges.
2. The demo does not prove that `pkcore` exposes a callable strategy interface — a reader might
   infer the library only provides the state machine, not the solver.

If `pkcore` exports `KuhnStrategy::action(card, history, alpha, rand)` or equivalent, wiring the
shim through that call would close the documentation gap and keep the two sources of truth in sync.

**Only P1 is the AI; P0 strategy is never displayed.**
The demo shows P1's mixed probabilities but never surfaces P0's optimal strategy. A player who
wonders "what *should* I have done as P0?" gets no feedback. This leaves half the game-theory
content of `pkcore` unexplored in the UI.

**No information-set view.**
Kuhn poker's Nash equilibrium is cleanly described by four information sets (P0 acting first with J/Q/K,
P1 acting after Check or Bet). The demo shows individual hands but never presents the full strategy
matrix, which is one of the most compact ways to understand what `pkcore` computes.

**P1 never acts first.**
The deal always gives P0 the first action. There is no mode in which the user plays P1, so the
"after P0 checks / after P0 bets" information sets are never experienced from the perspective of
the agent making the harder decision. Playing both sides would round out the educational picture.

**Alpha applies only to P1's bluff frequency; P0 exploitability is not shown.**
The hint text at α=1/3 mentions that P0(J) bets 1/3 and P0(K) always bets, but the user cannot
adjust P0's strategy or see how P1 should respond to a P0 deviation. The slider is pedagogically
one-sided.

**No replay or hand history.**
Once a hand ends the history is gone. A move-by-move replay with EV annotations would help users
understand individual decisions after the fact.

---

## Architectural observations

| Concern | Current approach | Notes |
|---|---|---|
| State ownership | Reconstructed on every call by replaying history | Correct for a stateless API; linear in hand length (≤4 actions) |
| Randomness | Caller supplies `rand: f64` | Testable without mocking; good boundary design |
| Error handling | All errors serialized as `{"error":"..."}` | Prevents JS exceptions but requires the caller to check every parse |
| Panic hook | Installed at `#[wasm_bindgen(start)]` | Correct; gives readable console output on panics |
| Alpha clamping | `alpha.clamp(0.0, 1.0/3.0)` in Rust | Defensive; slider range matches, so double-clamping is harmless |

---

## Overall utility rating

| Dimension | Assessment |
|---|---|
| As a live demo of `pkcore`'s state machine | **Excellent** — covers the full game loop with a real UI |
| As documentation of the GTO solver | **Partial** — the key result (Nash equilibrium) is visible, but the library's own solver is not exercised |
| As a WASM / `wasm-bindgen` integration example | **Good** — stateless JSON boundary is a clean, reusable pattern |
| As a game-theory teaching tool | **Good** — probability bars and α slider are genuinely instructive |
| As a showcase of `pkcore`'s full API surface | **Limited** — `KuhnHistory`, `KuhnState`, and `KuhnCard` are shown; `KuhnStrategy` is only referenced in comments |

**Summary.** The demo is a strong proof-of-concept that `pkcore` can drive a real interactive application
via WebAssembly with negligible overhead. Its biggest documentation gap is that the GTO logic lives in
the shim rather than being called through the library, which leaves readers uncertain whether `pkcore`
exposes a complete solver or only a state machine. Wiring `gto_action` through `pkcore`'s strategy type
and adding a P0-side strategy display would make this demo a complete reference implementation.

---

## Planned improvements

| Epic | Title | Gap addressed |
|---|---|---|
| [EPIC-WEB-01](EPIC-WEB-01_Wire_KuhnStrategy.md) | Wire `gto_action` through `KuhnStrategy` | GTO logic duplicated in shim; P0 strategy never shown |
| [EPIC-WEB-02](EPIC-WEB-02_Nash_Strategy_Matrix.md) | Full Nash Strategy Matrix Panel | No information-set view; alpha slider is one-sided |
| [EPIC-WEB-03](EPIC-WEB-03_CFR_Convergence_Panel.md) | CFR Convergence Panel | `KuhnCfr` never exercised; no proof of convergence |
| [EPIC-WEB-04](EPIC-WEB-04_Play_As_P1.md) | Play as P1 (Responder Mode) | P1 info sets never experienced from the user's side |
