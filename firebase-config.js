// JolSapari Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsX2R6uMdzBdhTVUe9Je7_VHds3Sp3rw4",
  authDomain: "jolsapari.firebaseapp.com",
  projectId: "jolsapari",
  storageBucket: "jolsapari.firebasestorage.app",
  messagingSenderId: "346731383742",
  appId: "1:346731383742:web:551c57e2652a0389b487ef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy };
