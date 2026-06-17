import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// ★ 기존 STONK Battle/Home에서 쓰던 Firebase 설정을 그대로 붙여넣으세요.
// databaseURL이 반드시 있어야 Realtime Database와 연동됩니다.
export const firebaseConfig = {
apiKey: "AIzaSyARFa-vzKVmIdxP5xDRXVzasL2ui94eZ-w",
  authDomain: "market-6e66a.firebaseapp.com",
  databaseURL: "https://market-6e66a-default-rtdb.firebaseio.com",
  projectId: "market-6e66a",
  storageBucket: "market-6e66a.firebasestorage.app",
  messagingSenderId: "402312269082",
  appId: "1:402312269082:web:cf304afc54057ea162b0a3",
};

export const isConfigured =
  Boolean(firebaseConfig.apiKey) &&
  !String(firebaseConfig.apiKey).startsWith('여기에') &&
  Boolean(firebaseConfig.databaseURL) &&
  !String(firebaseConfig.databaseURL).startsWith('여기에');

let app;
let auth;
let db;

export function getFirebase() {
  if (!isConfigured) {
    throw new Error('Firebase 설정이 비어 있습니다. src/firebase.js에 기존 STONK Firebase config를 붙여넣으세요.');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  }
  return { app, auth, db };
}

// PHASE 3: 익명 로그인을 새로 만들지 않고, 현재(또는 복원되는) 세션만 1회 확인한다.
// 기존 STONK Home/Battle 이메일 세션이 같은 origin 에서 복원되면 그 유저를 돌려준다.
export function getCurrentUserOnce() {
  const { auth } = getFirebase();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user || null); }, () => resolve(null));
  });
}

export async function ensureAnonymousUser() {
  const { auth } = getFirebase();
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    let done = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (done) return;
      if (user) {
        done = true;
        unsub();
        resolve(user);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        done = true;
        unsub();
        resolve(credential.user);
      } catch (error) {
        done = true;
        unsub();
        reject(error);
      }
    }, reject);
  });
}
