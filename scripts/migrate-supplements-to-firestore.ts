import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const envText = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envText.match(/DATABASE_URL=([^\r\n]+)/);
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: "AIzaSyBKLSIGyGCXu0IhLzUgRHVXrgHkVv-55FU",
  authDomain: "fitjourneythailand.firebaseapp.com",
  projectId: "fitjourneythailand",
  storageBucket: "fitjourneythailand.firebasestorage.app",
  messagingSenderId: "971236941563",
  appId: "1:971236941563:web:cb44dfbd76f7b1fed6da5e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sql = neon(dbUrlMatch[1]);

async function migrate() {
  console.log('--- Starting Migration from Neon to Firestore ---');

  // 1. Fetch supplements
  const supplements = await sql`SELECT * FROM supplements`;
  console.log(`Found ${supplements.length} supplements in Neon.`);

  const suppBatch = writeBatch(db);
  for (const s of supplements) {
    const ref = doc(db, 'supplements', s.id);
    suppBatch.set(ref, {
      id: s.id,
      name: s.name,
      imageUrl: s.image_url,
      price: Number(s.price),
      contentQuantity: Number(s.content_quantity),
      contentUnit: s.content_unit,
      isActive: Boolean(s.is_active),
      createdBy: s.created_by,
      updatedBy: s.updated_by,
      archivedBy: s.archived_by || null,
      createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
      updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
      archivedAt: s.archived_at ? new Date(s.archived_at).toISOString() : null,
    });
  }
  await suppBatch.commit();
  console.log(`✅ Successfully wrote ${supplements.length} supplements to Firestore.`);

  // 2. Fetch courses and items
  const courses = await sql`SELECT * FROM supplement_courses ORDER BY created_at ASC`;
  const items = await sql`SELECT * FROM supplement_course_items ORDER BY sort_order ASC`;
  console.log(`Found ${courses.length} courses and ${items.length} items in Neon.`);

  const itemsByCourseId = new Map<string, any[]>();
  for (const item of items) {
    const list = itemsByCourseId.get(item.course_id) || [];
    list.push({
      id: item.id,
      supplementId: item.supplement_id,
      supplementName: item.supplement_name,
      imageUrl: item.image_url,
      contentQuantity: Number(item.content_quantity),
      contentUnit: item.content_unit,
      unitPrice: Number(item.unit_price),
      packageQuantity: Number(item.package_quantity),
      discountType: item.discount_type,
      discountValue: Number(item.discount_value),
      grossAmount: Number(item.gross_amount),
      discountAmount: Number(item.discount_amount),
      netAmount: Number(item.net_amount),
      sortOrder: Number(item.sort_order),
    });
    itemsByCourseId.set(item.course_id, list);
  }

  const courseBatch = writeBatch(db);
  for (const c of courses) {
    const ref = doc(db, 'supplementCourses', c.id);
    const courseItems = itemsByCourseId.get(c.id) || [];
    courseBatch.set(ref, {
      id: c.id,
      trainerId: c.trainer_id,
      trainerName: c.trainer_name,
      traineeId: c.trainee_id,
      traineeName: c.trainee_name,
      subtotal: Number(c.subtotal),
      discountTotal: Number(c.discount_total),
      total: Number(c.total),
      cashbackPercent: Number(c.cashback_percent || 0),
      cashbackAmount: Number(c.cashback_amount || 0),
      items: courseItems,
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      updatedAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    });
  }
  await courseBatch.commit();
  console.log(`✅ Successfully wrote ${courses.length} courses to Firestore.`);
  console.log('--- Migration Finished Successfully ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
