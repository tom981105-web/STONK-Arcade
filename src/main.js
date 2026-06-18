import './styles.css';
import { isConfigured, ensureAnonymousUser, getCurrentUserOnce } from './firebase.js';
import { ROUTES, STORAGE_KEYS, BET, APP_VERSION } from './config.js';
import { addArcadeLog, loadRecentLogs } from './logs.js';
import { applyProfit, ensurePlayerExists, loadPlayer, loadStats, updateStats } from './wallet.js';
import { clampNumber, escapeHtml, formatWon, getStoredRoomCode, getUrlRoomCode, normalizeRoomCode, saveRoomCode, shortUid } from './utils.js';
import { randomInt } from './random.js';
import { cashoutMines, createMinesGame, openCell, multiplierForSafeCount } from './games/mines.js';
import { cashoutHighlow, createHighlowGame, guessHighlow } from './games/highlow.js';
import { spinSlots, slotSymbols } from './games/slots.js';
import { playDice } from './games/dice.js';
import { playRoulette } from './games/roulette.js';
import { LOTTERY_MAX_NUMBER, LOTTERY_PICK_COUNT, autoPickLotteryNumbers, playLottery } from './games/lottery.js';
import { createBlackjackGame, hitBlackjack, handValue, standBlackjack } from './games/blackjack.js';
import { createLadderRound } from './games/ladder.js';
import { sfx, isMuted, toggleMuted } from './sound.js';
import { isLocalDev, showHomeGate } from './homeGate.js';
import { playCoinFlip } from './games/coinflip.js';
import { dropPlinko, PLINKO_ROWS, PLINKO_MULTIPLIERS } from './games/plinko.js';
import { createBaccaratRound, BACCARAT_PAYOUT } from './games/baccarat.js';
import { rollCrashPoint, settleCrash } from './games/crash.js';
import { spinWheel, WHEEL_SEGMENTS } from './games/wheel.js';
import { runRace, HORSES } from './games/horse.js';

const reduceMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
})();

// 게임 카드 메타: 난이도 / 위험도 / 예상 최대 배율 / 플레이 시간 (오락실 머신 느낌)
const games = [
  { id: 'slots', icon: '🎰', name: '슬롯머신', category: '빠른 게임', difficulty: '쉬움', risk: '높음', reward: '최대 30배', time: '5초' },
  { id: 'lottery', icon: '🎟️', name: '복권', category: '빠른 게임', difficulty: '쉬움', risk: '매우 높음', reward: '최대 180배', time: '15초' },
  { id: 'dice', icon: '🎲', name: '주사위', category: '빠른 게임', difficulty: '쉬움', risk: '중간', reward: '최대 4.2배', time: '3초' },
  { id: 'coinflip', icon: '🪙', name: '동전 던지기', category: '빠른 게임', difficulty: '쉬움', risk: '50:50', reward: '1.9배', time: '2초' },
  { id: 'plinko', icon: '🔵', name: '플링코', category: '운빨 게임', difficulty: '쉬움', risk: '높음', reward: '최대 9배', time: '4초' },
  { id: 'mines', icon: '💣', name: '폭탄 피하기', category: '선택형 게임', difficulty: '보통', risk: '조절 가능', reward: '복리 상승', time: '20초+' },
  { id: 'highlow', icon: '🃏', name: '하이로우', category: '선택형 게임', difficulty: '보통', risk: '연승형', reward: '연승 배율', time: '20초+' },
  { id: 'baccarat', icon: '🎴', name: '바카라', category: 'VIP 테이블', difficulty: '전략', risk: '중간', reward: '플레이어 1.95 · 타이 8배', time: '12초' },
  { id: 'blackjack', icon: '♠️', name: '블랙잭', category: 'VIP 테이블', difficulty: '전략', risk: '중간', reward: '1.82배', time: '20초' },
  { id: 'roulette', icon: '🌀', name: '룰렛', category: '운빨 게임', difficulty: '쉬움', risk: '높음', reward: '최대 12배', time: '5초' },
  { id: 'ladder', icon: '🪜', name: '사다리', category: '운빨 게임', difficulty: '쉬움', risk: '중간', reward: '최대 2.2배', time: '5초' },
  { id: 'horse', icon: '🏇', name: '경마', category: '운빨 게임', difficulty: '쉬움', risk: '중간', reward: '최대 9배', time: '8초' },
  { id: 'crash', icon: '🚀', name: '크래시', category: '고배율 게임', difficulty: '타이밍', risk: '매우 높음', reward: '최대 50배', time: '10초' },
  { id: 'wheel', icon: '🎡', name: '휠 스핀', category: '고배율 게임', difficulty: '쉬움', risk: '높음', reward: '최대 50배', time: '5초' }
];

const state = {
  roomCode: getUrlRoomCode() || getStoredRoomCode(STORAGE_KEYS) || 'MAIN', // 단일 방 운영: 항상 고정 방
  user: null,
  player: null,
  stats: { plays: 0, profit: 0, wins: 0, losses: 0 },
  activeGame: 'slots',
  mines: null,
  highlow: null,
  blackjack: null,
  slotResult: null,
  slotSpinning: false,
  lotteryResult: null,
  lotterySelected: [],
  lotteryRevealStep: 0,
  lotteryScratching: false,
  diceResult: null,
  coinResult: null,
  coinFlipping: false,
  plinkoResult: null,
  plinkoDropping: false,
  rouletteResult: null,
  baccaratResult: null,
  baccaratRevealing: false,
  baccaratRevealStep: 0,
  ladderResult: null,
  ladderAnimating: false,
  crashActive: false,
  crashMultiplier: 1,
  crashCashed: false,
  crashPoint: 0,
  crashBet: 0,
  crashResult: null,
  crashTimer: null,
  wheelResult: null,
  wheelSpinning: false,
  wheelStrip: null,
  wheelLandIndex: 0,
  horseResult: null,
  horseRacing: false,
  logs: [],
  busy: false,
  notice: '',
  resultFlash: ''
};

const app = document.querySelector('#app');
// PHASE 3: 방 코드 없이 직접 접속하면 STONK Home 으로 안내(배포 환경). 개발 환경은 자체 입장 화면 유지.
if (!state.roomCode && !isLocalDev()) {
  showHomeGate({ message: 'STONK Home에서 로그인 후 방을 선택해 Arcade에 입장해 주세요.' });
} else {
  render();
  if (state.roomCode) boot(state.roomCode);
}

async function boot(roomCode) {
  try {
    if (!isConfigured) {
      state.notice = 'Firebase 설정이 비어 있습니다. src/firebase.js 설정을 확인하세요.';
      render();
      return;
    }
    state.busy = true;
    state.notice = 'Arcade 입장 중...';
    state.roomCode = normalizeRoomCode(roomCode);
    saveRoomCode(state.roomCode, STORAGE_KEYS);
    render();

    // PHASE 3: 기존 세션(Home/Battle 로그인) 우선. 세션이 없으면 Home 으로 안내(배포),
    // 개발 환경에서만 익명 로그인으로 테스트를 허용한다.
    state.user = await getCurrentUserOnce();
    if (!state.user) {
      if (isLocalDev()) {
        state.user = await ensureAnonymousUser();
      } else {
        state.busy = false;
        showHomeGate({ roomCode: state.roomCode, message: 'STONK Home에서 로그인 후 Arcade에 입장해 주세요.' });
        return;
      }
    }
    await ensurePlayerExists(state.roomCode, state.user.uid);
    state.player = await loadPlayer(state.roomCode, state.user.uid);
    state.stats = await loadStats(state.roomCode, state.user.uid);
    state.logs = await loadRecentLogs(state.roomCode, 20);
    state.notice = '입장 완료. v3.1.1은 입장 1회 로드 + 게임 정산 1회 쓰기 방식으로 Firebase 사용량을 줄입니다.';
  } catch (error) {
    console.error(error);
    state.notice = error.message || '입장 중 오류가 발생했습니다.';
  } finally {
    state.busy = false;
    render();
  }
}

