from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/generate')
def generate():
    return jsonify({
        "story": "Story generation service is ready. Connect to AI service for story generation.",
        "mood": "ready", 
        "length": "placeholder",
        "status": "service_available"
    })

@app.route('/health')
def health():
    return jsonify({"service": "story-weaver", "status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
