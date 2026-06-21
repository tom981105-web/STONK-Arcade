import { get, push, ref, runTransaction, update } from 'firebase/database';
import { getFirebase } from './firebase.js';
import { PLAYER_PATH, STATS_PATH, WALLET_PATH } from './config.js';

// v2.5: Arcade 손실 완화 보험 실연동.
// 손실 100만원 이상 + 활성 'arcade' 보험이 있으면 1회에 한해 손실의 10%를 환급한다.
// 게임 결과 자체는 바꾸지 않고, 정산 후 추가 환급만 처리한다. 실패해도 게임이 멈추지 않도록 방어.
export async function claimArcadeLossInsurance(roomCode, uid, lossAmount) {
  try {
    const loss = Math.trunc(Number(lossAmount) || 0);
    if (loss < 1000000) return 0;
    const { db } = getFirebase();
    const now = Date.now();
    const bankSnap = await get(ref(db, `rooms/${roomCode}/bank/${uid}`));
    const inss = (bankSnap.val() || {}).insurances || {};
    const entry = Object.entries(inss).find(([, i]) => i && i.type === 'arcade' && i.status === 'active' && !i.usedAt && Number(i.expiresAt || 0) > now);
    if (!entry) return 0;
    const [insId] = entry;
    const refund = Math.max(1, Math.floor(loss * 0.10));
    await runTransaction(ref(db, WALLET_PATH(roomCode, uid)), (c) => Math.trunc(Number(c || 0)) + refund);
    await update(ref(db, `rooms/${roomCode}/bank/${uid}/insurances/${insId}`), { status: 'used', usedAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/tx`), { type: 'insurance_used', title: 'Arcade 손실 완화 보험 적용', amount: refund, beforeCash: 0, afterCash: 0, memo: `손실액 ${loss.toLocaleString('ko-KR')}원 중 10% 환급`, createdAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/messages`), { type: 'insurance', title: 'Arcade 보험 적용 완료', body: `손실액 ${loss.toLocaleString('ko-KR')}원 중 ${refund.toLocaleString('ko-KR')}원이 환급되었습니다.`, amount: refund, relatedId: 'insused-' + insId, read: false, actionLabel: '', actionUrl: '', createdAt: now });
    return refund;
  } catch (e) { console.warn('[arcade] 보험 환급 처리 실패:', e); return -1; } // -1 = 확인 실패
}

// v2.0: 은행 대출 잔액 1회 조회(표시 전용). 아케이드 정산/확률에는 영향 없음.
export async function loadBankLoan(roomCode, uid) {
  try {
    const { db } = getFirebase();
    const snap = await get(ref(db, `rooms/${roomCode}/bank/${uid}`));
    const b = snap.val() || {};
    return Math.max(0, Math.trunc(Number(b.loanPrincipal || 0) + Number(b.loanInterest || 0)));
  } catch (_) { return 0; }
}

// v2.9: 카드 상태 조회(결제 옵션 표시용). 실패 시 null → 카드 옵션 숨김.
export async function loadCardStatus(roomCode, uid) {
  try {
    const { db } = getFirebase();
    const snap = await get(ref(db, `rooms/${roomCode}/bank/${uid}/card`));
    const c = snap.val() || {};
    const limit = Math.trunc(Number(c.cardLimit) || 0), used = Math.trunc(Number(c.usedAmount) || 0);
    return { enabled: !!c.enabled, suspended: !!c.suspended, overdue: !!c.overdue, tier: c.cardTier || "", limit, used, remaining: Math.max(0, limit - used) };
  } catch (_) { return null; }
}
// v2.9: 카드 결제(usedAmount 누적, 즉시 현금 차감 없음). 반환: 결제액(성공) / -1 정지·미발급 / -2 한도초과 / 0 무효
export async function chargeCard(roomCode, uid, amount, label) {
  try {
    amount = Math.max(0, Math.trunc(Number(amount) || 0));
    if (amount <= 0) return 0;
    const { db } = getFirebase();
    const now = Date.now();
    const c = (await get(ref(db, `rooms/${roomCode}/bank/${uid}/card`))).val() || {};
    if (!c.enabled || c.suspended) return -1;
    const limit = Math.trunc(Number(c.cardLimit) || 0), used = Math.trunc(Number(c.usedAmount) || 0);
    if (used + amount > limit) return -2;
    const dueAt = Number(c.dueAt) > 0 ? Number(c.dueAt) : now + 24 * 3600 * 1000;
    await update(ref(db, `rooms/${roomCode}/bank/${uid}/card`), { usedAmount: used + amount, dueAt, updatedAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/tx`), { type: "card_use", title: label || "카드 결제", amount: -amount, beforeCash: 0, afterCash: 0, memo: "게임머니 카드 결제(청구 예정)", createdAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/messages`), { type: "card", title: "STONK Card 결제", body: `${label || "카드 결제"} ${amount.toLocaleString("ko-KR")}원이 카드로 결제되었습니다(청구 예정).`, amount: -amount, relatedId: "", read: false, actionLabel: "", actionUrl: "", createdAt: now });
    return amount;
  } catch (e) { console.warn("[arcade] 카드 결제 실패:", e); return -1; }
}

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