function render() {
  app.innerHTML = `
    <div class="shell ${state.resultFlash ? `flash-${state.resultFlash}` : ''}">
      <header class="topbar">
        <div>
          <div class="eyebrow">STONK ARCADE · v${APP_VERSION}</div>
          <h1>STONK Arcade</h1>
          <p>Battle/Board와 같은 시장 터미널 결로 정리한 Arcade UI. 손맛은 올리고 평균 수익률은 낮췄습니다.</p>
        </div>
        <nav class="nav">
          ${navLink('홈', ROUTES.home)}
          ${navLink('주식시장', ROUTES.battle)}
          ${navLink('주식소식', ROUTES.pulse)}
          ${navLink('주식정보', ROUTES.wiki)}
          ${navLink('가챠', ROUTES.gacha)}
          <button class="sound-toggle ${isMuted() ? 'is-muted' : ''}" type="button" data-sound-toggle aria-label="소리 켜기/끄기" title="소리 ${isMuted() ? '꺼짐' : '켜짐'}">${isMuted() ? '🔇' : '🔊'}</button>
        </nav>
      </header>
      ${state.player ? renderArcade() : renderGate()}
    </div>
  `;
  bindCommonEvents();
  if (state.player) bindGameEvents();
}

function navLink(label, baseUrl) {
  const room = state.roomCode ? `?room=${encodeURIComponent(state.roomCode)}` : '';
  return `<a class="nav-btn" href="${baseUrl}${room}">${label}</a>`;
}

function renderGate() {
  return `
    <main class="gate card glow">
      <div class="gate-copy">
        <span class="tag">방 코드 입장</span>
        <h2>Battle에서 쓰던 방 코드로 Arcade에 들어가세요.</h2>
        <p>같은 방의 <b>players/{uid}/cash</b>와 연결됩니다. 결과가 확정될 때만 Firebase에 정산합니다.</p>
      </div>
      <form id="roomForm" class="room-form">
        <label>방 코드</label>
        <input id="roomInput" value="${escapeHtml(state.roomCode)}" placeholder="예: ABC123" autocomplete="off" />
        <button ${state.busy ? 'disabled' : ''}>Arcade 입장</button>
      </form>
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
    </main>`;
}

function renderArcade() {
  return `
    <main class="layout">
      <aside class="panel card">
        <div class="panel-title">내 정보</div>
        <div class="stat"><span>방 코드</span><strong>${escapeHtml(state.roomCode)}</strong></div>
        <div class="stat"><span>UID</span><strong>${shortUid(state.user?.uid)}</strong></div>
        <div class="cash-box"><span>보유금</span><strong>${formatWon(state.player.cash)}</strong></div>
        <div class="stat"><span>누적 손익</span><strong class="${state.stats.profit >= 0 ? 'plus' : 'minus'}">${state.stats.profit >= 0 ? '+' : ''}${formatWon(state.stats.profit)}</strong></div>
        <div class="stat"><span>플레이</span><strong>${Number(state.stats.plays || 0).toLocaleString('ko-KR')}회</strong></div>
        <div class="stat"><span>승 / 패</span><strong>${Number(state.stats.wins || 0)} / ${Number(state.stats.losses || 0)}</strong></div>
        <div class="market-status"><span>마켓 모드</span><b>아케이드 리스크</b></div><div class="tip danger">밸런스: 모든 게임의 기대값을 낮춰, 장기적으로 돈이 조금씩 빠지도록 조정했습니다.</div>
      </aside>
      <section class="stage card glow">
        ${renderGameSelector()}
        ${renderBetBar()}
        ${renderCurrentGame()}
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
      </section>
      <aside class="logs card">
        <div class="panel-title">최근 결과</div>
        <div class="log-list">${state.logs.length ? state.logs.map(renderLog).join('') : '<div class="empty">아직 Arcade 기록이 없습니다.</div>'}</div>
      </aside>
    </main>`;
}

function renderGameSelector() {
  const categories = [...new Set(games.map((g) => g.category))];
  return `<div class="game-categories">${categories.map((cat) => `
    <div class="category-block">
      <div class="category-title">${cat}</div>
      <div class="game-tabs">${games.filter((g) => g.category === cat).map((g) => tabButton(g)).join('')}</div>
    </div>`).join('')}</div>`;
}

function tabButton(game) {
  const disabled = anyAnimation() ? 'disabled' : '';
  const active = state.activeGame === game.id ? 'active' : '';
  return `<button class="tab arcade-machine ${active}" data-tab="${game.id}" ${disabled}>
      <span class="machine-marquee">${game.name}</span>
      <span class="machine-screen">${game.icon}</span>
      <span class="machine-meta">
        <em class="meta-chip">난이도 ${game.difficulty}</em>
        <em class="meta-chip risk">위험 ${game.risk}</em>
      </span>
      <span class="machine-meta sub">
        <em class="meta-chip reward">${game.reward}</em>
        <em class="meta-chip">⏱ ${game.time}</em>
      </span>
      <span class="machine-coin">${active ? '플레이 중' : '코인 투입'}</span>
    </button>`;
}

function renderBetBar() {
  const max = getMaxBet();
  const suggested = Math.min(1000000, max);
  return `
    <div class="betbar">
      <div>
        <label for="betInput">베팅금</label>
        <input id="betInput" type="number" min="${BET.min}" max="${max}" step="1000" value="${suggested}" ${anyAnimation() ? 'disabled' : ''} />
      </div>
      <button class="small" data-bet="100000" ${anyAnimation() ? 'disabled' : ''}>10만</button>
      <button class="small" data-bet="1000000" ${anyAnimation() ? 'disabled' : ''}>100만</button>
      <button class="small" data-bet="5000000" ${anyAnimation() ? 'disabled' : ''}>500만</button>
      <button class="small" data-bet="ratio10" ${anyAnimation() ? 'disabled' : ''}>10%</button>
      <button class="small" data-bet="max" ${anyAnimation() ? 'disabled' : ''}>최대</button>
    </div>`;
}

function renderCurrentGame() {
  if (state.activeGame === 'mines') return renderMines();
  if (state.activeGame === 'highlow') return renderHighlow();
  if (state.activeGame === 'slots') return renderSlots();
  if (state.activeGame === 'dice') return renderDice();
  if (state.activeGame === 'coinflip') return renderCoinFlip();
  if (state.activeGame === 'plinko') return renderPlinko();
  if (state.activeGame === 'roulette') return renderRoulette();
  if (state.activeGame === 'lottery') return renderLottery();
  if (state.activeGame === 'blackjack') return renderBlackjack();
  if (state.activeGame === 'baccarat') return renderBaccarat();
  if (state.activeGame === 'crash') return renderCrash();
  if (state.activeGame === 'wheel') return renderWheel();
  if (state.activeGame === 'horse') return renderHorse();
  return renderLadder();
}

