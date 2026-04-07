use pkcore::games::kuhn::{KuhnAction, KuhnCard, KuhnHistory, KuhnState};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

fn parse_card(s: &str) -> Option<KuhnCard> {
    match s {
        "J" => Some(KuhnCard::Jack),
        "Q" => Some(KuhnCard::Queen),
        "K" => Some(KuhnCard::King),
        _ => None,
    }
}

fn parse_action(s: &str) -> Option<KuhnAction> {
    match s {
        "Check" => Some(KuhnAction::Check),
        "Bet" => Some(KuhnAction::Bet),
        "Call" => Some(KuhnAction::Call),
        "Fold" => Some(KuhnAction::Fold),
        _ => None,
    }
}

fn parse_history(s: &str) -> Option<KuhnHistory> {
    let mut h = KuhnHistory::new();
    if s.is_empty() {
        return Some(h);
    }
    for part in s.split(',') {
        h = h.push(parse_action(part.trim())?);
    }
    Some(h)
}

fn history_to_string(h: &KuhnHistory) -> String {
    h.as_slice()
        .iter()
        .map(std::string::ToString::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

// ── JSON types ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct DealResult {
    p0_card: String,
    p1_card: String,
    legal_actions: Vec<String>,
}

#[derive(Serialize)]
struct ApplyResult {
    history: String,
    is_terminal: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    payoff: Option<[i32; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    legal_actions: Option<Vec<String>>,
}

#[derive(Serialize)]
struct ProbEntry {
    action: String,
    prob: f64,
}

#[derive(Serialize)]
struct GtoResult {
    action: String,
    probabilities: Vec<ProbEntry>,
}

#[derive(Serialize)]
struct ErrorResult {
    error: String,
}

fn err(msg: &str) -> String {
    serde_json::to_string(&ErrorResult {
        error: msg.to_string(),
    })
    .unwrap_or_default()
}

// ── WASM exports ──────────────────────────────────────────────────────────────

/// Deal a new hand. `rand` should be in [0, 1).
///
/// Returns JSON: `{ p0_card, p1_card, legal_actions }`
#[wasm_bindgen]
pub fn deal(rand: f64) -> String {
    const DEALS: [(KuhnCard, KuhnCard); 6] = [
        (KuhnCard::Jack, KuhnCard::Queen),
        (KuhnCard::Jack, KuhnCard::King),
        (KuhnCard::Queen, KuhnCard::Jack),
        (KuhnCard::Queen, KuhnCard::King),
        (KuhnCard::King, KuhnCard::Jack),
        (KuhnCard::King, KuhnCard::Queen),
    ];
    let idx = ((rand * 6.0).floor() as usize).min(5);
    let (p0, p1) = DEALS[idx];

    // Use KuhnState to get legal_actions for the initial position.
    let state = KuhnState::new(p0, p1).expect("all DEALS pairs are distinct");
    let legal_actions = state
        .legal_actions()
        .iter()
        .map(std::string::ToString::to_string)
        .collect();

    serde_json::to_string(&DealResult {
        p0_card: p0.to_string(),
        p1_card: p1.to_string(),
        legal_actions,
    })
    .unwrap_or_default()
}

/// Apply an action to the current game state.
///
/// Returns JSON: `{ history, is_terminal, payoff?, legal_actions? }`
#[wasm_bindgen]
pub fn apply_action(p0_card: &str, p1_card: &str, history: &str, action: &str) -> String {
    let p0 = match parse_card(p0_card) {
        Some(c) => c,
        None => return err(&format!("Invalid card '{p0_card}'")),
    };
    let p1 = match parse_card(p1_card) {
        Some(c) => c,
        None => return err(&format!("Invalid card '{p1_card}'")),
    };
    let hist = match parse_history(history) {
        Some(h) => h,
        None => return err(&format!("Invalid history '{history}'")),
    };
    let act = match parse_action(action) {
        Some(a) => a,
        None => return err(&format!("Invalid action '{action}'")),
    };

    // Reconstruct state at the current history position by replaying actions.
    let mut state = match KuhnState::new(p0, p1) {
        Ok(s) => s,
        Err(e) => return err(&format!("Invalid deal: {e}")),
    };
    for &a in hist.as_slice() {
        state = match state.apply(a) {
            Ok(s) => s,
            Err(e) => return err(&format!("Failed to replay history: {e}")),
        };
    }

    let next = match state.apply(act) {
        Ok(s) => s,
        Err(e) => return err(&format!("Illegal action '{action}': {e}")),
    };

    let new_history = history_to_string(next.history());

    if next.is_terminal() {
        let payoff = next.payoff().unwrap_or([0, 0]);
        serde_json::to_string(&ApplyResult {
            history: new_history,
            is_terminal: true,
            payoff: Some(payoff),
            legal_actions: None,
        })
        .unwrap_or_default()
    } else {
        let legal = next
            .legal_actions()
            .iter()
            .map(std::string::ToString::to_string)
            .collect();
        serde_json::to_string(&ApplyResult {
            history: new_history,
            is_terminal: false,
            payoff: None,
            legal_actions: Some(legal),
        })
        .unwrap_or_default()
    }
}

/// Compute P1's GTO action given their card and the current history.
///
/// `alpha` ∈ [0, 1/3] is the bluff-frequency parameter (Nash equilibrium = 1/3).
/// `rand` ∈ [0, 1) is used to sample the mixed strategy.
///
/// Returns JSON: `{ action, probabilities: [{action, prob}] }`
#[wasm_bindgen]
pub fn gto_action(p1_card: &str, history: &str, alpha: f64, rand: f64) -> String {
    // Clamp to the valid Nash range; the slider maxes at ~1/3.
    let alpha = alpha.clamp(0.0, 1.0 / 3.0);

    let card = match parse_card(p1_card) {
        Some(c) => c,
        None => return err(&format!("Invalid card '{p1_card}'")),
    };

    // P1 acts at exactly two information sets: after P0 checks, or after P0 bets.
    //
    // Nash equilibrium (pkcore KuhnStrategy table):
    //   After P0 check → P1: J bluffs α, Q checks, K bets
    //   After P0 bet   → P1: J folds,   Q calls α, K calls
    //
    // The `alpha` parameter scales P1's bluff/call frequencies so the slider
    // moves the AI smoothly from "never bluffs" (α=0) to Nash (α=1/3).
    let (probs, action): (Vec<ProbEntry>, &str) = match history {
        "Check" => match card {
            KuhnCard::Jack => {
                let p_bet = alpha;
                (
                    vec![
                        ProbEntry { action: "Check".to_string(), prob: 1.0 - p_bet },
                        ProbEntry { action: "Bet".to_string(), prob: p_bet },
                    ],
                    if rand < p_bet { "Bet" } else { "Check" },
                )
            }
            KuhnCard::Queen => (
                vec![
                    ProbEntry { action: "Check".to_string(), prob: 1.0 },
                    ProbEntry { action: "Bet".to_string(), prob: 0.0 },
                ],
                "Check",
            ),
            KuhnCard::King => (
                vec![
                    ProbEntry { action: "Check".to_string(), prob: 0.0 },
                    ProbEntry { action: "Bet".to_string(), prob: 1.0 },
                ],
                "Bet",
            ),
        },

        "Bet" => match card {
            KuhnCard::Jack => (
                vec![
                    ProbEntry { action: "Fold".to_string(), prob: 1.0 },
                    ProbEntry { action: "Call".to_string(), prob: 0.0 },
                ],
                "Fold",
            ),
            KuhnCard::Queen => {
                let p_call = alpha;
                (
                    vec![
                        ProbEntry { action: "Fold".to_string(), prob: 1.0 - p_call },
                        ProbEntry { action: "Call".to_string(), prob: p_call },
                    ],
                    if rand < p_call { "Call" } else { "Fold" },
                )
            }
            KuhnCard::King => (
                vec![
                    ProbEntry { action: "Fold".to_string(), prob: 0.0 },
                    ProbEntry { action: "Call".to_string(), prob: 1.0 },
                ],
                "Call",
            ),
        },

        _ => return err(&format!("gto_action called at non-P1 history '{history}'")),
    };

    serde_json::to_string(&GtoResult {
        action: action.to_string(),
        probabilities: probs,
    })
    .unwrap_or_default()
}
