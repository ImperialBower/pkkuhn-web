use pkcore::prelude::*;
use serde::Serialize;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

#[derive(Serialize)]
struct MatchupEntry {
    villain_hand: String,
    display: String,
    win_pct: f32,
    loss_pct: f32,
    draw_pct: f32,
}

#[derive(Serialize)]
struct Odds {
    wins: u64,
    losses: u64,
    draws: u64,
    win_pct: f32,
    loss_pct: f32,
    draw_pct: f32,
}

#[derive(Serialize)]
struct GtoResult {
    hero: String,
    villain_range: String,
    villain_combos_all: String,
    villain_combos_blocked: String,
    matchup_count: usize,
    matchups: Vec<MatchupEntry>,
    combined: Odds,
}

#[derive(Serialize)]
struct GtoError {
    error: String,
}

/// Analyze hero vs villain range preflop equity.
///
/// Returns a JSON string of `GtoResult` on success or `GtoError` on failure.
#[wasm_bindgen]
pub fn analyze_gto(hero: &str, villain_range: &str) -> String {
    let hero_two = match Two::from_str(hero) {
        Ok(t) => t,
        Err(e) => {
            return serde_json::to_string(&GtoError {
                error: format!("Invalid hero hand '{hero}': {e}"),
            })
            .unwrap_or_default()
        }
    };

    let combos = match Combos::from_str(villain_range) {
        Ok(c) => c,
        Err(e) => {
            return serde_json::to_string(&GtoError {
                error: format!("Invalid villain range '{villain_range}': {e}"),
            })
            .unwrap_or_default()
        }
    };

    let solver = Versus::new(hero_two, combos);
    let hups = match solver.hups_at_deal() {
        Ok(h) => h,
        Err(e) => {
            return serde_json::to_string(&GtoError {
                error: format!("Failed to compute matchups: {e}"),
            })
            .unwrap_or_default();
        }
    };

    if hups.is_empty() {
        return serde_json::to_string(&GtoError {
            error: "No matchups found. Check that your hand does not overlap the villain range."
                .to_string(),
        })
        .unwrap_or_default();
    }

    let mut matchups: Vec<MatchupEntry> = hups
        .iter()
        .map(|(hand, hup)| MatchupEntry {
            villain_hand: hand.to_string(),
            display: hup.to_string(),
            win_pct: hup.odds.win_percentage(),
            loss_pct: hup.odds.loss_percentage(),
            draw_pct: hup.odds.draw_percentage(),
        })
        .collect();
    matchups.sort_by(|a, b| {
        b.win_pct
            .partial_cmp(&a.win_pct)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let hup_refs: Vec<&HUPResult> = hups.values().collect();
    let combined = Versus::combined_odds_at_deal(&hup_refs);

    let result = GtoResult {
        hero: hero.to_string(),
        villain_range: villain_range.to_string(),
        villain_combos_all: solver.villain.combo_pairs().to_string(),
        villain_combos_blocked: solver.combo_pairs().to_string(),
        matchup_count: matchups.len(),
        matchups,
        combined: Odds {
            wins: combined.wins,
            losses: combined.losses,
            draws: combined.draws,
            win_pct: combined.win_percentage(),
            loss_pct: combined.loss_percentage(),
            draw_pct: combined.draw_percentage(),
        },
    };

    serde_json::to_string(&result).unwrap_or_default()
}
