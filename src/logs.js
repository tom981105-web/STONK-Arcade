import { limitToLast, orderByChild, push, query, ref, remove, set, get } from 'firebase/database';
import { getFirebase } from './firebase.js';
import { LOGS_PATH } from './config.js';

export async function addArcadeLog(roomCode, payload) {
  const { db } = getFirebase();
  const row = {
    ...payload,
    createdAt: Date.now()
  };
  await set(push(ref(db, LOGS_PATH(roomCode))), row);
  // v2: 매번 전체 로그를 감시하지 않는다. 10% 확률로만 오래된 로그 정리.
  if ((row.createdAt % 10) === 0) pruneLogs(roomCode).catch(() => {});
  return row;
}

export async function loadRecentLogs(roomCode, limit = 20) {
  const { db } = getFirebase();
  const logsRef = query(ref(db, LOGS_PATH(roomCode)), orderByChild('createdAt'), limitToLast(limit));
  const snap = await get(logsRef);
  const rows = [];
  snap.forEach((child) => rows.push({ id: child.key, ...child.val() }));
  rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return rows;
}

async function pruneLogs(roomCode) {
  const { db } = getFirebase();
  const keepQuery = query(ref(db, LOGS_PATH(roomCode)), orderByChild('createdAt'), limitToLast(60));
  const keepSnap = await get(keepQuery);
  const keep = new Set();
  keepSnap.forEach((child) => keep.add(child.key));

  const allSnap = await get(ref(db, LOGS_PATH(roomCode)));
  const deletions = [];
  allSnap.forEach((child) => {
    if (!keep.has(child.key)) deletions.push(remove(child.ref));
  });
  await Promise.all(deletions);
}
