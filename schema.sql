-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Health Knowledges (คลังความรู้)
CREATE TABLE IF NOT EXISTS health_knowledges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  video_url TEXT,
  video_thumbnail_url TEXT,
  description TEXT,
  is_challenge BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES health_knowledges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Appointments (นัดหมาย)
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  datetime TEXT NOT NULL,
  start_datetime_iso TIMESTAMP WITH TIME ZONE,
  end_datetime_display TEXT,
  end_datetime_iso TIMESTAMP WITH TIME ZONE,
  location TEXT,
  description TEXT,
  link_type TEXT,
  link_url TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointment_invitations (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'pending',
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Events (กิจกรรม)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  datetime TEXT NOT NULL,
  start_datetime_iso TIMESTAMP WITH TIME ZONE,
  end_datetime_display TEXT,
  end_datetime_iso TIMESTAMP WITH TIME ZONE,
  location TEXT,
  description TEXT,
  invitation_text TEXT,
  invitation_color TEXT,
  button_color TEXT,
  video_thumbnail_url TEXT,
  created_by TEXT,
  rsvp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rsvp_friend_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_friend_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS event_invitations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'pending',
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id)
);

-- 4. Billings & Payments (การเรียกเก็บเงิน)
CREATE TABLE IF NOT EXISTS billings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  description TEXT,
  invitation_text TEXT,
  invitation_color TEXT,
  button_color TEXT,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_payments (
  billing_id TEXT NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  slip_url TEXT,
  slip_id TEXT,
  friends JSONB DEFAULT '[]'::jsonb,
  slips JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (billing_id, user_id)
);

CREATE TABLE IF NOT EXISTS used_slips (
  slip_id TEXT PRIMARY KEY,
  billing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  slip_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_accounts (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, id)
);

-- 5. Supplement catalog and trainer-created courses
CREATE TABLE IF NOT EXISTS supplements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  content_quantity INTEGER NOT NULL CHECK (content_quantity > 0),
  content_unit TEXT NOT NULL CHECK (content_unit IN ('เม็ด', 'ช้อน', 'ซอง', 'ใบ')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS supplement_courses (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  trainee_id TEXT NOT NULL,
  trainee_name TEXT NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount_total NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  cashback_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  cashback_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplement_course_items (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES supplement_courses(id) ON DELETE CASCADE,
  supplement_id TEXT NOT NULL,
  supplement_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  content_quantity INTEGER NOT NULL,
  content_unit TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  package_quantity INTEGER NOT NULL CHECK (package_quantity > 0),
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12, 2) NOT NULL,
  gross_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplement_courses_trainer_created
  ON supplement_courses (trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_courses_trainee
  ON supplement_courses (trainer_id, trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_course_items_course
  ON supplement_course_items (course_id, sort_order);

ALTER TABLE supplement_courses ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE supplement_courses ADD COLUMN IF NOT EXISTS cashback_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE supplements DROP CONSTRAINT IF EXISTS supplements_content_unit_check;
ALTER TABLE supplements ADD CONSTRAINT supplements_content_unit_check CHECK (content_unit IN ('เม็ด', 'ช้อน', 'ซอง', 'ใบ'));
