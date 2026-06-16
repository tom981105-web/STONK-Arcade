import { pickWeighted } from '../random.js';

export const slotSymbols = [
  { value: '🍒', weight: 28 },
  { value: '🔔', weight: 23 },
  { value: '🐂', weight: 18 },
  { value: '🐻', weight: 18 },
  { value: '💰', weight: 8 },
  { value: '💎', weight: 4 },
  { value: '👑', weight: 2 },
  { value: '7️⃣', weight: 1 }
];

const triplePayout = {
  '🍒': 3,
  '🔔': 4,
  '🐂': 5,
  '🐻': 5,
  '💰': 8,
  '💎': 12,
  '👑': 20,
  '7️⃣': 30
};

export function spinSlots(bet) {
  const reels = [
    pickWeighted(slotSymbols),
    pickWeighted(slotSymbols),
    pickWeighted(slotSymbols)
  ];

  let multiplier = 0;
  let label = '꽝';

  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = triplePayout[reels[0]] || 3;
    label = `${reels[0]} ${reels[1]} ${reels[2]} 잭팟`;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = 1.2;
    label = '2개 일치';
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;

  return {
    reels,
    multiplier,
    payout,
    profit,
    label
  };
}
