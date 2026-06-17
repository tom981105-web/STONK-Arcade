import { randomInt } from '../random.js';

export const cardLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function drawCard() {
  const value = randomInt(1, 13);
  return { value, label: cardLabels[value - 1] };
}

export function highlowMultiplier(streak) {
  const table = {
    1: 1.12,
    2: 1.34,
    3: 1.66,
    4: 2.08,
    5: 2.65,
    6: 3.35,
    7: 4.25
  };
  if (table[streak]) return table[streak];
  return Number((4.25 + (streak - 7) * 0.72 + Math.pow(streak - 7, 1.16) * 0.10).toFixed(2));
}

export function createHighlowGame(bet) {
  return {
    bet,
    current: drawCard(),
    previous: null,
    streak: 0,
    finished: false,
    createdAt: Date.now()
  };
}

export function guessHighlow(game, choice) {
  if (!game || game.finished) return { status: 'ignored' };
  const next = drawCard();
  const prev = game.current;
  const isHigh = next.value > prev.value;
  const isLow = next.value < prev.value;
  const success = choice === 'HIGH' ? isHigh : isLow;

  game.previous = prev;
  game.current = next;

  if (!success) {
    game.finished = true;
    return {
      status: 'fail',
      previous: prev,
      current: next,
      profit: -game.bet,
      payout: 0,
      streak: game.streak,
      multiplier: 0,
      outcome: 'loss'
    };
  }

  game.streak += 1;
  const multiplier = highlowMultiplier(game.streak);
  return {
    status: 'success',
    previous: prev,
    current: next,
    profit: Math.floor(game.bet * multiplier) - game.bet,
    payout: Math.floor(game.bet * multiplier),
    streak: game.streak,
    multiplier,
    outcome: 'win'
  };
}

export function cashoutHighlow(game) {
  if (!game || game.finished || game.streak <= 0) return null;
  const multiplier = highlowMultiplier(game.streak);
  const payout = Math.floor(game.bet * multiplier);
  const profit = payout - game.bet;
  game.finished = true;
  return {
    status: 'cashout',
    payout,
    profit,
    multiplier,
    streak: game.streak,
    outcome: profit > 0 ? 'win' : 'neutral'
  };
}
