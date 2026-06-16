import { shuffle } from '../random.js';

const SIZE = 25;
const BOMBS = 3;

export const minesMultipliers = {
  1: 1.12,
  2: 1.28,
  3: 1.45,
  4: 1.65,
  5: 1.9,
  6: 2.2,
  7: 2.55,
  8: 2.95,
  9: 3.4,
  10: 4.0
};

export function multiplierForSafeCount(count) {
  if (count <= 0) return 1;
  if (minesMultipliers[count]) return minesMultipliers[count];
  return Number((4 + (count - 10) * 0.72 + Math.pow(count - 10, 1.18) * 0.08).toFixed(2));
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
      safeCount: game.safeCount
    };
  }

  game.safeCount += 1;
  const multiplier = multiplierForSafeCount(game.safeCount);
  return {
    status: 'safe',
    profit: Math.floor(game.bet * multiplier) - game.bet,
    payout: Math.floor(game.bet * multiplier),
    multiplier,
    safeCount: game.safeCount
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
    safeCount: game.safeCount
  };
}
