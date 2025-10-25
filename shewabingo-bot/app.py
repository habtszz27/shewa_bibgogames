import os
import threading
from flask import Flask, request, render_template
from flask_socketio import SocketIO, join_room, leave_room
from dotenv import load_dotenv

load_dotenv()

from models import db, init_db, User, Room, Board, Draw, Ledger, get_session
from bot.handlers import build_application
from worker import start_room_loop

PORT = int(os.getenv('PORT', '3000'))
DB_URL = os.getenv('DATABASE_URL', 'sqlite:///data/bingo.db')
DRAW_INTERVAL = int(os.getenv('DRAW_INTERVAL_SECONDS', '20'))
USE_WEBHOOK = os.getenv('USE_WEBHOOK', 'false').lower() == 'true'
WEBHOOK_BASE = os.getenv('WEBHOOK_BASE_URL')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, cors_allowed_origins='*')
db.init_app(app)

with app.app_context():
    init_db()

application = None
if TELEGRAM_BOT_TOKEN:
    try:
        application = build_application(TELEGRAM_BOT_TOKEN, socketio)
    except Exception as e:
        print(f"[WARN] Telegram bot init failed: {e}")
else:
    print("[WARN] TELEGRAM_BOT_TOKEN not set; bot disabled")

@app.route('/')
def index():
    sess = get_session()
    rooms = sess.query(Room).order_by(Room.created_at.desc()).limit(20).all()
    return render_template('index.html', rooms=rooms)

@app.route('/room/<code>')
def room_page(code):
    sess = get_session()
    room = sess.query(Room).filter_by(code=code).first()
    draws = sess.query(Draw).filter_by(room_id=room.id).order_by(Draw.sequence.asc()).all() if room else []
    return render_template('room.html', room=room, draws=draws)

@app.route('/leaderboard')
def leaderboard():
    sess = get_session()
    top = sess.query(User).order_by(User.balance.desc()).limit(20).all()
    return render_template('leaderboard.html', users=top)

@socketio.on('join')
def on_join(data):
    code = data.get('code')
    join_room(code)

@socketio.on('leave')
def on_leave(data):
    code = data.get('code')
    leave_room(code)

# Telegram webhook endpoint (optional)
if USE_WEBHOOK and WEBHOOK_BASE:
    from telegram import Update
    import asyncio

    @app.post(f"/webhook/{TELEGRAM_BOT_TOKEN}")
    def webhook():
        update = Update.de_json(request.get_json(force=True), application.bot)
        asyncio.run(application.process_update(update))
        return 'OK'
else:
    # Start long polling in background
    def _run_polling():
        try:
            application.run_polling(allowed_updates=application.resolve_used_update_types())
        except Exception as e:
            print(f'[WARN] polling failed: {e}')
    import threading as _th
    if application:
        _th.Thread(target=_run_polling, daemon=True).start()

# Helper for worker threads to emit events
@app.before_first_request
def wire_worker_callbacks():
    # Worker will call socketio.emit('number_drawn', {...}, to=room_code)
    pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=PORT)
