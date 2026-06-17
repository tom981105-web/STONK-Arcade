import { shuffle } from '../random.js';

const SIZE = 25;
const BOMBS = 3;

// v3.0: 전체 기대값을 낮춰 돈이 계속 불어나는 문제를 완화했다.
export const minesMultipliers = {
  1: 1.05,
  2: 1.13,
  3: 1.23,
  4: 1.35,
  5: 1.50,
  6: 1.68,
  7: 1.90,
  8: 2.18,
  9: 2.50,
  10: 2.90,
  11: 3.35,
  12: 3.85
};

export function multiplierForSafeCount(count) {
  if (count <= 0) return 1;
  if (minesMultipliers[count]) return minesMultipliers[count];
  return Number((3.85 + (count - 12) * 0.44 + Math.pow(count - 12, 1.12) * 0.055).toFixed(2));
}

export function createMinesGame(bet) {
  const cells = Array.from({ length: SIZE }, (_, index) => index);
  const bombs = new Set(shuffle(cells).slice(0, BOMBS));
  return {
    bet,
    bombs,
    opened: new Set(),
    safeCount: 0,
    finished: false,
    busted: false,
    createdAt: Date.now()
  };
}

export function openCell(game, index) {
  if (!game || game.finished) return { status: 'ignored' };
  if (index < 0 || index >= SIZE) return { status: 'ignored' };
  if (game.opened.has(index)) return { status: 'ignored' };

  game.opened.add(index);

  if (game.bombs.has(index)) {
    game.finished = true;
    game.busted = true;
    return {
      status: 'bomb',
      profit: -game.bet,
      payout: 0,
      multiplier: 0,
      safeCount: game.safeCount,
      outcome: 'loss'
    };
  }

  game.safeCount += 1;
  const multiplier = multiplierForSafeCount(game.safeCount);
  return {
    status: 'safe',
    profit: Math.floor(game.bet * multiplier) - game.bet,
    payout: Math.floor(game.bet * multiplier),
    multiplier,
    safeCount: game.safeCount,
    outcome: 'win'
  };
}

export function cashoutMines(game) {
  if (!game || game.finished || game.safeCount <= 0) return null;
  const multiplier = multiplierForSafeCount(game.safeCount);
  const payout = Math.floor(game.bet * multiplier);
  const profit = payout - game.bet;
  game.finished = true;
  return {
    status: 'cashout',
    payout,
    profit,
    multiplier,
    safeCount: game.safeCount,
    outcome: profit > 0 ? 'win' : 'neutral'
  };
}
