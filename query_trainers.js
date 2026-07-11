import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Using the config from src/firebase.ts but in node script
import fs from 'fs';
const firebaseConfigContent = fs.readFileSync('src/firebase.ts', 'utf8');
const configMatch = firebaseConfigContent.match(/const firebaseConfig = ({[\s\S]*?});/);
if (configMatch) {
  const firebaseConfig = eval("(" + configMatch[1] + ")");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  getDocs(collection(db, "trainers")).then(snap => {
    snap.docs.forEach(d => {
      console.log(d.id, "=>", d.data().status, "userId:", d.data().userId, "name:", d.data().nickname || d.data().displayName);
    });
    process.exit(0);
  });
}
