# STONK Arcade v1.0.0

Battle에서 번 게임머니를 사용하는 STONK 미니게임 사이트입니다.

## 게임

- 폭탄 피하기: 5x5, 폭탄 3개, 중간 회수 가능
- 하이로우: 현재 카드보다 다음 카드가 높을지 낮을지 맞히기
- 슬롯머신: 3칸 슬롯, 2개/3개 일치 보상

## 랜덤 방식

`src/random.js`에서 `crypto.getRandomValues()`를 우선 사용합니다.  
각 게임은 매판 시작/실행 시 새 랜덤 결과를 생성합니다.

## Firebase 경로

```txt
rooms/{roomCode}/players/{uid}/cash
rooms/{roomCode}/players/{uid}/nickname
rooms/{roomCode}/arcadeLogs/{logId}
rooms/{roomCode}/arcadeStats/{uid}
```

## 설정

`src/firebase.js`에 기존 STONK Firebase config를 붙여넣으세요.

```js
export const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  databaseURL: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...'
};
```

Authentication에서 익명 로그인을 켜고, Realtime Database를 사용해야 합니다.

## 실행

```bat
cd /d C:\Users\내곡시설\Downloads\STONK-Arcade-v1
npm install
npm run dev
```

## 빌드

```bat
npm run build
```

## 배포

```bat
npm run deploy
```

## Home 연결 예시

```html
<a href="../STONK-Arcade/index.html?room=방코드">Arcade 입장</a>
```

방 코드는 `?room=` 또는 `?roomCode=`를 지원합니다.
