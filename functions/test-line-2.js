const admin = require('firebase-admin');
admin.initializeApp({ projectId: "fitjourneythailand" });
const db = admin.firestore();
async function run() {
  const t = await db.collection('trainees').get();
  t.forEach(doc => console.log(doc.data().lineName, doc.data().trainerIds));
}
run();
