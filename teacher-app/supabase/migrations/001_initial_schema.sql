-- ============================================================
-- Online Course Platform — Initial Schema
-- Run via: Supabase SQL Editor or supabase db push
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- User Profiles (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'student'
              CHECK (role IN ('student', 'teacher', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- ============================================================
-- Courses
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  thumbnail    TEXT,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Sections
-- ============================================================
CREATE TABLE IF NOT EXISTS sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Lessons (with metadata fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id       UUID REFERENCES sections(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  position         INT NOT NULL DEFAULT 0,
  is_preview       BOOLEAN DEFAULT FALSE,     -- Accessible without enrollment
  duration_seconds INT,                        -- Populated after video processing
  thumbnail_url    TEXT,                       -- R2 key for lesson thumbnail.jpg
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Videos (fMP4 HLS, adaptive bitrate — 4 qualities)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id           UUID UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  r2_folder           TEXT NOT NULL,           -- e.g. courses/{course_id}/{lesson_id}/
  master_playlist_key TEXT,                    -- master.m3u8 key in PROD bucket
  duration_seconds    INT,
  status              TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','ready','failed')),
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Video Jobs (BullMQ job metadata mirror — for status polling)
-- ============================================================
CREATE TABLE IF NOT EXISTS video_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id     UUID REFERENCES videos(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES lessons(id),
  course_id    UUID REFERENCES courses(id),
  temp_r2_key  TEXT NOT NULL,                  -- Raw MP4 in TEMP bucket
  status       TEXT DEFAULT 'queued'
               CHECK (status IN ('queued','processing','done','failed')),
  error_message TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER video_jobs_updated_at
  BEFORE UPDATE ON video_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'active'
              CHECK (status IN ('active','expired','revoked')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- ============================================================
-- Payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID REFERENCES user_profiles(id),
  course_id    UUID REFERENCES courses(id),
  amount       NUMERIC(10,2) NOT NULL,
  currency     TEXT DEFAULT 'USD',
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','completed','failed','refunded')),
  provider     TEXT,     -- 'stripe' | 'manual'
  provider_ref TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Video Progress
-- ============================================================
CREATE TABLE IF NOT EXISTS video_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
  watched_seconds INT DEFAULT 0,
  completed       BOOLEAN DEFAULT FALSE,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, lesson_id)
);

-- ============================================================
-- Device Sessions (max 3 per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,         -- Browser fingerprint hash
  ip_address   INET,
  user_agent   TEXT,
  session_id   UUID,                  -- Supabase auth session ID
  last_active  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- ============================================================
-- Video Sessions (piracy audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS video_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  lesson_id  UUID REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  ip_address INET,
  device_id  TEXT
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_student ON video_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_lesson  ON video_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_user    ON video_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_lesson  ON video_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section        ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_sections_course        ON sections(course_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user   ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status      ON video_jobs(status, created_at);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs       ENABLE ROW LEVEL SECURITY;

-- ---- user_profiles ----
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ---- courses (public read for published) ----
CREATE POLICY "Anyone can read published courses"
  ON courses FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Teachers can manage own courses"
  ON courses FOR ALL USING (
    teacher_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- sections / lessons ----
CREATE POLICY "Anyone can read sections of published courses"
  ON sections FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND is_published = TRUE)
  );
CREATE POLICY "Teachers can manage sections of own courses"
  ON sections FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read lessons of published courses"
  ON lessons FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sections s
      JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND c.is_published = TRUE
    )
  );
CREATE POLICY "Teachers can manage lessons of own courses"
  ON lessons FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sections s
      JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- videos (NO direct student access — only via signed URL API) ----
CREATE POLICY "Teachers and admins can manage videos"
  ON videos FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- enrollments ----
CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins can manage all enrollments"
  ON enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- video_progress ----
CREATE POLICY "Students can manage own progress"
  ON video_progress FOR ALL USING (student_id = auth.uid());

-- ---- device_sessions ----
CREATE POLICY "Users can manage own device sessions"
  ON device_sessions FOR ALL USING (user_id = auth.uid());

-- ---- video_sessions ----
CREATE POLICY "Users can insert own video sessions"
  ON video_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own video sessions"
  ON video_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can view all video sessions"
  ON video_sessions FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Future Schema Stubs (planned, not implemented in v1)
-- ============================================================
-- CREATE TABLE live_sessions (id UUID, course_id UUID, scheduled_at TIMESTAMPTZ, stream_key TEXT, status TEXT);
-- CREATE TABLE quizzes       (id UUID, lesson_id UUID, questions JSONB);
-- CREATE TABLE quiz_attempts (id UUID, student_id UUID, quiz_id UUID, score INT, submitted_at TIMESTAMPTZ);
-- CREATE TABLE certificates  (id UUID, student_id UUID, course_id UUID, issued_at TIMESTAMPTZ, url TEXT);
-- CREATE TABLE chat_messages (id UUID, course_id UUID, user_id UUID, message TEXT, created_at TIMESTAMPTZ);
