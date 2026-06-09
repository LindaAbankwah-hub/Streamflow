CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  raw_s3_key    TEXT,
  status        TEXT DEFAULT 'uploading',
  duration_secs INT,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_renditions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id     UUID REFERENCES videos(id) ON DELETE CASCADE,
  quality      TEXT NOT NULL,
  playlist_key TEXT NOT NULL,
  bandwidth    INT,
  width        INT,
  height       INT
);

CREATE TABLE watch_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id),
  video_id       UUID REFERENCES videos(id),
  session_id     TEXT,
  position_secs  FLOAT,
  quality        TEXT,
  bandwidth_kbps INT,
  event_type     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON watch_events (video_id, created_at);
CREATE INDEX ON watch_events (user_id, created_at);

CREATE TABLE video_analytics (
  video_id      UUID PRIMARY KEY REFERENCES videos(id),
  total_views   INT DEFAULT 0,
  avg_watch_pct FLOAT DEFAULT 0,
  drop_off_json JSONB,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subtitles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID REFERENCES videos(id) ON DELETE CASCADE,
  language   TEXT DEFAULT 'en',
  vtt_s3_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
