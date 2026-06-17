// STONK Arcade — 크래시 (Crash)
// 배율이 1.00배부터 점점 오르다 무작위 시점에 폭락. 폭락 전에 '정산'을 눌러야 수익.
// 하우스 엣지: 3% 즉시 폭락 + 기대값 약 0.95(=5% 엣지) 분포.
import { randomFloat } from '../random.js';

export function rollCrashPoint() {
  if (randomFloat() < 0.03) return 1.0; // 즉시 폭락
  const u = randomFloat();
  let cp = 0.95 / (1 - u); // 기대값 하향(하우스 엣지)
  cp = Math.max(1.01, Math.min(cp, 50)); // 최대 50배 캡
  return Math.floor(cp * 100) / 100;
}

export function settleCrash(bet, cashoutMult, crashPoint) {
  const cashed = Boolean(cashoutMult) && cashoutMult <= crashPoint;
  const multiplier = cashed ? Math.floor(cashoutMult * 100) / 100 : 0;
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  return {
    bet,
    crashPoint,
    multiplier,
    payout,
    profit,
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral',
    label: cashed
      ? `${multiplier.toFixed(2)}배에서 정산 (폭락 ${crashPoint.toFixed(2)}배)`
      : `${crashPoint.toFixed(2)}배에서 폭락 · 미정산`,
    resultText: cashed
      ? `크래시 ${multiplier.toFixed(2)}배 정산`
      : `크래시 ${crashPoint.toFixed(2)}배 폭락(미정산)`
  };
}
