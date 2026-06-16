import { endAt, limitToLast, onValue, orderByChild, push, query, ref, remove, set, get } from 'firebase/database';
import { getFirebase } from './firebase.js';
import { LOGS_PATH } from './config.js';

export async function addArcadeLog(roomCode, payload) {
  const { db } = getFirebase();
  const logsRef = ref(db, LOGS_PATH(roomCode));
  await set(push(logsRef), {
    ...payload,
    createdAt: Date.now()
  });
  pruneLogs(roomCode).catch(() => {});
}

export function subscribeLogs(roomCode, callback) {
  const { db } = getFirebase();
  const logsRef = query(ref(db, LOGS_PATH(roomCode)), orderByChild('createdAt'), limitToLast(20));
  return onValue(logsRef, (snap) => {
    const rows = [];
    snap.forEach((child) => rows.push({ id: child.key, ...child.val() }));
    rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    callback(rows);
  });
}

async function pruneLogs(roomCode) {
  const { db } = getFirebase();
  const q = query(ref(db, LOGS_PATH(roomCode)), orderByChild('createdAt'), limitToLast(60));
  const keepSnap = await get(q);
  const keep = new Set();
  keepSnap.forEach((child) => keep.add(child.key));

  const allSnap = await get(ref(db, LOGS_PATH(roomCode)));
  const deletions = [];
  allSnap.forEach((child) => {
    if (!keep.has(child.key)) deletions.push(remove(child.ref));
  });
  await Promise.all(deletions);
}
