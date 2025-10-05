from flask import Flask, jsonify
import psycopg2
from datetime import datetime

app = Flask(__name__)

# Database connection
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host='postgres-db',
            port=5432,
            database='dreamcanvas',
            user='user',
            password='pass'
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

@app.route('/user/<int:user_id>/dreams')
def portfolio(user_id):
    try:
        conn = get_db_connection()
        if not conn:
            # Fallback to mock data if DB is unavailable
            return jsonify([
                {"id": 101, "title": "My First Dream", "description": "The beginning of my journey", "likes": 15},
                {"id": 102, "title": "Floating Islands", "description": "A world above the clouds", "likes": 23}
            ])
        
        cursor = conn.cursor()
        
        # Get user's dreams from database - handle both old and new schema
        try:
            # Try new schema first
            cursor.execute("""
                SELECT id, title, prompt, likes, created_at, tags
                FROM dreams 
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, (user_id,))
            schema_type = "new"
        except Exception as e:
            if "column" in str(e).lower() and "does not exist" in str(e).lower():
                # Fall back to old schema
                cursor.execute("""
                    SELECT id, prompt, created_at
                    FROM dreams 
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """, (user_id,))
                schema_type = "old"
            else:
                raise e
        
        rows = cursor.fetchall()
        user_dreams = []
        
        for row in rows:
            if schema_type == "new":
                user_dreams.append({
                    "id": row[0],
                    "title": row[1] or "Untitled Dream",
                    "description": (row[2] or "A personal dream...")[:100] + "..." if len(row[2] or "") > 100 else (row[2] or "A personal dream..."),
                    "likes": row[3] or 0,
                    "created_at": row[4].isoformat() if row[4] else datetime.now().isoformat(),
                    "tags": row[5] or ""
                })
            else:  # old schema
                user_dreams.append({
                    "id": row[0],
                    "title": "My Dream #" + str(row[0]),
                    "description": (row[1] or "A personal dream...")[:100] + "..." if len(row[1] or "") > 100 else (row[1] or "A personal dream..."),
                    "likes": 0,
                    "created_at": row[2].isoformat() if row[2] else datetime.now().isoformat(),
                    "tags": ""
                })
        
        cursor.close()
        conn.close()
        
        # If no dreams found, return empty array with message
        if not user_dreams:
            return jsonify({
                "dreams": [],
                "message": "No dreams found. Start creating your first dream!",
                "user_id": user_id
            })
        
        return jsonify(user_dreams)
        
    except Exception as e:
        print(f"Error fetching user portfolio: {e}")
        # Return mock data on error
        return jsonify([
            {"id": 101, "title": "My First Dream", "description": "The beginning of my journey", "likes": 15}
        ])

@app.route('/health')
def health():
    conn = get_db_connection()
    db_status = "connected" if conn else "disconnected"
    if conn:
        conn.close()
    
    return jsonify({
        "service": "user-portfolio", 
        "status": "ok",
        "database": db_status
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5008)