function renderMines() {
  const game = state.mines;
  const safe = game?.safeCount || 0;
  const multiplier = multiplierForSafeCount(safe);
  return `
    <div class="game-head"><div><h2>💣 폭탄 피하기</h2><p>안전 칸을 열수록 배율 상승. v3에서는 초반 배율을 낮춰 리스크가 더 커졌습니다.</p></div>
      <div class="game-actions"><button id="startMines" ${state.busy ? 'disabled' : ''}>새 판 시작</button><button id="cashoutMines" ${!game || game.finished || safe <= 0 || state.busy ? 'disabled' : ''}>회수 · ${multiplier.toFixed(2)}배</button></div></div>
    <div class="mines-board">${Array.from({ length: 25 }, (_, i) => renderMineCell(game, i)).join('')}</div>`;
}
function renderMineCell(game, index) {
  const opened = game?.opened?.has(index);
  const isBomb = game?.bombs?.has(index);
  let content = '';
  let cls = 'mine-cell';
  if (opened && isBomb) { cls += ' bomb'; content = '💥'; }
  else if (opened) { cls += ' safe'; content = '◆'; }
  else if (game?.finished && isBomb) { cls += ' reveal'; content = '💣'; }
  return `<button class="${cls}" data-cell="${index}" ${!game || game.finished || opened || state.busy ? 'disabled' : ''}>${content}</button>`;
}

function renderHighlow() {
  const game = state.highlow;
  const current = game?.current?.label || '?';
  const streak = game?.streak || 0;
  return `
    <div class="game-head"><div><h2>🃏 하이로우</h2><p>같은 숫자는 실패. 연승 배율을 낮춰 한 방 수익이 덜 터지게 조정했습니다.</p></div>
      <div class="game-actions"><button id="startHighlow" ${state.busy ? 'disabled' : ''}>새 판 시작</button><button id="cashoutHighlow" ${!game || game.finished || streak <= 0 || state.busy ? 'disabled' : ''}>수익 회수</button></div></div>
    <div class="card-game"><div class="playing-card">${escapeHtml(current)}</div><div class="streak">연승 ${streak}회</div><div class="choice-row"><button id="guessLow" ${!game || game.finished || state.busy ? 'disabled' : ''}>낮게</button><button id="guessHigh" ${!game || game.finished || state.busy ? 'disabled' : ''}>높게</button></div></div>`;
}

function renderSlots() {
  const result = state.slotResult;
  const reels = result?.reels || ['❔', '❔', '❔'];
  return `
    <div class="game-head"><div><h2>🎰 슬롯머신</h2><p>릴 정지 연출 강화. 꽝 55%, 2개 일치는 0.9배라 대부분 소액 손실입니다.</p></div><div class="game-actions"><button id="spinSlots" ${state.busy || state.slotSpinning ? 'disabled' : ''}>${state.slotSpinning ? '돌아가는 중...' : '돌리기'}</button></div></div>
    <div class="slots ${state.slotSpinning ? 'spinning' : ''}" id="slotReels"><div class="slot-reel">${reels[0]}</div><div class="slot-reel">${reels[1]}</div><div class="slot-reel">${reels[2]}</div></div>
    <div class="slot-note">v3 확률: 꽝 55% / 2개 일치 35% / 3개 일치 9.6% / 7️⃣ 잭팟 0.4%</div>`;
}

function renderDice() {
  const r = state.diceResult;
  return `<div class="game-head"><div><h2>🎲 주사위 배틀</h2><p>배율 하향: 7 미만/초과 1.72배, 정확히 7은 4.2배.</p></div></div>
    <div class="mini-game-box"><div class="dice-row"><div class="dice">${r ? r.d1 : '?'}</div><div class="dice">${r ? r.d2 : '?'}</div></div><div class="result-line">${r ? `합계 ${r.sum} · ${escapeHtml(r.label)} · ${r.multiplier ? `${r.multiplier}배` : '손실'}` : '선택하면 바로 굴립니다.'}</div><div class="choice-row wrap"><button data-dice="UNDER" ${state.busy ? 'disabled' : ''}>7 미만 · 1.72배</button><button data-dice="SEVEN" ${state.busy ? 'disabled' : ''}>정확히 7 · 4.2배</button><button data-dice="OVER" ${state.busy ? 'disabled' : ''}>7 초과 · 1.72배</button></div></div>`;
}

function renderCoinFlip() {
  const r = state.coinResult;
  const flipping = state.coinFlipping;
  const face = flipping ? '' : r ? (r.side === 'HEADS' ? '앞' : '뒤') : 'STONK';
  return `<div class="game-head"><div><h2>🪙 동전 던지기</h2><p>앞/뒤를 고르면 동전이 회전합니다. 적중 시 1.9배. 가장 빠른 한 방.</p></div></div>
    <div class="mini-game-box">
      <div class="coin-stage"><div class="coin ${flipping ? 'flipping' : ''} ${r && !flipping ? (r.side === 'HEADS' ? 'show-heads' : 'show-tails') : ''}"><span class="coin-face">${escapeHtml(face)}</span></div></div>
      <div class="result-line">${r && !flipping ? `${escapeHtml(r.sideLabel)} · ${escapeHtml(r.label)}` : flipping ? '동전이 회전 중...' : '앞 또는 뒤를 선택하세요.'}</div>
      <div class="choice-row wrap"><button data-coin="HEADS" ${state.busy || flipping ? 'disabled' : ''}>🪙 앞면 · 1.9배</button><button data-coin="TAILS" ${state.busy || flipping ? 'disabled' : ''}>🪙 뒷면 · 1.9배</button></div>
    </div>`;
}

function renderPlinko() {
  const r = state.plinkoResult;
  const buckets = PLINKO_MULTIPLIERS.map((m, i) => {
    const hot = m >= 3 ? 'hot' : m >= 1 ? 'mid' : 'cold';
    const hit = r && !state.plinkoDropping && r.bucket === i ? 'hit' : '';
    return `<span class="plinko-bucket ${hot} ${hit}" data-bucket="${i}">${m}x</span>`;
  }).join('');
  // 핀 보드(시각용): 줄마다 핀 개수 증가
  const pegs = Array.from({ length: PLINKO_ROWS }, (_, row) =>
    `<div class="plinko-pegrow">${Array.from({ length: row + 2 }, () => '<i class="peg"></i>').join('')}</div>`
  ).join('');
  return `<div class="game-head"><div><h2>🔵 플링코</h2><p>공을 떨어뜨려 8줄 핀을 통과! 가장자리 칸일수록 고배율(최대 9배).</p></div>
      <div class="game-actions"><button id="dropPlinko" ${state.busy || state.plinkoDropping ? 'disabled' : ''}>${state.plinkoDropping ? '낙하 중...' : '공 떨어뜨리기'}</button></div></div>
    <div class="plinko-board" id="plinkoBoard">
      <div class="plinko-ball" id="plinkoBall" hidden></div>
      ${pegs}
      <div class="plinko-buckets">${buckets}</div>
    </div>
    <div class="result-line">${r && !state.plinkoDropping ? `${r.multiplier}배 칸 · ${r.profit >= 0 ? '+' : ''}${formatWon(r.profit)}` : '공을 떨어뜨리면 핀을 튕기며 내려갑니다.'}</div>`;
}

