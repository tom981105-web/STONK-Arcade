import { shuffle } from '../random.js';

export const LOTTERY_MAX_NUMBER = 30;
export const LOTTERY_PICK_COUNT = 6;

export function autoPickLotteryNumbers() {
  return shuffle(Array.from({ length: LOTTERY_MAX_NUMBER }, (_, i) => i + 1))
    .slice(0, LOTTERY_PICK_COUNT)
    .sort((a, b) => a - b);
}

export function playLottery(bet, selectedNumbers) {
  const selected = [...new Set((selectedNumbers || []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= LOTTERY_MAX_NUMBER)
    .sort((a, b) => a - b);

  if (selected.length !== LOTTERY_PICK_COUNT) {
    throw new Error(`복권 번호 ${LOTTERY_PICK_COUNT}개를 먼저 선택하세요.`);
  }

  const draw = autoPickLotteryNumbers();
  const matchNumbers = selected.filter((n) => draw.includes(n));
  const matches = matchNumbers.length;

  let multiplier = 0;
  let rank = '꽝';
  let label = `${matches}개 적중 · 손실`;

  if (matches === 2) {
    multiplier = 0.8;
    rank = '5등';
    label = '2개 적중 · 일부 회수';
  } else if (matches === 3) {
    multiplier = 1.8;
    rank = '4등';
    label = '3개 적중 · 소액 당첨';
  } else if (matches === 4) {
    multiplier = 7;
    rank = '3등';
    label = '4개 적중 · 큰 당첨';
  } else if (matches === 5) {
    multiplier = 35;
    rank = '2등';
    label = '5개 적중 · 초대박';
  } else if (matches === 6) {
    multiplier = 180;
    rank = '1등';
    label = '6개 적중 · 잭팟';
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  return {
    bet,
    selected,
    draw,
    matches,
    matchNumbers,
    rank,
    label,
    multiplier,
    payout,
    profit,
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral'
  };
}
