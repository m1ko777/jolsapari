// ===================================================
// JolSapari — Firebase Firestore интеграциясы
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Сіздің Firebase конфигурациясы ----
const firebaseConfig = {
  apiKey: "AIzaSyCsX2R6uMdzBdhTVUe9Je7_VHds3Sp3rw4",
  authDomain: "jolsapari.firebaseapp.com",
  projectId: "jolsapari",
  storageBucket: "jolsapari.firebasestorage.app",
  messagingSenderId: "346731383742",
  appId: "1:346731383742:web:551c57e2652a0389b487ef",
  measurementId: "G-BQN5WH6ZQY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===================================================
// FIRESTORE DB FUNCTIONS
// ===================================================

// --- BUSES ---
export async function getBuses() {
  const snap = await getDocs(collection(db, 'buses'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addBusDB(bus) {
  return await addDoc(collection(db, 'buses'), bus);
}
export async function updateBusDB(id, data) {
  return await updateDoc(doc(db, 'buses', id), data);
}
export async function deleteBusDB(id) {
  return await deleteDoc(doc(db, 'buses', id));
}

// --- TRIPS ---
export async function getTrips() {
  const snap = await getDocs(query(collection(db, 'trips'), orderBy('date'), orderBy('dep')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addTripDB(trip) {
  return await addDoc(collection(db, 'trips'), trip);
}
export async function deleteTripDB(id) {
  return await deleteDoc(doc(db, 'trips', id));
}

// --- BOOKINGS ---
export async function getBookings() {
  const snap = await getDocs(query(collection(db, 'bookings'), orderBy('ts', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addBookingDB(booking) {
  return await addDoc(collection(db, 'bookings'), booking);
}
export async function updateBookingDB(id, data) {
  return await updateDoc(doc(db, 'bookings', id), data);
}

// --- SETTINGS ---
export async function getSettings() {
  const snap = await getDoc(doc(db, 'settings', 'main'));
  return snap.exists() ? snap.data() : {};
}
export async function saveSettingsDB(data) {
  return await setDoc(doc(db, 'settings', 'main'), data);
}

// --- REALTIME LISTENER (брондаулар өзгерсе сразу жаңартады) ---
export function listenBookings(tripId, callback) {
  const q = query(collection(db, 'bookings'), where('tripId', '==', tripId));
  return onSnapshot(q, snap => {
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bookings);
  });
}

export { db };
