import time
import threading
import random
from models import get_session, Room, Draw

_RUNNING = {}

def start_room_loop(socketio, room_code, interval_seconds=20):
    if room_code in _RUNNING:
        return
    _RUNNING[room_code] = True

    def loop():
        sess = get_session()
        room = sess.query(Room).filter_by(code=room_code).first()
        if not room:
            _RUNNING.pop(room_code, None)
            return
        called = set(d.number for d in sess.query(Draw).filter_by(room_id=room.id).all())
        numbers = list(range(1,76))
        random.shuffle(numbers)
        seq = len(called)
        for n in numbers:
            if not _RUNNING.get(room_code):
                break
            if n in called:
                continue
            seq += 1
            d = Draw(room_id=room.id, number=n, sequence=seq)
            sess.add(d)
            sess.commit()
            socketio.emit('number_drawn', {'code': room_code, 'sequence': seq, 'number': n}, to=room_code)
            time.sleep(interval_seconds)
        _RUNNING.pop(room_code, None)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
