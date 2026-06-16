export const APP_VERSION = '1.0.0';

export const ROUTES = {
  home: '../STONK-Home/index.html',
  battle: '../STONK-Battle/index.html',
  pulse: '../STONK-Board/index.html',
  wiki: '../STONK-Wiki/index.html'
};

export const WALLET_PATH = (roomCode, uid) => `rooms/${roomCode}/players/${uid}/cash`;
export const PLAYER_PATH = (roomCode, uid) => `rooms/${roomCode}/players/${uid}`;
export const LOGS_PATH = (roomCode) => `rooms/${roomCode}/arcadeLogs`;
export const STATS_PATH = (roomCode, uid) => `rooms/${roomCode}/arcadeStats/${uid}`;

export const BET = {
  min: 1000,
  maxRatio: 0.5,
  fallbackMax: 1000000000
};

export const STORAGE_KEYS = [
  'stonk:lastRoomCode',
  'lastRoomCode',
  'stonkRoomCode',
  'roomCode'
];
