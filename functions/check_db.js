const admin = require("firebase-admin");
admin.initializeApp({ projectId: "fitjourneythailand" });
async function check() {
  const snapshot = await admin.firestore().collection("trainees").get();
  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.igUserId) {
      console.log("FOUND igUserId:", data.igUserId, "for trainee:", data.userId);
      found = true;
    }
  });
  if (!found) console.log("NO igUserId found yet.");
}
check().catch(console.error);
