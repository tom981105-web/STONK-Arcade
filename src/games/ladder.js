import { randomInt, shuffle } from '../random.js';

const multipliers = [0, 0.25, 0.5, 1.0, 1.5, 2.2];

export function createLadderRound(bet, startLane) {
  const lanes = 6;
  const rows = 7;
  const links = [];
  for (let r = 0; r < rows; r += 1) {
    const used = new Set();
    const linkCount = randomInt(1, 2);
    for (let k = 0; k < linkCount; k += 1) {
      const lane = randomInt(0, lanes - 2);
      if (used.has(lane) || used.has(lane + 1)) continue;
      used.add(lane); used.add(lane + 1);
      links.push({ row: r, lane });
    }
  }
  const prizes = shuffle(multipliers);
  const path = tracePath(startLane, rows, links);
  const endLane = path[path.length - 1].lane;
  const multiplier = prizes[endLane];
  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  const label = `${startLane + 1}번 라인 → ${endLane + 1}번 보상 · ${multiplier}배`;
  return { bet, lanes, rows, links, prizes, path, startLane, endLane, multiplier, payout, profit, label, outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral' };
}

function tracePath(startLane, rows, links) {
  let lane = startLane;
  const path = [{ row: -1, lane }];
  for (let row = 0; row < rows; row += 1) {
    const right = links.find((link) => link.row === row && link.lane === lane);
    const left = links.find((link) => link.row === row && link.lane === lane - 1);
    if (right) lane += 1;
    else if (left) lane -= 1;
    path.push({ row, lane });
  }
  return path;
}