function renderRoulette() {
  const r = state.rouletteResult;
  const colorText = r ? (r.color === 'RED' ? '레드' : r.color === 'BLACK' ? '블랙' : '제로') : '-';
  const parityText = r ? (r.parity === 'ODD' ? '홀수' : r.parity === 'EVEN' ? '짝수' : '제로') : '-';
  return `<div class="game-head"><div><h2>🌀 룰렛</h2><p>레드/블랙/홀짝 1.76배, 제로 12배로 하향했습니다.</p></div></div>
    <div class="mini-game-box"><div class="roulette-ball ${r?.color?.toLowerCase() || ''}">${r ? r.number : '?'}</div><div class="result-line">${r ? `${colorText} · ${parityText} · ${escapeHtml(r.label)} ${r.multiplier ? `· ${r.multiplier}배` : ''}` : '선택하면 룰렛이 돌아갑니다.'}</div><div class="choice-row wrap"><button data-roulette="RED" ${state.busy ? 'disabled' : ''}>레드</button><button data-roulette="BLACK" ${state.busy ? 'disabled' : ''}>블랙</button><button data-roulette="ODD" ${state.busy ? 'disabled' : ''}>홀수</button><button data-roulette="EVEN" ${state.busy ? 'disabled' : ''}>짝수</button><button data-roulette="GREEN" ${state.busy ? 'disabled' : ''}>제로</button></div></div>`;
}

