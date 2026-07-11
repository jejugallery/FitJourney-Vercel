import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from 'fs';
const firebaseConfigContent = fs.readFileSync('src/firebase.ts', 'utf8');
const configMatch = firebaseConfigContent.match(/const firebaseConfig = ({[\s\S]*?});/);
if (configMatch) {
  const firebaseConfig = eval("(" + configMatch[1] + ")");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  getDocs(query(collection(db, "trainers"), limit(1))).then(snap => {
    snap.docs.forEach(d => {
      console.log("Keys:", Object.keys(d.data()));
      console.log("trainerId:", d.data().trainerId);
    });
    process.exit(0);
  });
}
