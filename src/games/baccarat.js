// STONK Arcade — 바카라 (Baccarat)
// 정통 3rd-card 룰 기반. 즉시 딜 후 main.js 에서 한 장씩 공개 연출.
// 하우스 엣지: 플레이어 1.95배 / 뱅커 1.9배 / 타이 8배, 타이 시 P·B 베팅은 원금 반환.
import { randomInt, shuffle } from '../random.js';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♠', '♥', '♦', '♣'];

export const BACCARAT_PAYOUT = { PLAYER: 1.95, BANKER: 1.9, TIE: 8 };

function makeShoe() {
  const deck = [];
  for (let d = 0; d < 6; d += 1) {
    for (const suit of suits) for (const rank of ranks) deck.push({ rank, suit, label: `${rank}${suit}` });
  }
  return shuffle(deck);
}

// 바카라 카드 점수: A=1, 2~9=숫자, 10/J/Q/K=0
function cardPoint(card) {
  if (card.rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
  return Number(card.rank);
}
function handTotal(hand) {
  return hand.reduce((sum, c) => sum + cardPoint(c), 0) % 10;
}

// 정통 뱅커 3rd-card 룰: 뱅커 합계 + 플레이어의 세번째 카드 점수
function bankerDraws(bankerTotal, playerThirdPoint) {
  if (playerThirdPoint === null) return bankerTotal <= 5; // 플레이어가 스탠드(6~7)면 뱅커는 5이하 드로우
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2: return true;
    case 3: return playerThirdPoint !== 8;
    case 4: return playerThirdPoint >= 2 && playerThirdPoint <= 7;
    case 5: return playerThirdPoint >= 4 && playerThirdPoint <= 7;
    case 6: return playerThirdPoint === 6 || playerThirdPoint === 7;
    default: return false; // 7 이상 스탠드
  }
}

export function createBaccaratRound(bet, choice) {
  const shoe = makeShoe();
  const player = [shoe.pop(), shoe.pop()];
  const banker = [shoe.pop(), shoe.pop()];

  let playerTotal = handTotal(player);
  let bankerTotal = handTotal(banker);
  const natural = playerTotal >= 8 || bankerTotal >= 8;

  let playerThirdPoint = null;
  if (!natural) {
    if (playerTotal <= 5) {
      const c = shoe.pop();
      player.push(c);
      playerThirdPoint = cardPoint(c);
      playerTotal = handTotal(player);
    }
    if (bankerDraws(bankerTotal, playerThirdPoint)) {
      banker.push(shoe.pop());
      bankerTotal = handTotal(banker);
    }
  }

  const outcome = playerTotal > bankerTotal ? 'PLAYER' : bankerTotal > playerTotal ? 'BANKER' : 'TIE';

  let multiplier;
  if (choice === 'TIE') {
    multiplier = outcome === 'TIE' ? BACCARAT_PAYOUT.TIE : 0;
  } else if (outcome === 'TIE') {
    multiplier = 1; // P/B 베팅은 타이 시 원금 반환(푸시)
  } else {
    multiplier = outcome === choice ? BACCARAT_PAYOUT[choice] : 0;
  }

  const payout = Math.floor(bet * multiplier);
  const profit = payout - bet;
  const labelMap = { PLAYER: '플레이어', BANKER: '뱅커', TIE: '타이' };
  const win = profit > 0;
  const push = profit === 0 && multiplier === 1;

  return {
    bet,
    choice,
    player,
    banker,
    playerTotal,
    bankerTotal,
    outcome,
    natural,
    multiplier,
    payout,
    profit,
    label: `${labelMap[outcome]} 승${push ? ' · 원금 반환' : win ? ` · ${multiplier}배` : ''}`,
    resultText: `바카라 ${labelMap[outcome]}(${playerTotal}:${bankerTotal})${win ? ` · ${multiplier}배` : push ? ' · 푸시' : ''}`
  };
}
