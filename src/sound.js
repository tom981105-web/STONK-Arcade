// src/sound.js — Web Audio 기반 아케이드 효과음 (외부 음원 0, 라이선스 무관)
// 기본 음량 작게, 음소거 토글(localStorage 유지).
const MUTE_KEY = "stonk:soundMuted"; // Gacha 와 공유 키(같은 origin)
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) {}

export function isMuted() { return muted; }
export function setMuted(v) { muted = Boolean(v); try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {} }
export function toggleMuted() { setMuted(!muted); return muted; }

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch (e) { return null; }
}

function tone(freq, dur = 0.12, type = "sine", gain = 0.05, when = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sweep(from, to, dur = 0.4, type = "sawtooth", gain = 0.04) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click() { tone(420, 0.05, "square", 0.035); },
  bet() { tone(640, 0.06, "square", 0.04); },
  insertCoin() { tone(880, 0.07, "square", 0.05); tone(1175, 0.09, "square", 0.04, 0.05); },
  spin() { sweep(220, 520, 0.5, "sawtooth", 0.03); },
  reelStop() { tone(330, 0.05, "square", 0.045); },
  card() { tone(520, 0.04, "triangle", 0.04); },
  reveal() { tone(660, 0.07, "triangle", 0.045); },
  win() { [659, 880].forEach((f, i) => tone(f, 0.12, "triangle", 0.05, i * 0.08)); },
  bigWin() { [659, 880, 1047, 1319].forEach((f, i) => tone(f, 0.16, "triangle", 0.055, i * 0.08)); },
  jackpot() { [784, 988, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.2, "sawtooth", 0.06, i * 0.1)); sweep(500, 2000, 0.7, "sine", 0.04); },
  lose() { tone(240, 0.18, "sawtooth", 0.045); tone(170, 0.26, "sawtooth", 0.04, 0.08); },
  push() { tone(440, 0.12, "sine", 0.04); },
};
