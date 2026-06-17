// STONK Arcade — 휠 스핀 (Wheel)
// 가중치가 다른 배율 칸들로 구성된 휠. 기대값 < 1 로 하우스 엣지 적용.
import { pickWeighted } from '../random.js';

// m: 배율, w: 가중치 (기대값 = Σ(m*w)/Σw ≈ 0.91, 하우스 엣지 ~9%)
export const WHEEL_SEGMENTS = [
  { m: 0, w: 35 },
  { m: 0.5, w: 24 },
  { m: 1, w: 18 },
  { m: 1.5, w: 9 },
  { m: 2, w: 6 },
  { m: 3, w: 3 },
  { m: 5, w: 1.5 },
  { m: 10, w: 0.8 },
  { m: 20, w: 0.25 },
  { m: 50, w: 0.08 }
];

export function spinWheel(bet) {
  const multiplier = pickWeighted(WHEEL_SEGMENTS.map((s) => ({ value: s.m, weight: s.w })));
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  return {
    bet,
    multiplier,
    payout,
    profit,
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral',
    label: `${multiplier}배 칸 도착`,
    resultText: `휠 스핀 ${multiplier}배`
  };
}
