const { sql } = require('@vercel/postgres');
require('dotenv').config();

async function main() {
  try {
    const res = await sql`SELECT * FROM last_analyzed_food LIMIT 1`;
    console.log(res.rows);
  } catch (e) {
    console.error(e.message);
  }
}
main();
