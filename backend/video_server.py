#!/usr/bin/env python3
"""
HTTP server for on-demand memory video export.

Run with:
    poetry run python -m backend.video_server

Nginx should proxy /api/ to this server:
    location /api/ {
        proxy_pass http://127.0.0.1:5050/api/;
        proxy_read_timeout 600;   # generation can take a few minutes
    }
"""

from flask import Flask, jsonify

app = Flask(__name__)


@app.after_request
def _cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/api/export-video")
def api_export_video():
    return jsonify({"error": "Video export is temporarily disabled."}), 503


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=False)