function renderLottery() {
  const r = state.lotteryResult;
  const selected = state.lotterySelected || [];
  const revealedDraw = r ? r.draw.slice(0, state.lotteryRevealStep || 0) : [];
  const canScratch = selected.length === LOTTERY_PICK_COUNT && !state.busy && !state.lotteryScratching;
  return `<div class="game-head"><div><h2>🎟️ 복권</h2><p>번호 6개를 직접 고르고, 추첨 번호가 하나씩 공개됩니다. 버튼만 누르는 자동 복권 느낌을 제거했습니다.</p></div><div class="game-actions"><button id="autoLottery" ${state.busy || state.lotteryScratching ? 'disabled' : ''}>자동 선택</button><button id="clearLottery" ${state.busy || state.lotteryScratching ? 'disabled' : ''}>초기화</button><button id="scratchLottery" ${!canScratch ? 'disabled' : ''}>${state.lotteryScratching ? '추첨 중...' : '추첨 시작'}</button></div></div>
    <div class="lottery-terminal ${state.lotteryScratching ? 'scratching' : ''}">
      <div class="lottery-panel">
        <div class="ticket-title">내 티켓 · ${selected.length}/${LOTTERY_PICK_COUNT}</div>
        <div class="lottery-picks">${Array.from({ length: LOTTERY_PICK_COUNT }, (_, i) => `<span class="pick-ball ${selected[i] ? 'filled' : ''}">${selected[i] || '-'}</span>`).join('')}</div>
        <div class="number-grid">${Array.from({ length: LOTTERY_MAX_NUMBER }, (_, i) => i + 1).map((n) => `<button class="number-ball ${selected.includes(n) ? 'selected' : ''}" data-lottery-num="${n}" ${state.busy || state.lotteryScratching ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      </div>
      <div class="draw-panel">
        <div class="ticket-title">추첨 보드</div>
        <div class="ticket-numbers draw-numbers">${Array.from({ length: LOTTERY_PICK_COUNT }, (_, i) => { const n = revealedDraw[i]; const hit = n && r?.selected?.includes(n); return `<span class="${hit ? 'hit' : ''}">${n || '?'}</span>`; }).join('')}</div>
        <div class="result-line">${r && state.lotteryRevealStep >= LOTTERY_PICK_COUNT ? `${escapeHtml(r.rank)} · ${escapeHtml(r.label)} · ${r.matches}개 적중 ${r.multiplier ? `· ${r.multiplier}배` : ''}` : state.lotteryScratching ? '추첨 번호 공개 중...' : '번호 6개를 선택한 뒤 추첨을 시작하세요.'}</div>
        <div class="lottery-odds">2개 0.8배 / 3개 1.8배 / 4개 7배 / 5개 35배 / 6개 180배</div>
      </div>
    </div>`;
}

function renderBlackjack() {
  const g = state.blackjack;
  const p = g?.player || [];
  const d = g?.dealer || [];
  const hideDealer = g && !g.finished;
  return `<div class="game-head"><div><h2>♠️ 블랙잭</h2><p>카드 받기 / 멈추기만 있는 단순 버전. 승리 1.82배, 무승부는 원금 반환.</p></div><div class="game-actions"><button id="startBlackjack" ${state.busy ? 'disabled' : ''}>새 판 시작</button></div></div>
    <div class="blackjack-table">
      <div class="hand"><b>딜러 ${g ? `· ${hideDealer ? '?' : handValue(d)}` : ''}</b><div class="cards">${d.length ? d.map((c, i) => `<div class="mini-card ${i===1 && hideDealer ? 'back' : ''}">${i===1 && hideDealer ? '?' : escapeHtml(c.label)}</div>`).join('') : '<div class="mini-card empty-card">?</div>'}</div></div>
      <div class="hand"><b>플레이어 ${g ? `· ${handValue(p)}` : ''}</b><div class="cards">${p.length ? p.map((c) => `<div class="mini-card">${escapeHtml(c.label)}</div>`).join('') : '<div class="mini-card empty-card">?</div>'}</div></div>
      <div class="choice-row wrap"><button id="hitBlackjack" ${!g || g.finished || state.busy ? 'disabled' : ''}>한 장 더</button><button id="standBlackjack" ${!g || g.finished || state.busy ? 'disabled' : ''}>멈추기</button></div>
    </div>`;
}

function renderBaccarat() {
  const r = state.baccaratResult;
  const revealing = state.baccaratRevealing;
  // 딜 순서: P1, B1, P2, B2, (P3), (B3)
  const seq = [];
  if (r) {
    seq.push(['P', 0], ['B', 0], ['P', 1], ['B', 1]);
    if (r.player[2]) seq.push(['P', 2]);
    if (r.banker[2]) seq.push(['B', 2]);
  }
  const revealed = r ? (revealing ? state.baccaratRevealStep || 0 : seq.length) : 0;
  const isVisible = (side, idx) => {
    const pos = seq.findIndex(([s, i]) => s === side && i === idx);
    return pos >= 0 && pos < revealed;
  };
  const fullyRevealed = r && revealed >= seq.length;
  const cardsFor = (side, hand) => (hand || []).map((c, i) =>
    isVisible(side, i)
      ? `<div class="mini-card bacc-card in">${escapeHtml(c.label)}</div>`
      : `<div class="mini-card back bacc-card">★</div>`).join('');
  const choice = r?.choice;
  const win = (side) => fullyRevealed && r.outcome === side;
  const choiceBtn = (key, label, mult) =>
    `<button data-baccarat="${key}" class="bacc-bet ${choice === key ? 'picked' : ''}" ${state.busy || revealing ? 'disabled' : ''}>${label}<em>${mult}배</em></button>`;
  return `<div class="game-head"><div><h2>🎴 바카라</h2><p>플레이어·뱅커·타이에 베팅. 정통 3rd-card 룰. 플레이어 1.95배 / 뱅커 1.9배 / 타이 8배(타이 시 P·B는 원금 반환).</p></div></div>
    <div class="baccarat-table ${revealing ? 'dealing' : ''}">
      <div class="bacc-felt">
        <div class="bacc-side bacc-player ${win('PLAYER') ? 'is-winner' : ''}">
          <div class="bacc-label">플레이어</div>
          <div class="cards">${r ? cardsFor('P', r.player) : '<div class="mini-card empty-card">?</div><div class="mini-card empty-card">?</div>'}</div>
          <div class="bacc-total">${fullyRevealed ? r.playerTotal : '–'}</div>
        </div>
        <div class="bacc-versus">VS</div>
        <div class="bacc-side bacc-banker ${win('BANKER') ? 'is-winner' : ''}">
          <div class="bacc-label">뱅커</div>
          <div class="cards">${r ? cardsFor('B', r.banker) : '<div class="mini-card empty-card">?</div><div class="mini-card empty-card">?</div>'}</div>
          <div class="bacc-total">${fullyRevealed ? r.bankerTotal : '–'}</div>
        </div>
      </div>
      <div class="result-line">${fullyRevealed ? `${escapeHtml(r.label)}${r.natural ? ' · 내추럴' : ''}` : revealing ? '카드를 펼치는 중...' : '베팅처를 선택하면 딜이 시작됩니다.'}</div>
      <div class="choice-row wrap bacc-bets">
        ${choiceBtn('PLAYER', '플레이어', BACCARAT_PAYOUT.PLAYER)}
        ${choiceBtn('TIE', '타이', BACCARAT_PAYOUT.TIE)}
        ${choiceBtn('BANKER', '뱅커', BACCARAT_PAYOUT.BANKER)}
      </div>
    </div>`;
}

function renderLadder() {
  const r = state.ladderResult;
  return `<div class="game-head"><div><h2>🪜 사다리 게임</h2><p>시작 라인을 고르면 사다리를 타고 내려가 보상 배율에 도착합니다. 보상은 매 판 무작위로 배치됩니다(0~2.2배).</p></div></div>
    <div class="ladder-box ${state.ladderAnimating ? 'ladder-running' : ''}">
      ${renderLadderSvg(r)}
      <div class="choice-row wrap ladder-lanes">${Array.from({ length: 6 }, (_, i) => `<button data-ladder="${i}" class="${r && r.startLane === i ? 'picked' : ''}" ${state.busy || state.ladderAnimating ? 'disabled' : ''}>${i + 1}번</button>`).join('')}</div>
      <div class="result-line">${r ? `${escapeHtml(r.label)} · ${formatWon(r.payout)} 지급` : '시작 라인(1~6번)을 선택하면 사다리가 그려집니다.'}</div>
    </div>`;
}

// 사다리를 SVG 로 명확하게 그린다: 세로 레일 + 가로 발판 + 골드 경로 + 도착 보상 강조
function renderLadderSvg(r) {
  const lanes = 6;
  const rows = 7;
  const W = 380;
  const H = 250;
  const padX = 26;
  const padTop = 36;
  const padBot = 50;
  const innerW = W - padX * 2;
  const step = innerW / (lanes - 1);
  const x = (i) => padX + i * step;
  const yTop = padTop;
  const yBot = H - padBot;
  const rowH = (yBot - yTop) / rows;
  const rungY = (row) => yTop + (row + 0.5) * rowH;
  const basePrizes = [0, 0.25, 0.5, 1, 1.5, 2.2];
  const prizes = r ? r.prizes : basePrizes;

  const rails = Array.from({ length: lanes }, (_, i) =>
    `<line x1="${x(i)}" y1="${yTop}" x2="${x(i)}" y2="${yBot}" class="lad-rail" />`).join('');
  const nums = Array.from({ length: lanes }, (_, i) =>
    `<text x="${x(i)}" y="${yTop - 13}" class="lad-num ${r && r.startLane === i ? 'start' : ''}">${i + 1}</text>`).join('');
  const rungs = (r ? r.links : []).map((l) =>
    `<line x1="${x(l.lane)}" y1="${rungY(l.row)}" x2="${x(l.lane + 1)}" y2="${rungY(l.row)}" class="lad-rung" />`).join('');
  const prizeLabels = prizes.map((m, i) =>
    `<text x="${x(i)}" y="${H - 16}" class="lad-prize ${r && r.endLane === i ? 'win' : ''}">${m}x</text>`).join('');

  let pathEl = '';
  let ball = '';
  if (r) {
    const pts = [];
    let lane = r.path[0].lane;
    pts.push([x(lane), yTop]);
    for (let row = 0; row < rows; row += 1) {
      const ry = rungY(row);
      pts.push([x(lane), ry]);
      const next = r.path[row + 1].lane;
      if (next !== lane) { pts.push([x(next), ry]); lane = next; }
    }
    pts.push([x(lane), yBot]);
    pathEl = `<polyline class="lad-path" points="${pts.map((p) => p.join(',')).join(' ')}" />`;
    ball = `<circle class="lad-ball" cx="${x(r.endLane)}" cy="${yBot}" r="6" />`;
  }

  return `<svg class="ladder-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="사다리">
    ${rails}${nums}${rungs}${pathEl}${ball}${prizeLabels}
  </svg>`;
}

function renderCrash() {
  const active = state.crashActive;
  const r = state.crashResult;
  const num = active ? state.crashMultiplier.toFixed(2) : r ? (r.multiplier > 0 ? r.multiplier.toFixed(2) : r.crashPoint.toFixed(2)) : '1.00';
  const cls = active ? 'running' : r ? (r.profit > 0 ? 'cashed' : 'crashed') : '';
  return `<div class="game-head"><div><h2>🚀 크래시</h2><p>배율이 1.00배부터 점점 오르다 무작위로 폭락합니다. 폭락 전에 '정산'을 눌러야 수익! (3% 확률 즉시 폭락)</p></div></div>
    <div class="crash-box ${cls}">
      <div class="crash-display"><span id="crashNum">${num}</span><span class="crash-unit">배</span></div>
      <div class="result-line">${active ? '🔥 지금 정산하세요!' : r ? escapeHtml(r.label) : '시작을 누르면 배율이 오릅니다.'}</div>
      <div class="choice-row wrap">
        <button id="startCrash" ${active || state.busy ? 'disabled' : ''}>시작</button>
        <button id="cashCrash" class="crash-cash" ${!active || state.crashCashed ? 'disabled' : ''}>정산하기</button>
      </div>
    </div>`;
}

function wheelCellClass(m) {
  if (m >= 10) return 'hot';
  if (m >= 2) return 'mid';
  if (m > 0) return 'low';
  return 'zero';
}

function renderWheel() {
  const r = state.wheelResult;
  const spinning = state.wheelSpinning;
  const strip = state.wheelStrip || WHEEL_SEGMENTS.flatMap((s) => [s.m, s.m]).slice(0, 24);
  return `<div class="game-head"><div><h2>🎡 휠 스핀</h2><p>휠을 돌려 포인터가 멈춘 칸의 배율만큼 받습니다. 0배~50배, 고배율일수록 확률이 낮습니다.</p></div>
      <div class="game-actions"><button id="spinWheel" ${spinning || state.busy ? 'disabled' : ''}>${spinning ? '도는 중...' : '휠 돌리기'}</button></div></div>
    <div class="wheel-box">
      <div class="wheel-pointer"></div>
      <div class="wheel-track" id="wheelTrack"><div class="wheel-strip" id="wheelStrip">${strip.map((m) => `<span class="wheel-cell ${wheelCellClass(m)}">${m}x</span>`).join('')}</div></div>
      <div class="result-line">${r && !spinning ? `${r.multiplier}배 칸 · ${r.profit >= 0 ? '+' : ''}${formatWon(r.profit)}` : '휠을 돌리면 멈춘 칸의 배율로 정산됩니다.'}</div>
    </div>`;
}

function renderHorse() {
  const r = state.horseResult;
  const racing = state.horseRacing;
  const picked = r?.pick;
  const lanes = HORSES.map((h) => {
    const won = r && !racing && r.winner === h.id;
    return `<div class="horse-lane ${won ? 'win' : ''}">
        <div class="horse-runner" id="horse-${h.id}">${h.emoji}</div>
        <span class="horse-name">${h.name} <em>${h.odds}배</em></span>
      </div>`;
  }).join('');
  const betBtns = HORSES.map((h) =>
    `<button data-horse="${h.id}" class="${picked === h.id ? 'picked' : ''}" ${state.busy || racing ? 'disabled' : ''}>${h.name} · ${h.odds}배</button>`).join('');
  return `<div class="game-head"><div><h2>🏇 경마</h2><p>4마리 중 1마리에 베팅하세요. 인기마일수록 우승 확률이 높고 배당은 낮습니다.</p></div></div>
    <div class="horse-box ${racing ? 'racing' : ''}">
      <div class="horse-track">${lanes}<div class="horse-finish"></div></div>
      <div class="result-line">${r && !racing ? escapeHtml(r.label) : racing ? '경주 진행 중...' : '말을 선택하면 경주가 시작됩니다.'}</div>
      <div class="choice-row wrap horse-bets">${betBtns}</div>
    </div>`;
}

function renderLog(log) {
  const profit = Math.trunc(Number(log.profit || 0));
  const cls = profit >= 0 ? 'plus' : 'minus';
  const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="log-item"><div>${escapeHtml(log.resultText || '-')}</div><span class="${cls}">${profit >= 0 ? '+' : ''}${formatWon(profit)}</span><small>${escapeHtml(time)}</small></div>`;
}

function bindCommonEvents() {
  document.querySelector('#roomForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomCode = normalizeRoomCode(document.querySelector('#roomInput')?.value);
    if (!roomCode) { state.notice = '방 코드를 입력하세요.'; render(); return; }
    boot(roomCode);
  });
  document.querySelector('[data-sound-toggle]')?.addEventListener('click', () => {
    const muted = toggleMuted();
    if (!muted) sfx.click();
    render();
  });
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    if (anyAnimation()) return;
    sfx.insertCoin();
    state.activeGame = button.dataset.tab;
    state.notice = '';
    render();
  }));
  document.querySelectorAll('[data-lottery-num]').forEach((button) => button.addEventListener('click', () => { sfx.click(); toggleLotteryNumber(Number(button.dataset.lotteryNum)); }));
}

