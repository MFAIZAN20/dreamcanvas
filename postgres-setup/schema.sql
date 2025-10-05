-- DreamCanvas Database Schema
CREATE TABLE IF NOT EXISTS dreams (
  id SERIAL PRIMARY KEY,
  user_id INT DEFAULT 1,
  title VARCHAR(255),
  prompt TEXT,
  story TEXT,
  image_url TEXT,
  tags TEXT,
  likes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) DEFAULT 'DreamUser',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default user
INSERT INTO users (id, username) 
VALUES (1, 'DreamUser') 
ON CONFLICT (id) DO NOTHING;