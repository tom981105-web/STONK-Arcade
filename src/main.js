import './styles.css';
import { isConfigured, ensureAnonymousUser } from './firebase.js';
import { ROUTES, STORAGE_KEYS, BET, APP_VERSION } from './config.js';
import { addArcadeLog, subscribeLogs } from './logs.js';
import { applyProfit, ensurePlayerExists, loadPlayer, loadStats, updateStats } from './wallet.js';
import { clampNumber, escapeHtml, formatWon, getStoredRoomCode, getUrlRoomCode, normalizeRoomCode, saveRoomCode, shortUid } from './utils.js';
import { cashoutMines, createMinesGame, openCell, multiplierForSafeCount } from './games/mines.js';
import { cashoutHighlow, createHighlowGame, guessHighlow } from './games/highlow.js';
import { spinSlots } from './games/slots.js';

const state = {
  roomCode: getUrlRoomCode() || getStoredRoomCode(STORAGE_KEYS),
  user: null,
  player: null,
  stats: { plays: 0, profit: 0, wins: 0, losses: 0 },
  activeGame: 'mines',
  mines: null,
  highlow: null,
  logs: [],
  unsubscribeLogs: null,
  busy: false,
  notice: ''
};

const app = document.querySelector('#app');

render();

async function boot(roomCode) {
  try {
    if (!isConfigured) {
      state.notice = 'Firebase 설정이 비어 있습니다. src/firebase.js에 기존 STONK Firebase config를 붙여넣으세요.';
      render();
      return;
    }
    state.busy = true;
    state.notice = 'Arcade 입장 중...';
    state.roomCode = normalizeRoomCode(roomCode);
    saveRoomCode(state.roomCode, STORAGE_KEYS);
    render();

    state.user = await ensureAnonymousUser();
    await ensurePlayerExists(state.roomCode, state.user.uid);
    state.player = await loadPlayer(state.roomCode, state.user.uid);
    state.stats = await loadStats(state.roomCode, state.user.uid);

    if (state.unsubscribeLogs) state.unsubscribeLogs();
    state.unsubscribeLogs = subscribeLogs(state.roomCode, (logs) => {
      state.logs = logs;
      render();
    });

    state.notice = '입장 완료. 모든 게임은 매판 새 랜덤으로 생성됩니다.';
  } catch (error) {
    console.error(error);
    state.notice = error.message || '입장 중 오류가 발생했습니다.';
  } finally {
    state.busy = false;
    render();
  }
}

if (state.roomCode) boot(state.roomCode);

function render() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">STONK SIDE GAME · v${APP_VERSION}</div>
          <h1>STONK Arcade</h1>
          <p>시장이 끝난 뒤, 진짜 게임이 시작된다.</p>
        </div>
        <nav class="nav">
          ${navLink('Home', ROUTES.home)}
          ${navLink('Battle', ROUTES.battle)}
          ${navLink('Market Pulse', ROUTES.pulse)}
          ${navLink('Wiki', ROUTES.wiki)}
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
        <p>같은 방의 <b>players/{uid}/cash</b>와 연결됩니다. Firebase 사용량을 줄이기 위해 게임 결과 정산 시에만 보유금을 업데이트합니다.</p>
      </div>
      <form id="roomForm" class="room-form">
        <label>방 코드</label>
        <input id="roomInput" value="${escapeHtml(state.roomCode)}" placeholder="예: ABC123" autocomplete="off" />
        <button ${state.busy ? 'disabled' : ''}>Arcade 입장</button>
      </form>
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
    </main>
  `;
}

function renderArcade() {
  return `
    <main class="layout">
      <aside class="panel card">
        <div class="panel-title">내 정보</div>
        <div class="stat"><span>방 코드</span><strong>${escapeHtml(state.roomCode)}</strong></div>
        <div class="stat"><span>UID</span><strong>${shortUid(state.user?.uid)}</strong></div>
        <div class="cash-box">
          <span>보유금</span>
          <strong>${formatWon(state.player.cash)}</strong>
        </div>
        <div class="stat"><span>오늘/누적 손익</span><strong class="${state.stats.profit >= 0 ? 'plus' : 'minus'}">${state.stats.profit >= 0 ? '+' : ''}${formatWon(state.stats.profit)}</strong></div>
        <div class="stat"><span>플레이</span><strong>${Number(state.stats.plays || 0).toLocaleString('ko-KR')}회</strong></div>
        <div class="tip">모든 게임은 시작할 때마다 새 랜덤 결과를 생성합니다. 겹칠 수는 있지만 일부러 같은 판을 재사용하지 않습니다.</div>
      </aside>

      <section class="stage card glow">
        <div class="game-tabs">
          ${tabButton('mines', '💣 폭탄 피하기')}
          ${tabButton('highlow', '🃏 하이로우')}
          ${tabButton('slots', '🎰 슬롯머신')}
        </div>
        ${renderBetBar()}
        ${renderCurrentGame()}
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
      </section>

      <aside class="logs card">
        <div class="panel-title">최근 결과</div>
        <div class="log-list">
          ${state.logs.length ? state.logs.map(renderLog).join('') : '<div class="empty">아직 Arcade 기록이 없습니다.</div>'}
        </div>
      </aside>
    </main>
  `;
}

function tabButton(id, label) {
  return `<button class="tab ${state.activeGame === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
}

