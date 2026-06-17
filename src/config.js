export const APP_VERSION = '3.1.1';

// 모든 STONK 사이트는 같은 GitHub Pages origin(tom981105-web.github.io)에 배포되어
// 형제 폴더 상대경로로 이동한다. 이동 시 navLink()가 현재 roomCode(?room=)를 붙인다.
export const ROUTES = {
  home: '../STONK-Home/index.html',
  battle: '../STONK-Battle/index.html',
  pulse: '../STONK-Board/index.html',
  wiki: '../STONK-Wiki/index.html',
  gacha: '../STONK-Gacha/index.html'
};

export const WALLET_PATH = (roomCode, uid) => `rooms/${roomCode}/players/${uid}/cash`;
export const PLAYER_PATH = (roomCode, uid) => `rooms/${roomCode}/players/${uid}`;
export const LOGS_PATH = (roomCode) => `rooms/${roomCode}/arcadeLogs`;
export const STATS_PATH = (roomCode, uid) => `rooms/${roomCode}/arcadeStats/${uid}`;

export const BET = {
  min: 1000,
  maxRatio: 0.35,
  fallbackMax: 1000000000
};

export const STORAGE_KEYS = [
  'stonk:lastRoomCode',
  'lastRoomCode',
  'stonkRoomCode',
  'roomCode'
];
