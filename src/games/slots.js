import { pickWeighted, randomFloat, randomInt, shuffle } from '../random.js';

export const slotSymbols = [
  { value: '🍒', weight: 34 },
  { value: '🔔', weight: 25 },
  { value: '🐂', weight: 18 },
  { value: '🐻', weight: 18 },
  { value: '💰', weight: 6 },
  { value: '💎', weight: 2.5 },
  { value: '👑', weight: 1.0 },
  { value: '7️⃣', weight: 0.5 }
];

const triplePayout = {
  '🍒': 2.4,
  '🔔': 3.0,
  '🐂': 3.5,
  '🐻': 3.5,
  '💰': 5.5,
  '💎': 8.5,
  '👑': 13,
  '7️⃣': 22
};

const values = slotSymbols.map((item) => item.value);

function pickSymbol(exclude = new Set()) {
  for (let i = 0; i < 60; i += 1) {
    const picked = pickWeighted(slotSymbols);
    if (!exclude.has(picked)) return picked;
  }
  return values.find((v) => !exclude.has(v)) || values[0];
}

function makeNoMatch() {
  const chosen = [];
  while (chosen.length < 3) chosen.push(pickSymbol(new Set(chosen)));
  return shuffle(chosen);
}

function makePair() {
  const pair = pickSymbol();
  const other = pickSymbol(new Set([pair]));
  return shuffle([pair, pair, other]);
}

function makeTriple(forceSeven = false) {
  const symbol = forceSeven ? '7️⃣' : pickSymbol();
  return [symbol, symbol, symbol];
}

export function spinSlots(bet) {
  // v3.0: 꽝을 충분히 넣고, 2개 일치도 0.9배라 대부분 소액 손실이다.
  // 대박은 남겼지만 전체 기대값은 v2보다 확실히 낮다.
  const roll = randomFloat();
  let reels;
  let resultType;

  if (roll < 0.55) {
    reels = makeNoMatch();
    resultType = 'MISS';
  } else if (roll < 0.90) {
    reels = makePair();
    resultType = 'PAIR';
  } else if (roll < 0.996) {
    reels = makeTriple(false);
    resultType = 'TRIPLE';
  } else {
    reels = makeTriple(true);
    resultType = 'JACKPOT';
  }

  let multiplier = 0;
  let label = '꽝';

  if (resultType === 'TRIPLE' || resultType === 'JACKPOT') {
    multiplier = triplePayout[reels[0]] || 2.4;
    label = `${reels[0]} ${reels[1]} ${reels[2]} 잭팟`;
  } else if (resultType === 'PAIR') {
    multiplier = 0.9;
    label = '2개 일치 · 소액 회수';
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;

  return {
    reels,
    bet,
    multiplier,
    payout,
    profit,
    label,
    resultType,
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral',
    spinId: `${Date.now().toString(36)}-${randomInt(100000, 999999).toString(36)}`
  };
}
