import { get, ref, runTransaction, update } from 'firebase/database';
import { getFirebase } from './firebase.js';
import { PLAYER_PATH, STATS_PATH, WALLET_PATH } from './config.js';

export async function loadPlayer(roomCode, uid) {
  const { db } = getFirebase();
  const snap = await get(ref(db, PLAYER_PATH(roomCode, uid)));
  const value = snap.val() || {};
  return {
    uid,
    nickname: value.nickname || value.name || value.playerName || `Player-${uid.slice(0, 4)}`,
    cash: Math.trunc(Number(value.cash || 0))
  };
}

export async function applyProfit(roomCode, uid, profit) {
  const { db } = getFirebase();
  const delta = Math.trunc(Number(profit) || 0);
  const cashRef = ref(db, WALLET_PATH(roomCode, uid));

  const tx = await runTransaction(cashRef, (current) => {
    const cash = Math.trunc(Number(current || 0));
    const next = cash + delta;
    if (next < 0) return;
    return next;
  });

  if (!tx.committed) {
    throw new Error('보유금이 부족하거나 정산에 실패했습니다.');
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
  if (snap.exists()) return;
  await update(playerRef, {
    nickname: `Player-${uid.slice(0, 4)}`,
    cash: 10000000,
    createdFrom: 'STONK Arcade',
    createdAt: Date.now()
  });
}
