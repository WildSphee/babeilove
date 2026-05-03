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

import threading

from flask import Flask, jsonify, send_file

from backend.export_video import export_video

app = Flask(__name__)
_lock = threading.Lock()


@app.after_request
def _cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/api/export-video")
def api_export_video():
    """Generate the memories video and return it as a download."""
    if not _lock.acquire(blocking=False):
        return jsonify({"error": "Video generation already in progress — try again shortly."}), 429

    try:
        output_path = export_video()
        if not output_path.exists() or output_path.stat().st_size < 1024:
            raise RuntimeError("Generated video file was missing or incomplete.")
        return send_file(
            str(output_path),
            mimetype="video/mp4",
            as_attachment=True,
            download_name="our-memories.mp4",
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        _lock.release()


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=False)
