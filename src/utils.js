export function normalizeRoomCode(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();
}

export function getUrlRoomCode() {
  const params = new URLSearchParams(location.search);
  return normalizeRoomCode(params.get('room') || params.get('roomCode') || params.get('code'));
}

export function getStoredRoomCode(keys) {
  for (const key of keys) {
    const value = normalizeRoomCode(localStorage.getItem(key));
    if (value) return value;
  }
  return '';
}

export function saveRoomCode(roomCode, keys) {
  const normalized = normalizeRoomCode(roomCode);
  if (!normalized) return;
  for (const key of keys) localStorage.setItem(key, normalized);
}

export function formatWon(value) {
  const n = Math.trunc(Number(value) || 0);
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function clampNumber(value, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function shortUid(uid) {
  if (!uid) return '-';
  return `${uid.slice(0, 5)}…${uid.slice(-4)}`;
}

export function nowText() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
