import { randomInt } from '../random.js';

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export function playRoulette(bet, choice) {
  const number = randomInt(0, 36);
  const color = number === 0 ? 'GREEN' : REDS.has(number) ? 'RED' : 'BLACK';
  const parity = number === 0 ? 'ZERO' : number % 2 === 0 ? 'EVEN' : 'ODD';

  let multiplier = 0;
  let label = '실패';

  if (choice === color) {
    multiplier = color === 'GREEN' ? 12 : 1.76;
    label = color === 'GREEN' ? '제로 성공' : `${color === 'RED' ? '레드' : '블랙'} 성공`;
  } else if (choice === parity) {
    multiplier = 1.76;
    label = `${choice === 'ODD' ? '홀수' : '짝수'} 성공`;
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;

  return { bet, number, color, parity, choice, multiplier, payout, profit, label, outcome: profit > 0 ? 'win' : 'loss' };
}
