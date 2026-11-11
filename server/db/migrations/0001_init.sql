CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'admin')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price_lei INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE stylists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  stylist_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL
);
CREATE INDEX idx_blocks_stylist_start ON blocks (stylist_id, start_at);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  stylist_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  deposit_lei INTEGER NOT NULL,
  hold_until TEXT,
  refunded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_bookings_stylist_start ON bookings (stylist_id, start_at);
CREATE INDEX idx_bookings_user ON bookings (user_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  card_last4 TEXT,
  external_id TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_payments_booking ON payments (booking_id);

CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX idx_attempts_email_at ON login_attempts (email, at);
CREATE INDEX idx_attempts_ip_at ON login_attempts (ip, at);
