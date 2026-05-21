#!/usr/bin/env python3
"""
HTTP server for /api routes.

Run with:
    poetry run python -m backend.video_server

Nginx should proxy /api/ to this server:
    location /api/ {
        proxy_pass http://127.0.0.1:5050/api/;
    }
"""

from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify

load_dotenv(Path(__file__).parent.parent / '.env')

from backend import stock_poller  # noqa: E402 — must be after load_dotenv

app = Flask(__name__)


@app.after_request
def _cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


@app.route('/api/export-video')
def api_export_video():
    return jsonify({'error': 'Video export is temporarily disabled.'}), 503


@app.route('/api/stocks')
def api_stocks():
    return jsonify(stock_poller.get_data())


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    stock_poller.start()
    app.run(host='127.0.0.1', port=5050, debug=False)
