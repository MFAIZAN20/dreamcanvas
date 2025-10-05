const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());

// PostgreSQL connection with optimized settings
const pool = new Pool({
  host: 'postgres-db',
  port: 5432,
  database: 'dreamcanvas',
  user: 'user',
  password: 'pass',
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting a client
  acquireTimeoutMillis: 2000, // How long to wait to get a connection from the pool
});

// Initialize database with retry logic
async function initializeDB() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`Attempting to connect to database... (${6 - retries}/5)`);
      const client = await pool.connect();
      
      // Test connection
      await client.query('SELECT 1');
      console.log('✅ Database connection successful');
      
      // First, check if dreams table exists and add missing columns
      try {
        // Add title column if it doesn't exist
        await client.query(`
          ALTER TABLE dreams 
          ADD COLUMN IF NOT EXISTS title VARCHAR(255)
        `);
        
        // Add tags column if it doesn't exist
        await client.query(`
          ALTER TABLE dreams 
          ADD COLUMN IF NOT EXISTS tags TEXT
        `);
        
        // Add likes column if it doesn't exist
        await client.query(`
          ALTER TABLE dreams 
          ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0
        `);
        
        console.log('✅ Database columns updated successfully');
      } catch (alterError) {
        console.log('Note: Could not alter table (might not exist yet):', alterError.message);
      }
      
      // Create tables if they don't exist (fallback for new installations)
      await client.query(`
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
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) DEFAULT 'DreamUser'
        )
      `);
      
      // Insert default user if not exists
      await client.query(`
        INSERT INTO users (id, username) 
        VALUES (1, 'DreamUser') 
        ON CONFLICT (id) DO NOTHING
      `);
      
      client.release();
      console.log('✅ Database initialized successfully');
      return;
      
    } catch (error) {
      console.error(`❌ Database connection attempt failed:`, error.message);
      retries--;
      
      if (retries === 0) {
        console.error('❌ Failed to connect to database after 5 attempts. Service will run without database.');
        return;
      }
      
      console.log(`Retrying in 5 seconds... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

app.post('/dreams', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { title, description, tags } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({
        error: 'Title and description are required'
      });
    }
    
    // Set a timeout for database operations (3 seconds max)
    const dbTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 3000)
    );
    
    const dbOperation = async () => {
      const client = await pool.connect();
      try {
        // Insert dream into database with a simple, fast query
        const result = await client.query(`
          INSERT INTO dreams (title, prompt, tags, user_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id, title, prompt, tags, created_at
        `, [title, description, tags || '', 1]);
        
        return result.rows[0];
      } finally {
        client.release();
      }
    };
    
    try {
      // Race between database operation and timeout
      const dream = await Promise.race([dbOperation(), dbTimeout]);
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Dream saved to DB in ${responseTime}ms`);
      
      res.json({ 
        id: dream.id,
        title: dream.title,
        description: dream.prompt,
        tags: dream.tags,
        status: "received", 
        message: "Dream successfully captured and stored!",
        timestamp: dream.created_at,
        responseTime: `${responseTime}ms`
      });
      
    } catch (dbError) {
      console.error('Database operation failed:', dbError.message);
      
      // Quick fallback response
      const fallbackId = Date.now() + Math.floor(Math.random() * 1000);
      const responseTime = Date.now() - startTime;
      
      res.json({ 
        id: fallbackId,
        title: title,
        description: description,
        tags: tags || '',
        status: "received", 
        message: "Dream captured! Processing in background...",
        timestamp: new Date().toISOString(),
        fallback: true,
        responseTime: `${responseTime}ms`
      });
      
      // Try to save to database in the background (fire and forget)
      setImmediate(async () => {
        try {
          const client = await pool.connect();
          await client.query(`
            INSERT INTO dreams (title, prompt, tags, user_id)
            VALUES ($1, $2, $3, $4)
          `, [title, description, tags || '', 1]);
          client.release();
          console.log('✅ Dream saved to DB in background');
        } catch (bgError) {
          console.error('❌ Background save failed:', bgError.message);
        }
      });
    }
    
  } catch (error) {
    console.error('Error creating dream:', error);
    const responseTime = Date.now() - startTime;
    
    res.status(500).json({
      error: 'Failed to save dream',
      message: error.message,
      responseTime: `${responseTime}ms`
    });
  }
});

app.get('/dreams', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, title, prompt as description, tags, likes, created_at
      FROM dreams 
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    client.release();
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching dreams:', error);
    res.status(500).json({
      error: 'Failed to fetch dreams',
      message: error.message
    });
  }
});

// Get individual dream by ID
app.get('/dreams/:id', async (req, res) => {
  try {
    const dreamId = parseInt(req.params.id);
    
    if (isNaN(dreamId)) {
      return res.status(400).json({
        error: 'Invalid dream ID',
        message: 'Dream ID must be a number'
      });
    }
    
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, title, prompt as description, tags, likes, created_at
      FROM dreams 
      WHERE id = $1
    `, [dreamId]);
    
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Dream not found',
        message: `Dream with ID ${dreamId} does not exist`
      });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error fetching dream:', error);
    res.status(500).json({
      error: 'Failed to fetch dream',
      message: error.message
    });
  }
});

app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    dbStatus = 'connected';
  } catch (error) {
    console.error('Health check DB error:', error.message);
  }
  
  res.json({ 
    service: 'dream-ingestor', 
    status: 'ok', 
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
initializeDB().then(() => {
  app.listen(5001, '0.0.0.0', () => {
    console.log('✅ Dream Ingestor running on port 5001 with PostgreSQL');
  });
});
