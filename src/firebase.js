import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// ★ 기존 STONK Battle/Home에서 쓰던 Firebase 설정을 그대로 붙여넣으세요.
// databaseURL이 반드시 있어야 Realtime Database와 연동됩니다.
export const firebaseConfig = {
  apiKey: '여기에-apiKey',
  authDomain: '여기에-authDomain',
  databaseURL: '여기에-databaseURL',
  projectId: '여기에-projectId',
  storageBucket: '여기에-storageBucket',
  messagingSenderId: '여기에-messagingSenderId',
  appId: '여기에-appId'
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