function bindGameEvents() {
  document.querySelectorAll('[data-bet]').forEach((button) => button.addEventListener('click', () => {
    sfx.bet();
    const input = document.querySelector('#betInput');
    const max = getMaxBet();
    const value = button.dataset.bet === 'max' ? max : button.dataset.bet === 'ratio10' ? Math.floor((state.player?.cash || 0) * 0.1) : Number(button.dataset.bet);
    input.value = clampNumber(value, BET.min, max);
  }));

  document.querySelector('#startMines')?.addEventListener('click', () => { const bet = getBet(); if (!bet) return; state.mines = createMinesGame(bet); state.notice = '폭탄 위치가 새 랜덤으로 생성되었습니다.'; render(); });
  document.querySelectorAll('[data-cell]').forEach((cell) => cell.addEventListener('click', async () => {
    const result = openCell(state.mines, Number(cell.dataset.cell));
    if (result.status === 'bomb') await settle('mines', result, '폭탄 피하기에서 폭탄을 밟았습니다');
    else if (result.status === 'safe') { state.notice = `안전! 현재 ${result.multiplier.toFixed(2)}배 · 회수 가능 금액 ${formatWon(result.payout)}`; render(); }
  }));
  document.querySelector('#cashoutMines')?.addEventListener('click', async () => { const result = cashoutMines(state.mines); if (result) await settle('mines', result, `폭탄 피하기 ${result.safeCount}칸 성공 · ${result.multiplier.toFixed(2)}배 회수`); });

  document.querySelector('#startHighlow')?.addEventListener('click', () => { const bet = getBet(); if (!bet) return; state.highlow = createHighlowGame(bet); state.notice = '첫 카드가 새 랜덤으로 뽑혔습니다.'; render(); });
  document.querySelector('#guessHigh')?.addEventListener('click', () => playHighlow('HIGH'));
  document.querySelector('#guessLow')?.addEventListener('click', () => playHighlow('LOW'));
  document.querySelector('#cashoutHighlow')?.addEventListener('click', async () => { const result = cashoutHighlow(state.highlow); if (result) await settle('highlow', result, `하이로우 ${result.streak}연승 · ${result.multiplier.toFixed(2)}배 회수`); });

  document.querySelector('#spinSlots')?.addEventListener('click', playSlots);
  document.querySelector('#autoLottery')?.addEventListener('click', () => { state.lotterySelected = autoPickLotteryNumbers(); state.lotteryResult = null; state.lotteryRevealStep = 0; state.notice = '번호 6개를 자동 선택했습니다. 직접 수정할 수도 있습니다.'; render(); });
  document.querySelector('#clearLottery')?.addEventListener('click', () => { state.lotterySelected = []; state.lotteryResult = null; state.lotteryRevealStep = 0; state.notice = '복권 번호를 초기화했습니다.'; render(); });
  document.querySelector('#scratchLottery')?.addEventListener('click', playLotteryGame);

  document.querySelectorAll('[data-dice]').forEach((button) => button.addEventListener('click', async () => { const bet = getBet(); if (!bet) return; const result = playDice(bet, button.dataset.dice); state.diceResult = result; await settle('dice', result, `주사위 ${result.d1}+${result.d2}=${result.sum} · ${result.label}${result.multiplier ? ` · ${result.multiplier}배` : ''}`); }));
  document.querySelectorAll('[data-roulette]').forEach((button) => button.addEventListener('click', async () => { const bet = getBet(); if (!bet) return; const result = playRoulette(bet, button.dataset.roulette); state.rouletteResult = result; await settle('roulette', result, `룰렛 ${result.number} · ${result.label}${result.multiplier ? ` · ${result.multiplier}배` : ''}`); }));

  document.querySelectorAll('[data-baccarat]').forEach((button) => button.addEventListener('click', () => playBaccaratGame(button.dataset.baccarat)));
  document.querySelectorAll('[data-coin]').forEach((button) => button.addEventListener('click', () => playCoinFlipGame(button.dataset.coin)));
  document.querySelector('#dropPlinko')?.addEventListener('click', playPlinkoGame);

  document.querySelector('#startBlackjack')?.addEventListener('click', () => { const bet = getBet(); if (!bet) return; state.blackjack = createBlackjackGame(bet); state.notice = '카드가 새로 섞였습니다.'; sfx.card(); render(); });
  document.querySelector('#hitBlackjack')?.addEventListener('click', async () => { sfx.card(); const result = hitBlackjack(state.blackjack); if (result.status === 'finished') await settle('blackjack', result, `블랙잭 ${result.label}`); else { state.notice = `카드 추가 · 현재 ${result.total}`; render(); } });
  document.querySelector('#standBlackjack')?.addEventListener('click', async () => { const result = standBlackjack(state.blackjack); if (result.status === 'finished') await settle('blackjack', result, `블랙잭 ${result.label}`); });

  document.querySelectorAll('[data-ladder]').forEach((button) => button.addEventListener('click', async () => {
    const bet = getBet(); if (!bet) return;
    const result = createLadderRound(bet, Number(button.dataset.ladder));
    state.ladderResult = result;
    state.ladderAnimating = true;
    state.notice = '사다리를 내려가는 중...';
    render();
    await sleep(950);
    state.ladderAnimating = false;
    await settle('ladder', result, `사다리 게임 ${result.label}`);
  }));

  document.querySelector('#startCrash')?.addEventListener('click', startCrash);
  document.querySelector('#cashCrash')?.addEventListener('click', cashCrash);
  document.querySelector('#spinWheel')?.addEventListener('click', playWheel);
  document.querySelectorAll('[data-horse]').forEach((button) => button.addEventListener('click', () => playHorse(button.dataset.horse)));
}

