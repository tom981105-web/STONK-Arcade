import { get, ref, runTransaction, update } from 'firebase/database';
import { getFirebase } from './firebase.js';
import { PLAYER_PATH, STATS_PATH, WALLET_PATH } from './config.js';

export async function loadPlayer(roomCode, uid) {
  const { db } = getFirebase();
  const snap = await get(ref(db, PLAYER_PATH(roomCode, uid)));
  const value = snap.val() || {};
  const cashValue = value.cash ?? value.money ?? value.balance ?? value.capital ?? 0;
  return {
    uid,
    nickname: value.nickname || value.name || value.playerName || `Player-${uid.slice(0, 4)}`,
    cash: Math.trunc(Number(cashValue || 0))
  };
}

export async function applyProfit(roomCode, uid, profit, fallbackCash = 0) {
  const { db } = getFirebase();
  const delta = Math.trunc(Number(profit) || 0);
  const fallback = Math.max(0, Math.trunc(Number(fallbackCash || 0)));
  const cashRef = ref(db, WALLET_PATH(roomCode, uid));

  const tx = await runTransaction(cashRef, (current) => {
    // Battle에서 생성된 플레이어에 cash 필드가 아직 없거나, money/balance 같은
    // 다른 필드만 있는 경우 패배 정산이 current=0으로 처리되어 실패하던 문제를 방지한다.
    const baseCash = current === null || current === undefined ? fallback : current;
    const cash = Math.trunc(Number(baseCash || 0));
    const next = cash + delta;
    if (next < 0) return;
    return next;
  });

  if (!tx.committed) {
    throw new Error('보유금이 부족합니다. 보유금이 맞지 않으면 새로고침 후 다시 시도하세요.');
  }

  return Math.trunc(Number(tx.snapshot.val() || 0));
}

export async function updateStats(roomCode, uid, profit) {
  const { db } = getFirebase();
  const statsRef = ref(db, STATS_PATH(roomCode, uid));
  await runTransaction(statsRef, (current) => {
    const prev = current || {};
    const p = Math.trunc(Number(profit) || 0);
    return {
      plays: Math.trunc(Number(prev.plays || 0)) + 1,
      profit: Math.trunc(Number(prev.profit || 0)) + p,
      wins: Math.trunc(Number(prev.wins || 0)) + (p > 0 ? 1 : 0),
      losses: Math.trunc(Number(prev.losses || 0)) + (p < 0 ? 1 : 0),
      updatedAt: Date.now()
    };
  });
}

export async function loadStats(roomCode, uid) {
  const { db } = getFirebase();
  const snap = await get(ref(db, STATS_PATH(roomCode, uid)));
  return snap.val() || { plays: 0, profit: 0, wins: 0, losses: 0 };
}

export async function ensurePlayerExists(roomCode, uid) {
  const { db } = getFirebase();
  const playerRef = ref(db, PLAYER_PATH(roomCode, uid));
  const snap = await get(playerRef);
  if (snap.exists()) {
    const value = snap.val() || {};
    if (value.cash === undefined || value.cash === null) {
      const aliasCash = value.money ?? value.balance ?? value.capital;
      if (aliasCash !== undefined && aliasCash !== null) {
        await update(playerRef, { cash: Math.max(0, Math.trunc(Number(aliasCash || 0))) });
      }
    }
    return;
  }
  await update(playerRef, {
    nickname: `Player-${uid.slice(0, 4)}`,
    cash: 10000000,
    createdFrom: 'STONK Arcade',
    createdAt: Date.now()
  });
}
