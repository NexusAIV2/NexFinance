import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  Firestore
} from "firebase/firestore";

// ─── Environment-based Configuration for Firebase Project: nexfinance-9d94e ────
export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const FIREBASE_CONFIG: FirebaseConfigOptions = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyDWdg60O3-HboeQVYOGTFjdaw8Z39u4roo",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "nexfinance-9d94e.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "nexfinance-9d94e",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "nexfinance-9d94e.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "517017077586",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:517017077586:web:33b446ab37d5cc2b9a1c8b",
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || "G-YSDWNKRX0T",
};

// ─── Firebase App & Service Instances ──────────────────────────────────────────
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _ready = false;

export function initFirebase() {
  try {
    if (getApps().length === 0) {
      _app = initializeApp(FIREBASE_CONFIG);
    } else {
      _app = getApp();
    }
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _ready = true;

    return { app: _app, auth: _auth, db: _db };
  } catch (err) {
    console.error("[Firebase] Initialization error:", err);
    _app = null; _auth = null; _db = null; _ready = false;
    return { app: null, auth: null, db: null };
  }
}

// Module load initialization using env server web variables
initFirebase();

export function isFirebaseReady() { return _ready; }

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Authentication Helpers ────────────────────────────────────────────────────
export async function registerWithEmail(email: string, pass: string, fullName: string) {
  if (!_auth || !_db) throw new Error("Firebase tidak terkonfigurasi. Masukkan API Key di Settings.");
  const userCred = await createUserWithEmailAndPassword(_auth, email, pass);
  const user = userCred.user;

  if (user) {
    await setDoc(doc(_db, "users", user.uid), {
      id: user.uid,
      email: user.email,
      fullName: fullName || user.displayName || email.split("@")[0],
      currency: "IDR",
      createdAt: new Date().toISOString(),
      loginCount: 1,
    });
  }

  return user;
}

export async function loginWithEmail(email: string, pass: string) {
  if (!_auth || !_db) throw new Error("Firebase tidak terkonfigurasi. Masukkan API Key di Settings.");
  const userCred = await signInWithEmailAndPassword(_auth, email, pass);
  const user = userCred.user;

  if (user) {
    const userDocRef = doc(_db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      await setDoc(userDocRef, { ...data, lastLoginAt: new Date().toISOString(), loginCount: (data.loginCount || 0) + 1 }, { merge: true });
    }
  }

  return user;
}

export async function loginWithGoogle() {
  if (!_auth || !_db) throw new Error("Firebase tidak terkonfigurasi. Masukkan API Key di Settings.");
  const result = await signInWithPopup(_auth, googleProvider);
  const user = result.user;

  if (user) {
    const userDocRef = doc(_db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email,
        fullName: user.displayName || user.email?.split("@")[0] || "User",
        currency: "IDR",
        avatarUrl: user.photoURL || undefined,
        createdAt: new Date().toISOString(),
        loginCount: 1,
      });
    } else {
      const data = snap.data();
      await setDoc(userDocRef, { ...data, lastLoginAt: new Date().toISOString(), loginCount: (data.loginCount || 0) + 1 }, { merge: true });
    }
  }

  return user;
}

export async function logoutFirebase() {
  if (!_auth) return;
  await signOut(_auth);
}

export function subscribeAuthState(callback: (user: FirebaseUser | null) => void) {
  if (!_auth) {
    // No Firebase — call callback immediately with null, return no-op unsubscribe
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, callback);
}

// ─── Firestore Database CRUD Helpers ───────────────────────────────────────────
export async function getFirebaseUserTransactions(userId: string) {
  if (!_db) return [];
  const q = query(collection(_db, "transactions"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach(d => list.push({ ...d.data(), id: d.id }));
  return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

export async function saveFirebaseTransaction(userId: string, tx: any) {
  if (!_db) return null;
  const txId = tx.id || Date.now().toString();
  const txRef = doc(_db, "transactions", txId);
  const data = { ...tx, id: txId, userId, updatedAt: new Date().toISOString() };
  await setDoc(txRef, data, { merge: true });
  return data;
}

export async function deleteFirebaseTransaction(txId: string) {
  if (!_db) return;
  await deleteDoc(doc(_db, "transactions", txId));
}

export async function getFirebaseUserBudgets(userId: string) {
  if (!_db) return [];
  const q = query(collection(_db, "budgets"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach(d => list.push({ ...d.data(), id: d.id }));
  return list;
}

export async function saveFirebaseBudget(userId: string, budget: any) {
  if (!_db) return null;
  const bId = budget.id || Date.now().toString();
  const bRef = doc(_db, "budgets", bId);
  const data = { ...budget, id: bId, userId, updatedAt: new Date().toISOString() };
  await setDoc(bRef, data, { merge: true });
  return data;
}

export async function deleteFirebaseBudget(bId: string) {
  if (!_db) return;
  await deleteDoc(doc(_db, "budgets", bId));
}

export async function getFirebaseUserSchedules(userId: string) {
  if (!_db) return [];
  const q = query(collection(_db, "schedules"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach(d => list.push({ ...d.data(), id: d.id }));
  return list;
}

export async function saveFirebaseSchedule(userId: string, event: any) {
  if (!_db) return null;
  const eId = event.id || Date.now().toString();
  const eRef = doc(_db, "schedules", eId);
  const data = { ...event, id: eId, userId, updatedAt: new Date().toISOString() };
  await setDoc(eRef, data, { merge: true });
  return data;
}

export async function deleteFirebaseSchedule(eId: string) {
  if (!_db) return;
  await deleteDoc(doc(_db, "schedules", eId));
}

// ─── Bulk Migration from Local to Firestore ─────────────────────────────────────
export async function migrateLocalDbToFirestore(
  userId: string,
  localData: { transactions?: any[]; budget?: any[]; events?: any[] }
) {
  if (!_db) {
    return { success: false, error: "Firebase tidak terkonfigurasi.", migrated: { transactions: 0, budgets: 0, schedules: 0 } };
  }

  let txCount = 0, bgCount = 0, scCount = 0;
  try {
    if (localData.transactions) {
      for (const t of localData.transactions) { await saveFirebaseTransaction(userId, t); txCount++; }
    }
    if (localData.budget) {
      for (const b of localData.budget) { await saveFirebaseBudget(userId, b); bgCount++; }
    }
    if (localData.events) {
      for (const s of localData.events) { await saveFirebaseSchedule(userId, s); scCount++; }
    }
    return { success: true, migrated: { transactions: txCount, budgets: bgCount, schedules: scCount } };
  } catch (err: any) {
    return { success: false, error: err.message, migrated: { transactions: txCount, budgets: bgCount, schedules: scCount } };
  }
}
