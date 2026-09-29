import { sql } from './api/_db.js';

async function main() {
  try {
    const rows = await sql`SELECT * FROM pending_food_images_v2 ORDER BY created_at DESC LIMIT 10`;
    console.log("Pending images:", rows);
    
    const errors = await sql`SELECT * FROM pending_food_images_v2 WHERE chat_id LIKE 'C%' LIMIT 5`;
    console.log("Group pending images:", errors);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
