from flask import Flask, jsonify
import psycopg2
import random
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

@app.route('/all')
def all_dreams():
    try:
        conn = get_db_connection()
        if not conn:
            # Fallback to mock data if DB is unavailable
            return jsonify([
                {"id": 1, "title": "Flying Over Tokyo", "likes": 42, "description": "Soaring through neon-lit skies"},
                {"id": 2, "title": "Library of Whispers", "likes": 28, "description": "Ancient books speak secrets"}
            ])
        
        cursor = conn.cursor()
        
        # Get all dreams from database - handle both old and new schema
        try:
            # Try new schema first
            cursor.execute("""
                SELECT id, title, prompt, likes, created_at, tags
                FROM dreams 
                ORDER BY created_at DESC
                LIMIT 20
            """)
            schema_type = "new"
        except Exception as e:
            if "column" in str(e).lower() and "does not exist" in str(e).lower():
                # Fall back to old schema
                cursor.execute("""
                    SELECT id, prompt, created_at
                    FROM dreams 
                    ORDER BY created_at DESC
                    LIMIT 20
                """)
                schema_type = "old"
            else:
                raise e
        
        rows = cursor.fetchall()
        dreams = []
        
        for row in rows:
            if schema_type == "new":
                dreams.append({
                    "id": row[0],
                    "title": row[1] or "Untitled Dream",
                    "description": (row[2] or "A mysterious dream...")[:100] + "..." if len(row[2] or "") > 100 else (row[2] or "A mysterious dream..."),
                    "likes": row[3] or 0,
                    "created_at": row[4].isoformat() if row[4] else datetime.now().isoformat(),
                    "tags": row[5] or ""
                })
            else:  # old schema
                dreams.append({
                    "id": row[0],
                    "title": "Dream #" + str(row[0]),
                    "description": (row[1] or "A mysterious dream...")[:100] + "..." if len(row[1] or "") > 100 else (row[1] or "A mysterious dream..."),
                    "likes": 0,
                    "created_at": row[2].isoformat() if row[2] else datetime.now().isoformat(),
                    "tags": ""
                })
        
        cursor.close()
        conn.close()
        
        # If no dreams in DB, add some sample dreams
        if not dreams:
            dreams = [
                {"id": 999, "title": "Welcome Dream", "description": "Your first dream awaits...", "likes": 0, "tags": "welcome"},
                {"id": 998, "title": "Sample Dream", "description": "This is how dreams will appear", "likes": 5, "tags": "sample"}
            ]
        
        return jsonify(dreams)
        
    except Exception as e:
        print(f"Error fetching dreams: {e}")
        # Return mock data on error
        return jsonify([
            {"id": 1, "title": "Flying Over Tokyo", "likes": 42, "description": "Soaring through neon-lit skies"},
            {"id": 2, "title": "Library of Whispers", "likes": 28, "description": "Ancient books speak secrets"}
        ])

@app.route('/health')
def health():
    conn = get_db_connection()
    db_status = "connected" if conn else "disconnected"
    if conn:
        conn.close()
    
    return jsonify({
        "service": "gallery-service", 
        "status": "ok",
        "database": db_status
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004)
