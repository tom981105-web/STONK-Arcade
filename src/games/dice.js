import { randomInt } from '../random.js';

export function playDice(bet, choice) {
  const d1 = randomInt(1, 6);
  const d2 = randomInt(1, 6);
  const sum = d1 + d2;
  let multiplier = 0;
  let label = '실패';

  if (choice === 'UNDER' && sum < 7) {
    multiplier = 1.72;
    label = '7 미만 성공';
  } else if (choice === 'OVER' && sum > 7) {
    multiplier = 1.72;
    label = '7 초과 성공';
  } else if (choice === 'SEVEN' && sum === 7) {
    multiplier = 4.2;
    label = '정확히 7 성공';
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;

  return { bet, d1, d2, sum, choice, multiplier, payout, profit, label, outcome: profit > 0 ? 'win' : 'loss' };
}