function startCrash() {
  if (state.crashActive || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  state.crashBet = bet;
  state.crashPoint = rollCrashPoint();
  state.crashMultiplier = 1.0;
  state.crashCashed = false;
  state.crashResult = null;
  state.crashActive = true;
  state.notice = '배율 상승 중... 폭락 전에 정산하세요!';
  render();
  sfx.spin();
  let last = performance.now();
  const tick = () => {
    if (!state.crashActive) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.crashMultiplier *= Math.exp(0.6 * dt * (1 + state.crashMultiplier * 0.05));
    if (state.crashMultiplier >= state.crashPoint) {
      state.crashMultiplier = state.crashPoint;
      endCrash(false);
      return;
    }
    const num = document.querySelector('#crashNum');
    if (num) num.textContent = state.crashMultiplier.toFixed(2);
    if (Math.random() < 0.12) sfx.reelStop();
    state.crashTimer = requestAnimationFrame(tick);
  };
  state.crashTimer = requestAnimationFrame(tick);
}

function cashCrash() {
  if (!state.crashActive || state.crashCashed) return;
  state.crashCashed = true;
  endCrash(true);
}

async function endCrash(cashed) {
  if (!state.crashActive) return;
  state.crashActive = false;
  if (state.crashTimer) cancelAnimationFrame(state.crashTimer);
  const cashoutMult = cashed ? state.crashMultiplier : null;
  const result = settleCrash(state.crashBet, cashoutMult, state.crashPoint);
  state.crashResult = result;
  if (!cashed) sfx.lose();
  await settle('crash', result, result.resultText);
}

async function playWheel() {
  if (state.wheelSpinning || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  const result = spinWheel(bet);
  const pool = WHEEL_SEGMENTS.flatMap((s) => Array(Math.max(1, Math.round(s.w / 4))).fill(s.m));
  const N = 48;
  const strip = Array.from({ length: N }, () => pool[randomInt(0, pool.length - 1)]);
  const landIndex = N - 5;
  strip[landIndex] = result.multiplier;
  state.wheelStrip = strip;
  state.wheelLandIndex = landIndex;
  state.wheelResult = null;
  state.wheelSpinning = true;
  state.notice = '휠이 도는 중...';
  render();
  sfx.spin();
  await animateWheel(landIndex);
  state.wheelResult = result;
  state.wheelSpinning = false;
  await settle('wheel', result, result.resultText);
}

async function animateWheel(landIndex) {
  const track = document.querySelector('#wheelTrack');
  const strip = document.querySelector('#wheelStrip');
  if (!track || !strip) { await sleep(reduceMotion ? 100 : 2000); return; }
  const first = strip.querySelector('.wheel-cell');
  const cw = first ? first.getBoundingClientRect().width + 8 : 96;
  strip.style.transition = 'none';
  strip.style.transform = 'translateX(0px)';
  void strip.offsetWidth;
  const target = track.clientWidth / 2 - (landIndex * cw + cw / 2);
  if (reduceMotion) { strip.style.transform = `translateX(${target}px)`; await sleep(120); return; }
  strip.style.transition = 'transform 2.6s cubic-bezier(.13,.62,.12,1)';
  strip.style.transform = `translateX(${target}px)`;
  await sleep(2750);
}

async function playHorse(pick) {
  if (state.horseRacing || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  const result = runRace(bet, Number(pick));
  state.horseResult = result;
  state.horseRacing = true;
  state.notice = '경주 진행 중...';
  render();
  sfx.spin();
  await animateRace(result);
  state.horseRacing = false;
  await settle('horse', result, result.resultText);
}

async function animateRace(result) {
  const runners = HORSES.map((h) => document.querySelector(`#horse-${h.id}`));
  if (runners.some((x) => !x)) { await sleep(reduceMotion ? 100 : 1700); return; }
  let maxDur = 0;
  HORSES.forEach((h) => {
    const el = runners[h.id];
    const lane = el.parentElement;
    const target = Math.max(0, lane.clientWidth - 58);
    const dur = reduceMotion ? 150 : result.durations[h.id];
    maxDur = Math.max(maxDur, dur);
    el.style.transition = `transform ${dur}ms cubic-bezier(.35,.08,.45,1)`;
    el.style.transform = `translateX(${target}px)`;
  });
  await sleep((reduceMotion ? 180 : maxDur) + 200);
}

async function playCoinFlipGame(choice) {
  if (state.coinFlipping || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  const result = playCoinFlip(bet, choice);
  state.coinResult = null;
  state.coinFlipping = true;
  state.notice = '동전이 회전 중...';
  render();
  sfx.spin();
  await sleep(reduceMotion ? 150 : 850);
  state.coinResult = result;
  state.coinFlipping = false;
  await settle('coinflip', result, `동전 ${result.sideLabel} · ${result.label}`);
}

async function playBaccaratGame(choice) {
  if (state.baccaratRevealing || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  const result = createBaccaratRound(bet, choice);
  const seqLen = 4 + (result.player[2] ? 1 : 0) + (result.banker[2] ? 1 : 0);
  state.baccaratResult = result;
  state.baccaratRevealing = true;
  state.baccaratRevealStep = 0;
  state.notice = '딜러가 카드를 나눕니다...';
  render();
  sfx.card();
  for (let i = 1; i <= seqLen; i += 1) {
    await sleep(reduceMotion ? 60 : 360);
    state.baccaratRevealStep = i;
    sfx.reelStop();
    render();
  }
  await sleep(reduceMotion ? 80 : 420);
  state.baccaratRevealing = false;
  await settle('baccarat', result, result.resultText);
}

async function playPlinkoGame() {
  if (state.plinkoDropping || state.busy) return;
  const bet = getBet();
  if (!bet) return;
  const result = dropPlinko(bet);
  state.plinkoResult = result;
  state.plinkoDropping = true;
  state.notice = '공이 핀을 튕기며 내려갑니다...';
  render();
  sfx.spin();
  await animatePlinko(result);
  state.plinkoDropping = false;
  await settle('plinko', result, `플링코 ${result.multiplier}배 칸 도착`);
}

async function animatePlinko(result) {
  const ball = document.querySelector('#plinkoBall');
  const rows = PLINKO_ROWS;
  const finalLeft = ((result.bucket + 0.5) / (rows + 1)) * 100;
  if (!ball) { await sleep(reduceMotion ? 100 : 600); return; }
  ball.hidden = false;
  ball.style.left = '50%';
  ball.style.top = '2%';
  if (reduceMotion) {
    ball.style.left = finalLeft + '%';
    ball.style.top = '88%';
    await sleep(120);
    return;
  }
  ball.style.transition = 'top .12s linear, left .12s ease-in-out';
  for (let i = 0; i < rows; i += 1) {
    const progress = (i + 1) / rows;
    const leftNow = 50 + (finalLeft - 50) * progress + (result.path[i] ? 3.5 : -3.5);
    ball.style.left = Math.max(3, Math.min(97, leftNow)) + '%';
    ball.style.top = (2 + progress * 84) + '%';
    sfx.reelStop();
    await sleep(110);
  }
  ball.style.left = finalLeft + '%';
  ball.style.top = '90%';
  await sleep(240);
}

async function playSlots() {
  const bet = getBet();
  if (!bet || state.slotSpinning || state.busy) return;
  const result = spinSlots(bet);
  state.slotResult = null;
  state.slotSpinning = true;
  state.notice = '릴이 돌아가는 중...';
  render();
  sfx.spin();
  await animateSlots(result.reels);
  state.slotResult = result;
  state.slotSpinning = false;
  await settle('slots', result, `슬롯머신 ${result.reels.join(' ')} · ${result.label}${result.multiplier ? ` · ${result.multiplier}배` : ''}`);
}

async function playLotteryGame() {
  const bet = getBet();
  if (!bet || state.lotteryScratching || state.busy) return;
  if ((state.lotterySelected || []).length !== LOTTERY_PICK_COUNT) { state.notice = `복권 번호 ${LOTTERY_PICK_COUNT}개를 먼저 선택하세요.`; render(); return; }
  let result;
  try {
    result = playLottery(bet, state.lotterySelected);
  } catch (error) {
    state.notice = error.message;
    render();
    return;
  }
  state.lotteryResult = result;
  state.lotteryRevealStep = 0;
  state.lotteryScratching = true;
  state.notice = '추첨 번호를 하나씩 공개합니다...';
  render();
  for (let i = 1; i <= LOTTERY_PICK_COUNT; i += 1) {
    await sleep(420);
    state.lotteryRevealStep = i;
    sfx.reveal();
    render();
  }
  await sleep(520);
  state.lotteryScratching = false;
  await settle('lottery', result, `복권 ${result.rank} · ${result.matches}개 적중 · ${result.label}${result.multiplier ? ` · ${result.multiplier}배` : ''}`);
}

function toggleLotteryNumber(number) {
  if (state.lotteryScratching || state.busy) return;
  const current = [...(state.lotterySelected || [])];
  const index = current.indexOf(number);
  if (index >= 0) current.splice(index, 1);
  else if (current.length < LOTTERY_PICK_COUNT) current.push(number);
  else { state.notice = `번호는 ${LOTTERY_PICK_COUNT}개까지만 선택할 수 있습니다.`; render(); return; }
  state.lotterySelected = current.sort((a, b) => a - b);
  state.lotteryResult = null;
  state.lotteryRevealStep = 0;
  state.notice = state.lotterySelected.length === LOTTERY_PICK_COUNT ? '번호 선택 완료. 추첨을 시작할 수 있습니다.' : `번호 ${state.lotterySelected.length}/${LOTTERY_PICK_COUNT}개 선택`;
  render();
}

async function animateSlots(finalReels) {
  const symbols = slotSymbols.map((item) => item.value);
  const reelEls = [...document.querySelectorAll('#slotReels .slot-reel')];
  if (reelEls.length !== 3) return;
  for (let i = 0; i < 3; i += 1) {
    const ticks = 18 + i * 12;
    for (let t = 0; t < ticks; t += 1) {
      reelEls[i].textContent = symbols[randomInt(0, symbols.length - 1)];
      reelEls[i].classList.toggle('pulse', t % 2 === 0);
      await sleep(38 + i * 9);
    }
    reelEls[i].textContent = finalReels[i];
    reelEls[i].classList.remove('pulse');
    reelEls[i].classList.add('locked');
    sfx.reelStop();
    await sleep(310 + i * 80);
  }
  await sleep(520);
}

async function playHighlow(choice) {
  const result = guessHighlow(state.highlow, choice);
  if (result.status === 'fail') { await settle('highlow', result, `하이로우 실패 · ${result.previous.label} → ${result.current.label}`); return; }
  if (result.status === 'success') { state.notice = `성공! ${result.previous.label} → ${result.current.label} · ${result.streak}연승 · ${result.multiplier.toFixed(2)}배`; render(); }
}

function getMaxBet() {
  return Math.max(BET.min, Math.min(BET.fallbackMax, Math.floor((state.player?.cash || 0) * BET.maxRatio)));
}
function getBet() {
  const max = getMaxBet();
  const raw = document.querySelector('#betInput')?.value;
  const bet = clampNumber(raw, BET.min, max);
  if (!Number.isFinite(Number(raw)) || Number(raw) <= 0) { state.notice = '베팅금을 올바르게 입력하세요.'; render(); return 0; }
  if (bet > state.player.cash) { state.notice = '보유금보다 크게 베팅할 수 없습니다.'; render(); return 0; }
  if (bet < BET.min) { state.notice = `최소 베팅금은 ${formatWon(BET.min)}입니다.`; render(); return 0; }
  return bet;
}

async function settle(game, result, resultText) {
  if (state.busy) return;
  try {
    state.busy = true;
    const profit = Math.trunc(Number(result.profit || 0));
    const bet = Math.trunc(Number(result.bet || document.querySelector('#betInput')?.value || 0));
    const payout = Math.trunc(Number(result.payout || 0));
    const nextCash = await applyProfit(state.roomCode, state.user.uid, profit, state.player.cash);
    await updateStats(state.roomCode, state.user.uid, profit);
    const newLog = await addArcadeLog(state.roomCode, { uid: state.user.uid, nickname: state.player.nickname, game, bet, payout, profit, resultText });

    state.player.cash = nextCash;
    state.stats = updateLocalStats(state.stats, profit);
    state.logs = [newLog, ...state.logs].slice(0, 20);
    state.notice = `${resultText} / 손익 ${profit >= 0 ? '+' : ''}${formatWon(profit)}`;
    const jackpot = bet > 0 && payout >= bet * 5;
    flashResult(jackpot ? 'jackpot' : profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral');
    if (jackpot) sfx.jackpot();
    else if (profit > 0) (payout >= bet * 2 ? sfx.bigWin() : sfx.win());
    else if (profit < 0) sfx.lose();
    else sfx.push();
    floatProfit(profit);
  } catch (error) {
    console.error(error);
    state.notice = error.message || '정산에 실패했습니다.';
  } finally {
    state.busy = false;
    render();
  }
}

function updateLocalStats(prev, profit) {
  const p = Math.trunc(Number(profit) || 0);
  return { plays: Math.trunc(Number(prev?.plays || 0)) + 1, profit: Math.trunc(Number(prev?.profit || 0)) + p, wins: Math.trunc(Number(prev?.wins || 0)) + (p > 0 ? 1 : 0), losses: Math.trunc(Number(prev?.losses || 0)) + (p < 0 ? 1 : 0), updatedAt: Date.now() };
}
function flashResult(type) {
  state.resultFlash = type;
  window.clearTimeout(flashResult.timer);
  flashResult.timer = window.setTimeout(() => { state.resultFlash = ''; render(); }, 850);
}

// 잔액 변화 플로팅 숫자 (cash 칩 위로 떠오르는 +/- 손익)
function floatProfit(profit) {
  if (reduceMotion || !profit) return;
  const anchor = document.querySelector('.cash-box');
  if (!anchor) return;
  const el = document.createElement('div');
  el.className = `float-profit ${profit >= 0 ? 'up' : 'down'}`;
  el.textContent = `${profit >= 0 ? '+' : ''}${formatWon(profit)}`;
  anchor.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
function anyAnimation() { return state.slotSpinning || state.lotteryScratching || state.ladderAnimating || state.coinFlipping || state.plinkoDropping || state.baccaratRevealing || state.crashActive || state.wheelSpinning || state.horseRacing; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