function renderBetBar() {
  const max = Math.max(BET.min, Math.min(BET.fallbackMax, Math.floor((state.player?.cash || 0) * BET.maxRatio)));
  return `
    <div class="betbar">
      <div>
        <label for="betInput">베팅금</label>
        <input id="betInput" type="number" min="${BET.min}" max="${max}" step="1000" value="${Math.min(1000000, max)}" />
      </div>
      <button class="small" data-bet="100000">10만</button>
      <button class="small" data-bet="1000000">100만</button>
      <button class="small" data-bet="10000000">1000만</button>
      <button class="small" data-bet="max">최대</button>
    </div>
  `;
}

function renderCurrentGame() {
  if (state.activeGame === 'mines') return renderMines();
  if (state.activeGame === 'highlow') return renderHighlow();
  return renderSlots();
}

function renderMines() {
  const game = state.mines;
  const safe = game?.safeCount || 0;
  const multiplier = multiplierForSafeCount(safe);
  return `
    <div class="game-head">
      <div>
        <h2>💣 폭탄 피하기</h2>
        <p>25칸 중 폭탄 3개. 안전 칸을 열수록 배율이 올라갑니다.</p>
      </div>
      <div class="game-actions">
        <button id="startMines">새 판 시작</button>
        <button id="cashoutMines" ${!game || game.finished || safe <= 0 ? 'disabled' : ''}>수익 회수 · ${multiplier.toFixed(2)}배</button>
      </div>
    </div>
    <div class="mines-board">
      ${Array.from({ length: 25 }, (_, i) => renderMineCell(game, i)).join('')}
    </div>
  `;
}

function renderMineCell(game, index) {
  const opened = game?.opened?.has(index);
  const isBomb = game?.bombs?.has(index);
  let content = '';
  let cls = 'mine-cell';
  if (opened && isBomb) { cls += ' bomb'; content = '💥'; }
  else if (opened) { cls += ' safe'; content = '◆'; }
  else if (game?.finished && isBomb) { cls += ' reveal'; content = '💣'; }
  return `<button class="${cls}" data-cell="${index}" ${!game || game.finished || opened ? 'disabled' : ''}>${content}</button>`;
}

function renderHighlow() {
  const game = state.highlow;
  const current = game?.current?.label || '?';
  const streak = game?.streak || 0;
  const canCashout = game && !game.finished && streak > 0;
  return `
    <div class="game-head">
      <div>
        <h2>🃏 하이로우</h2>
        <p>다음 카드가 현재 카드보다 높을지 낮을지 맞히세요. 같은 숫자는 실패입니다.</p>
      </div>
      <div class="game-actions">
        <button id="startHighlow">새 판 시작</button>
        <button id="cashoutHighlow" ${!canCashout ? 'disabled' : ''}>수익 회수</button>
      </div>
    </div>
    <div class="card-game">
      <div class="playing-card">${escapeHtml(current)}</div>
      <div class="streak">연승 ${streak}회</div>
      <div class="choice-row">
        <button id="guessLow" ${!game || game.finished ? 'disabled' : ''}>LOW</button>
        <button id="guessHigh" ${!game || game.finished ? 'disabled' : ''}>HIGH</button>
      </div>
    </div>
  `;
}

function renderSlots() {
  return `
    <div class="game-head">
      <div>
        <h2>🎰 슬롯머신</h2>
        <p>매번 새 랜덤 심볼 3개를 뽑습니다. 7️⃣ 7️⃣ 7️⃣은 30배입니다.</p>
      </div>
      <div class="game-actions">
        <button id="spinSlots">돌리기</button>
      </div>
    </div>
    <div class="slots" id="slotReels">
      <div>❔</div><div>❔</div><div>❔</div>
    </div>
  `;
}

function renderLog(log) {
  const profit = Math.trunc(Number(log.profit || 0));
  const cls = profit >= 0 ? 'plus' : 'minus';
  const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  return `
    <div class="log-item">
      <div>${escapeHtml(log.resultText || '-')}</div>
      <span class="${cls}">${profit >= 0 ? '+' : ''}${formatWon(profit)}</span>
      <small>${escapeHtml(time)}</small>
    </div>
  `;
}

function bindCommonEvents() {
  document.querySelector('#roomForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomCode = normalizeRoomCode(document.querySelector('#roomInput')?.value);
    if (!roomCode) {
      state.notice = '방 코드를 입력하세요.';
      render();
      return;
    }
    boot(roomCode);
  });

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeGame = button.dataset.tab;
      state.notice = '';
      render();
    });
  });
}

