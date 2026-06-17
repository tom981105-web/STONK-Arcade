// STONK Arcade — 경마 (Horse Race)
// 4마리 중 1마리에 베팅. 우승은 가중치(인기마일수록 확률↑)로 결정.
// 배당(odds)은 공정 배당보다 낮게 설정해 하우스 엣지 적용.
import { pickWeighted, randomFloat } from '../random.js';

// w 합 = 92 (공정배당 = 92/w). odds 는 그보다 낮춰 엣지 부여.
export const HORSES = [
  { id: 0, name: '1번 흑마', emoji: '🐎', odds: 1.9, w: 42 },
  { id: 1, name: '2번 적토마', emoji: '🐴', odds: 3.2, w: 26 },
  { id: 2, name: '3번 백마', emoji: '🏇', odds: 5.5, w: 15 },
  { id: 3, name: '4번 천리마', emoji: '🦄', odds: 9.0, w: 9 }
];

export function runRace(bet, pick) {
  const winner = pickWeighted(HORSES.map((h) => ({ value: h.id, weight: h.w })));
  const won = winner === pick;
  const odds = HORSES[pick].odds;
  const multiplier = won ? odds : 0;
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;

  // 시각 연출용 각 말의 결승 도달 시간(ms): 우승마가 가장 빠름
  const durations = HORSES.map((h) => (h.id === winner ? 1500 + randomFloat() * 200 : 1750 + randomFloat() * 650));

  return {
    bet,
    pick,
    winner,
    multiplier,
    payout,
    profit,
    durations,
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral',
    label: `${HORSES[winner].name} 우승${won ? ` · ${odds}배 적중` : ''}`,
    resultText: `경마 ${HORSES[winner].name} 우승${won ? ` · ${odds}배` : ''}`
  };
}
