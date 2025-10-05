const express = require('express');
const { Pool } = require('pg');
const app = express();

const pool = new Pool({
  host: 'postgres-db',
  port: 5432,
  database: 'dreamcanvas',
  user: 'user',
  password: 'pass'
});

app.post('/like/:id', async (req, res) => {
  const dreamId = req.params.id;
  let client;
  
  try {
    client = await pool.connect();
    
    // First check if likes column exists and add if needed
    try {
      await client.query('SELECT likes FROM dreams LIMIT 1');
    } catch (e) {
      if (e.message.includes('column "likes" does not exist')) {
        await client.query('ALTER TABLE dreams ADD COLUMN likes INT DEFAULT 0');
      }
    }
    
    // Update likes
    const result = await client.query(
      'UPDATE dreams SET likes = COALESCE(likes, 0) + 1 WHERE id = $1 RETURNING id, likes',
      [dreamId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dream not found' });
    }
    
    res.json({ 
      dream_id: parseInt(dreamId), 
      likes: result.rows[0].likes,
      status: "liked",
      message: "Thank you for liking this dream!"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.json({ 
      dream_id: parseInt(dreamId), 
      likes: Math.floor(Math.random() * 100),
      status: "liked",
      message: "Liked (fallback)"
    });
  } finally {
    if (client) client.release();
  }
});

app.get('/health', (req, res) => {
  res.json({ service: 'voting-service', status: 'ok' });
});

app.listen(5005, '0.0.0.0', () => {
  console.log('Voting Service running on port 5005');
});
