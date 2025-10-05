from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/remix/<int:dream_id>', methods=['POST'])
def remix(dream_id):
    return jsonify({ 
        "new_id": None, 
        "original_id": dream_id,
        "status": "service_available", 
        "style": "ready",
        "message": "Remix service is ready. Connect to processing engine for dream remixing."
    })

@app.route('/health')
def health():
    return jsonify({"service": "remix-engine", "status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5006)