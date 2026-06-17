import { randomInt, shuffle } from '../random.js';

const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suits = ['♠','♥','♦','♣'];

function makeDeck() {
  const deck = [];
  for (const suit of suits) for (const rank of ranks) deck.push({ rank, suit, label: `${rank}${suit}` });
  return shuffle(deck);
}

export function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') { total += 11; aces += 1; }
    else if (['J','Q','K'].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

export function createBlackjackGame(bet) {
  const deck = makeDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  return { bet, deck, player, dealer, finished: false, message: 'Hit 또는 Stand를 선택하세요.', createdAt: Date.now() };
}

export function hitBlackjack(game) {
  if (!game || game.finished) return { status: 'ignored' };
  game.player.push(game.deck.pop());
  const total = handValue(game.player);
  if (total > 21) {
    game.finished = true;
    return finish(game, 'Bust · 21 초과', 0);
  }
  return { status: 'continue', total };
}

export function standBlackjack(game) {
  if (!game || game.finished) return { status: 'ignored' };
  while (handValue(game.dealer) < 17 && game.deck.length) game.dealer.push(game.deck.pop());
  const playerTotal = handValue(game.player);
  const dealerTotal = handValue(game.dealer);

  if (dealerTotal > 21) return finish(game, `딜러 Bust · ${playerTotal} 승리`, 1.82);
  if (playerTotal > dealerTotal) return finish(game, `${playerTotal} vs ${dealerTotal} 승리`, 1.82);
  if (playerTotal === dealerTotal) return finish(game, `${playerTotal} vs ${dealerTotal} Push`, 1.0);
  return finish(game, `${playerTotal} vs ${dealerTotal} 패배`, 0);
}

function finish(game, label, multiplier) {
  game.finished = true;
  const natural = game.player.length === 2 && handValue(game.player) === 21;
  const finalMultiplier = multiplier > 1 && natural ? 2.15 : multiplier;
  const payout = Math.floor(game.bet * finalMultiplier);
  const profit = payout - game.bet;
  return {
    status: 'finished',
    bet: game.bet,
    label: natural && multiplier > 1 ? `${label} · 블랙잭 보너스` : label,
    multiplier: finalMultiplier,
    payout,
    profit,
    player: game.player,
    dealer: game.dealer,
    playerTotal: handValue(game.player),
    dealerTotal: handValue(game.dealer),
    outcome: profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral'
  };
}
