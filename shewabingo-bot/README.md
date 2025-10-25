# SHEWA Bingo Bot (Flask + Telegram + Socket.IO)

- Flask web app with Socket.IO real-time updates
- python-telegram-bot for Telegram commands
- SQLAlchemy (SQLite by default) for persistence
- Eventlet worker for WebSocket support

Environment variables:
- TELEGRAM_BOT_TOKEN (required)
- PORT (default 3000)
- DATABASE_URL (optional, defaults to sqlite:///data/bingo.db)
- DRAW_INTERVAL_SECONDS (default 20)
- USE_WEBHOOK (optional: true/false; default false for long polling)
- WEBHOOK_BASE_URL (if USE_WEBHOOK=true)

Run locally:
```
pip install -r requirements.txt
python app.py
```
