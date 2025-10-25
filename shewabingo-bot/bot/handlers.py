import os
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from telegram import Update
from models import get_session
from bot.utils import get_or_create_user, create_room, join_room
from worker import start_room_loop

DRAW_INTERVAL = int(os.getenv('DRAW_INTERVAL_SECONDS', '20'))

async def cmd_start(update: Update, context):
    user = update.effective_user
    get_or_create_user(user.id, user.full_name)
    await update.effective_chat.send_message('Welcome to SHEWA Bingo! Use /newgame, /join CODE, /startgame CODE, /status CODE')

async def cmd_newgame(update: Update, context):
    user = update.effective_user
    u = get_or_create_user(user.id, user.full_name)
    args = context.args
    entry = float(args[0]) if args else 0
    prize = float(args[1]) if len(args)>1 else 0
    room = create_room(u, entry, prize)
    await update.effective_chat.send_message(f'Room created. Code: {room.code}\nUse /join {room.code} to join.')

async def cmd_join(update: Update, context):
    if not context.args:
        return await update.effective_chat.send_message('Usage: /join CODE')
    code = context.args[0].strip().upper()
    u = get_or_create_user(update.effective_user.id, update.effective_user.full_name)
    try:
        room, board = join_room(u, code)
    except Exception as e:
        return await update.effective_chat.send_message(f'Join failed: {e}')
    await update.effective_chat.send_message(f'Joined room {room.code}. Your board has been created.')

async def cmd_startgame(update: Update, context):
    if not context.args:
        return await update.effective_chat.send_message('Usage: /startgame CODE')
    code = context.args[0].strip().upper()
    start_room_loop(context.bot_data.get('socketio'), code, DRAW_INTERVAL)
    await update.effective_chat.send_message('Game started.')

async def cmd_status(update: Update, context):
    if not context.args:
        return await update.effective_chat.send_message('Usage: /status CODE')
    code = context.args[0].strip().upper()
    await update.effective_chat.send_message(f'Room {code} is running.')

async def unknown(update: Update, context):
    await update.effective_chat.send_message('Unknown command')

def build_application(token: str, socketio=None) -> Application:
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler('start', cmd_start))
    app.add_handler(CommandHandler('newgame', cmd_newgame))
    app.add_handler(CommandHandler('join', cmd_join))
    app.add_handler(CommandHandler('startgame', cmd_startgame))
    app.add_handler(CommandHandler('status', cmd_status))
    app.add_handler(MessageHandler(filters.COMMAND, unknown))
    app.bot_data['socketio'] = socketio
    return app
