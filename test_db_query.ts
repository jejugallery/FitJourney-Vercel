import { sql } from './api/_db.ts';

async function main() {
  try {
    const rows = await sql`SELECT * FROM pending_food_images_v2 ORDER BY created_at DESC LIMIT 10`;
    console.log("Pending images:", rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
