// src/homeGate.js — STONK Home 중심 진입 게이트 (PHASE 3, ESM 공용)
// ───────────────────────────────────────────────────────────────────
// 목적: Battle/Arcade/Gacha 직접 접속 시, roomCode/로그인 세션이 없으면
//   "STONK Home에서 입장해 주세요" 게이트를 띄우고 Home 으로 안내(자동 이동).
//   로그인/방선택/닉네임의 중심을 Home 으로 옮기되, 기존 기능은 삭제하지 않는다.
// 이 파일은 battle/arcade/gacha 의 src 에 동일 내용으로 복제된다.

const HOME_URL = "../STONK-Home/index.html";
const LAST_ROOM = "stonk:lastRoomCode";
const SESSION_READY = "stonk:homeSessionReady";
const LEGACY_ROOM_KEYS = ["mb_roomCode", "mb-board-room", "wiki-room", "lastRoomCode", "roomCode"];
const REDIRECT_MS = 2600;

export function normalizeRoomCode(c) {
  return String(c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// URL ?room= → localStorage(stonk:lastRoomCode → 레거시) 순으로 방 코드 결정
export function getEntryRoomCode() {
  try {
    const p = new URLSearchParams(location.search);
    const u = normalizeRoomCode(p.get("room") || p.get("roomCode") || p.get("roomId") || "");
    if (u) return u;
  } catch (e) {}
  try {
    const main = normalizeRoomCode(localStorage.getItem(LAST_ROOM) || "");
    if (main) return main;
    for (const k of LEGACY_ROOM_KEYS) {
      const v = normalizeRoomCode(localStorage.getItem(k) || "");
      if (v) return v;
    }
  } catch (e) {}
  return "MAIN"; // 단일 방 운영: 방 코드 없으면 고정 방
}

export function isHomeSessionReady() {
  try { return localStorage.getItem(SESSION_READY) === "true"; } catch (e) { return false; }
}

export function isLocalDev() {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
}

export function homeUrl(roomCode) {
  const c = normalizeRoomCode(roomCode);
  return HOME_URL + (c ? `?room=${encodeURIComponent(c)}` : "");
}

// 전체 화면 게이트 오버레이 + (배포 환경) 자동 이동. 인라인 스타일이라 어느 사이트에서도 동작.
export function showHomeGate({ title = "STONK Home에서 입장해 주세요", message = "", roomCode = "", auto = true } = {}) {
  const url = homeUrl(roomCode);
  const old = document.getElementById("stonk-home-gate");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.id = "stonk-home-gate";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  Object.assign(wrap.style, {
    position: "fixed", inset: "0", zIndex: "99999", display: "grid", placeItems: "center",
    padding: "24px", background: "radial-gradient(120% 90% at 50% -10%, rgba(139,108,255,0.22), transparent 60%), rgba(5,6,10,0.94)",
    backdropFilter: "blur(8px)", color: "#f4f7ff",
    fontFamily: "Pretendard, Inter, 'Noto Sans KR', system-ui, sans-serif",
  });
  const auto2 = auto && !isLocalDev();
  wrap.innerHTML = `
    <div style="width:min(460px,100%);text-align:center;padding:32px 26px;border:1px solid rgba(255,255,255,0.14);border-radius:18px;background:rgba(14,16,24,0.92);box-shadow:0 24px 70px rgba(0,0,0,0.5),0 0 60px rgba(139,108,255,0.16)">
      <div style="font-size:13px;font-weight:900;letter-spacing:2px;color:#8b6cff;margin-bottom:8px">STONK UNIVERSE</div>
      <h2 style="margin:0 0 10px;font-size:1.5rem">${title}</h2>
      <p style="margin:0 0 18px;color:#aab2c8;font-size:0.95rem;line-height:1.5">${message || "로그인 · 방 선택 · 닉네임 설정은 STONK Home에서 진행합니다."}</p>
      <a data-home-go href="${url}" style="display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 26px;border-radius:14px;font-weight:900;text-decoration:none;color:#0a0a12;background:linear-gradient(135deg,#a99bff,#8b6cff);box-shadow:0 10px 30px rgba(139,108,255,0.4)">STONK Home으로 이동</a>
      ${roomCode ? `<div style="margin-top:14px;font-size:0.82rem;color:#8a93a8">방 코드 <b style="color:#41e0ff;letter-spacing:2px">${roomCode}</b> 유지</div>` : ""}
      ${auto2 ? `<div style="margin-top:12px;font-size:0.8rem;color:#8a93a8"><span data-gate-count>${Math.ceil(REDIRECT_MS / 1000)}</span>초 후 자동 이동…</div>` : `<div style="margin-top:12px;font-size:0.78rem;color:#5f6678">개발 모드: 자동 이동 없음</div>`}
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("[data-home-go]")?.addEventListener("click", (e) => { e.preventDefault(); location.href = url; });

  if (auto2) {
    let left = Math.ceil(REDIRECT_MS / 1000);
    const countEl = wrap.querySelector("[data-gate-count]");
    const iv = setInterval(() => {
      left -= 1;
      if (countEl) countEl.textContent = String(Math.max(0, left));
      if (left <= 0) clearInterval(iv);
    }, 1000);
    setTimeout(() => { location.href = url; }, REDIRECT_MS);
  }
  return wrap;
}

export function hideHomeGate() {
  document.getElementById("stonk-home-gate")?.remove();
}
