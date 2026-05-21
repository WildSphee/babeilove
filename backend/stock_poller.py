from __future__ import annotations

import json
import os
import ssl
import threading
import time
import urllib.request
from pathlib import Path

STOCKS = [
    {'symbol': 'AVGO', 'name': 'Broadcom'},
    {'symbol': 'CYD', 'name': 'China Yuchai'},
    {'symbol': 'BABA', 'name': 'Alibaba'},
    {'symbol': 'NDRA', 'name': 'Endra Life Sciences'},
]

DATA_FILE = Path(__file__).parent / 'stock_data.json'
POLL_INTERVAL = 30

_data: dict[str, dict] = {}
_last_updated: float = 0.0
_lock = threading.Lock()
_ssl_ctx = ssl.create_default_context()


def _fetch_quote(symbol: str, api_key: str) -> dict:
    url = f'https://finnhub.io/api/v1/quote?symbol={symbol}&token={api_key}'
    req = urllib.request.Request(url, headers={'User-Agent': 'babeilove/1.0'})
    with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as resp:
        return json.loads(resp.read())


def _poll(api_key: str) -> None:
    while True:
        updated: dict[str, dict] = {}
        for stock in STOCKS:
            symbol = stock['symbol']
            try:
                quote = _fetch_quote(symbol, api_key)
                current_price = quote.get('c') or 0
                updated[symbol] = {
                    'symbol': symbol,
                    'name': stock['name'],
                    'price': current_price,
                    'change': quote.get('d'),
                    'change_pct': quote.get('dp'),
                    'high': quote.get('h'),
                    'low': quote.get('l'),
                    'open': quote.get('o'),
                    'prev_close': quote.get('pc'),
                    'timestamp': quote.get('t'),
                }
            except Exception as exc:
                print(f'[stock_poller] {symbol}: {exc}')
                with _lock:
                    if symbol in _data:
                        updated[symbol] = _data[symbol]

        now = time.time()
        with _lock:
            _data.update(updated)
            global _last_updated
            _last_updated = now

        try:
            payload = {
                'stocks': list(_data.values()),
                'last_updated': now,
            }
            DATA_FILE.write_text(json.dumps(payload, indent=2))
        except Exception as exc:
            print(f'[stock_poller] write error: {exc}')

        time.sleep(POLL_INTERVAL)


def get_data() -> dict:
    with _lock:
        return {'stocks': list(_data.values()), 'last_updated': _last_updated}


def start() -> None:
    api_key = os.environ.get('FINNHUB_API_KEY', '')
    if not api_key:
        print('[stock_poller] FINNHUB_API_KEY not set — stock polling disabled')
        return

    if DATA_FILE.exists():
        try:
            saved = json.loads(DATA_FILE.read_text())
            with _lock:
                for entry in saved.get('stocks', []):
                    _data[entry['symbol']] = entry
        except Exception:
            pass

    thread = threading.Thread(target=_poll, args=(api_key,), daemon=True, name='stock-poller')
    thread.start()
    print(f'[stock_poller] Started — polling every {POLL_INTERVAL}s')
