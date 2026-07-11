import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBKLSIGyGCXu0IhLzUgRHVXrgHkVv-55FU",
  authDomain: "fitjourneythailand.firebaseapp.com",
  projectId: "fitjourneythailand",
  storageBucket: "fitjourneythailand.firebasestorage.app",
  messagingSenderId: "971236941563",
  appId: "1:971236941563:web:cb44dfbd76f7b1fed6da5e"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