function bindGameEvents() {
  document.querySelectorAll('[data-bet]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector('#betInput');
      const max = getMaxBet();
      const value = button.dataset.bet === 'max' ? max : Number(button.dataset.bet);
      input.value = clampNumber(value, BET.min, max);
    });
  });

  document.querySelector('#startMines')?.addEventListener('click', () => {
    const bet = getBet();
    if (!bet) return;
    state.mines = createMinesGame(bet);
    state.notice = '폭탄 위치가 새 랜덤으로 생성되었습니다.';
    render();
  });

  document.querySelectorAll('[data-cell]').forEach((cell) => {
    cell.addEventListener('click', async () => {
      const result = openCell(state.mines, Number(cell.dataset.cell));
      if (result.status === 'bomb') await settle('mines', result, `폭탄 피하기에서 폭탄을 밟았습니다`);
      else if (result.status === 'safe') {
        state.notice = `안전! 현재 ${result.multiplier.toFixed(2)}배 · 회수 가능 금액 ${formatWon(result.payout)}`;
        render();
      }
    });
  });

  document.querySelector('#cashoutMines')?.addEventListener('click', async () => {
    const result = cashoutMines(state.mines);
    if (!result) return;
    await settle('mines', result, `폭탄 피하기 ${result.safeCount}칸 성공 · ${result.multiplier.toFixed(2)}배 회수`);
  });

  document.querySelector('#startHighlow')?.addEventListener('click', () => {
    const bet = getBet();
    if (!bet) return;
    state.highlow = createHighlowGame(bet);
    state.notice = '첫 카드가 새 랜덤으로 뽑혔습니다.';
    render();
  });

  document.querySelector('#guessHigh')?.addEventListener('click', () => playHighlow('HIGH'));
  document.querySelector('#guessLow')?.addEventListener('click', () => playHighlow('LOW'));

  document.querySelector('#cashoutHighlow')?.addEventListener('click', async () => {
    const result = cashoutHighlow(state.highlow);
    if (!result) return;
    await settle('highlow', result, `하이로우 ${result.streak}연승 · ${result.multiplier.toFixed(2)}배 회수`);
  });

  document.querySelector('#spinSlots')?.addEventListener('click', async () => {
    const bet = getBet();
    if (!bet) return;
    const result = spinSlots(bet);
    const reels = document.querySelector('#slotReels');
    if (reels) reels.innerHTML = result.reels.map((r) => `<div>${r}</div>`).join('');
    await settle('slots', result, `슬롯머신 ${result.reels.join(' ')} · ${result.label}${result.multiplier ? ` · ${result.multiplier}배` : ''}`);
  });
}

async function playHighlow(choice) {
  const result = guessHighlow(state.highlow, choice);
  if (result.status === 'fail') {
    await settle('highlow', result, `하이로우 실패 · ${result.previous.label} → ${result.current.label}`);
    return;
  }
  if (result.status === 'success') {
    state.notice = `성공! ${result.previous.label} → ${result.current.label} · ${result.streak}연승 · ${result.multiplier.toFixed(2)}배`;
    render();
  }
}

function getMaxBet() {
  return Math.max(BET.min, Math.min(BET.fallbackMax, Math.floor((state.player?.cash || 0) * BET.maxRatio)));
}

function getBet() {
  const max = getMaxBet();
  const raw = document.querySelector('#betInput')?.value;
  const bet = clampNumber(raw, BET.min, max);
  if (!Number.isFinite(Number(raw)) || Number(raw) <= 0) {
    state.notice = '베팅금을 올바르게 입력하세요.';
    render();
    return 0;
  }
  if (bet > state.player.cash) {
    state.notice = '보유금보다 크게 베팅할 수 없습니다.';
    render();
    return 0;
  }
  if (bet < BET.min) {
    state.notice = `최소 베팅금은 ${formatWon(BET.min)}입니다.`;
    render();
    return 0;
  }
  return bet;
}

async function settle(game, result, resultText) {
  if (state.busy) return;
  try {
    state.busy = true;
    const profit = Math.trunc(Number(result.profit || 0));
    const bet = Math.trunc(Number(result.bet || state.mines?.bet || state.highlow?.bet || document.querySelector('#betInput')?.value || 0));
    const payout = Math.trunc(Number(result.payout || 0));
    const nextCash = await applyProfit(state.roomCode, state.user.uid, profit);
    await updateStats(state.roomCode, state.user.uid, profit);
    await addArcadeLog(state.roomCode, {
      uid: state.user.uid,
      nickname: state.player.nickname,
      game,
      bet,
      payout,
      profit,
      resultText
    });
    state.player.cash = nextCash;
    state.stats = await loadStats(state.roomCode, state.user.uid);
    state.notice = `${resultText} / 정산 ${profit >= 0 ? '+' : ''}${formatWon(profit)}`;
  } catch (error) {
    console.error(error);
    state.notice = error.message || '정산 중 오류가 발생했습니다.';
  } finally {
    state.busy = false;
    render();
  }
}
