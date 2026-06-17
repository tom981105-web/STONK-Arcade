import { randomInt } from '../random.js';

// 플링코 — 공이 8줄의 핀을 통과하며 좌/우로 튕겨 바닥 배율 칸에 떨어진다.
// 가장자리일수록 고배율(9배), 중앙일수록 저배율. 이항분포라 중앙이 잘 나와 하우스 엣지가 생긴다.
// 기대값 ≈ 0.84 (장기적으로 천천히 빠지지만 가장자리 9배의 한 방이 큰 손맛).
export const PLINKO_ROWS = 8;
export const PLINKO_MULTIPLIERS = [9, 3, 1.4, 0.5, 0.2, 0.5, 1.4, 3, 9];

export function dropPlinko(bet) {
  // 각 줄에서 0(좌)/1(우). 오른쪽으로 간 횟수 = 바닥 칸 인덱스(0..ROWS).
  const path = [];
  let bucket = 0;
  for (let i = 0; i < PLINKO_ROWS; i += 1) {
    const right = randomInt(0, 1);
    path.push(right);
    bucket += right;
  }
  const multiplier = PLINKO_MULTIPLIERS[bucket];
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  return {
    bet,
    path,
    bucket,
    multiplier,
    payout,
    profit,
    label: `${multiplier}배 칸 도착`,
    outcome: profit > 0 ? 'win' : 'loss'
  };
}
