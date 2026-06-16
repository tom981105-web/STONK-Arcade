import { randomInt } from '../random.js';

export const cardLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function drawCard() {
  const value = randomInt(1, 13);
  return { value, label: cardLabels[value - 1] };
}

export function highlowMultiplier(streak) {
  const table = {
    1: 1.25,
    2: 1.55,
    3: 1.9,
    4: 2.4,
    5: 3.1,
    6: 4.0
  };
  if (table[streak]) return table[streak];
  return Number((4 + (streak - 6) * 1.1 + Math.pow(streak - 6, 1.22) * 0.18).toFixed(2));
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
      multiplier: 0
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
    multiplier
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
    streak: game.streak
  };
}
