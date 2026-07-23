import { sql } from './_db.js';

let schemaPromise: Promise<void> | null = null;

export function ensureSupplementSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS supplements (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, image_url TEXT NOT NULL,
        price NUMERIC(12,2) NOT NULL CHECK (price > 0), content_quantity INTEGER NOT NULL CHECK (content_quantity > 0),
        content_unit TEXT NOT NULL CHECK (content_unit IN ('เม็ด','ช้อน','ซอง','ใบ')), is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        archived_by TEXT, archived_at TIMESTAMP WITH TIME ZONE
      )`;
      await sql`CREATE TABLE IF NOT EXISTS supplement_courses (
        id TEXT PRIMARY KEY, trainer_id TEXT NOT NULL, trainer_name TEXT NOT NULL, trainee_id TEXT NOT NULL,
        trainee_name TEXT NOT NULL, subtotal NUMERIC(12,2) NOT NULL, discount_total NUMERIC(12,2) NOT NULL,
        total NUMERIC(12,2) NOT NULL, cashback_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        cashback_amount NUMERIC(12,2) NOT NULL DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`;
      await sql`CREATE TABLE IF NOT EXISTS supplement_course_items (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES supplement_courses(id) ON DELETE CASCADE,
        supplement_id TEXT NOT NULL, supplement_name TEXT NOT NULL, image_url TEXT NOT NULL, content_quantity INTEGER NOT NULL,
        content_unit TEXT NOT NULL, unit_price NUMERIC(12,2) NOT NULL, package_quantity INTEGER NOT NULL CHECK (package_quantity > 0),
        discount_type TEXT NOT NULL, discount_value NUMERIC(12,2) NOT NULL, gross_amount NUMERIC(12,2) NOT NULL,
        discount_amount NUMERIC(12,2) NOT NULL, net_amount NUMERIC(12,2) NOT NULL, sort_order INTEGER NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_supplement_courses_trainer_created ON supplement_courses (trainer_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_supplement_courses_trainee ON supplement_courses (trainer_id, trainee_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_supplement_course_items_course ON supplement_course_items (course_id, sort_order)`;
      await sql`ALTER TABLE supplement_courses ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC(5,2) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE supplement_courses ADD COLUMN IF NOT EXISTS cashback_amount NUMERIC(12,2) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE supplements DROP CONSTRAINT IF EXISTS supplements_content_unit_check`;
      await sql`ALTER TABLE supplements ADD CONSTRAINT supplements_content_unit_check CHECK (content_unit IN ('เม็ด','ช้อน','ซอง','ใบ'))`;
    })().catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}
