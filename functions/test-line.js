const admin = require('firebase-admin');
admin.initializeApp({ projectId: "fitjourneythailand" });
const db = admin.firestore();
async function run() {
  const t = await db.collection('trainers').get();
  t.forEach(doc => console.log(doc.data().lineName, doc.data().trainerId));
}
run();
