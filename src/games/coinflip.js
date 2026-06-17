import { randomInt } from '../random.js';

// 동전 던지기 — 앞/뒤 맞히면 1.9배. 빠르고 손맛 좋은 즉석 게임.
// (하우스 엣지: 1.9배 < 2배 → 장기적으로 천천히 빠짐)
export function playCoinFlip(bet, choice) {
  const side = randomInt(0, 1) === 0 ? 'HEADS' : 'TAILS';
  const win = side === choice;
  const multiplier = win ? 1.9 : 0;
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  const sideLabel = side === 'HEADS' ? '앞면' : '뒷면';
  return {
    bet,
    side,
    sideLabel,
    choice,
    multiplier,
    payout,
    profit,
    label: win ? `${sideLabel} 적중 · 1.9배` : `${sideLabel} · 빗나감`,
    outcome: profit > 0 ? 'win' : 'loss'
  };
}
