-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Health Knowledges (คลังความรู้)
CREATE TABLE IF NOT EXISTS health_knowledges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  video_url TEXT,
  image_url TEXT,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_enabled BOOLEAN NOT NULL DEFAULT TRUE;

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
