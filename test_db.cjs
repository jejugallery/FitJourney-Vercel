const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf8');
const dbUrl = dotenv.match(/DATABASE_URL=(.*)/)[1];
process.env.DATABASE_URL = dbUrl;

async function main() {
  const { sql } = await import('./api/_db.ts');
  try {
    const rows = await sql`SELECT chat_id, message_id, user_id FROM pending_food_images_v2 ORDER BY created_at DESC LIMIT 5`;
    console.log("Pending images:", rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
