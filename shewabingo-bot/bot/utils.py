from models import get_session, User, Room, Board, Ledger, generate_board_numbers
import random

def get_or_create_user(telegram_id, display_name=None):
    s = get_session()
    u = s.query(User).filter_by(telegram_id=str(telegram_id)).first()
    if not u:
        u = User(telegram_id=str(telegram_id), display_name=display_name or str(telegram_id), balance=0.0)
        s.add(u)
        s.commit()
    return u

def create_room(host_user, entry_fee=0, prize_pool=0):
    s = get_session()
    code = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    r = Room(code=code, host_user_id=host_user.id, entry_fee=entry_fee, prize_pool=prize_pool, status='scheduled', settings={"freeCenter": True})
    s.add(r)
    s.commit()
    return r

def join_room(user, code):
    s = get_session()
    r = s.query(Room).filter_by(code=code).first()
    if not r:
        raise ValueError('Room not found')
    b = s.query(Board).filter_by(user_id=user.id, room_id=r.id).first()
    if not b:
        nums = generate_board_numbers()
        b = Board(user_id=user.id, room_id=r.id, numbers=nums, marked=[])
        s.add(b)
        s.commit()
    return r, b
