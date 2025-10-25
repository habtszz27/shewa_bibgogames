import os
import datetime as dt
import random
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, scoped_session
from flask_sqlalchemy import SQLAlchemy

DB_URL = os.getenv('DATABASE_URL', 'sqlite:///data/bingo.db')
engine = create_engine(DB_URL, future=True)

import os
if DB_URL.startswith('sqlite:///'):
    # Ensure sqlite directory exists (e.g., sqlite:///data/bingo.db)
    path = DB_URL.replace('sqlite:///','')
    dirp = os.path.dirname(path)
    if dirp and not os.path.exists(dirp):
        os.makedirs(dirp, exist_ok=True)

Session = scoped_session(sessionmaker(bind=engine, autoflush=False))
Base = declarative_base()

db = SQLAlchemy()

def get_session():
    return Session()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, index=True, unique=True)
    display_name = Column(String)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True)
    code = Column(String, index=True, unique=True)
    host_user_id = Column(Integer, ForeignKey('users.id'))
    status = Column(String, default='scheduled')  # scheduled|live|completed
    entry_fee = Column(Float, default=0.0)
    prize_pool = Column(Float, default=0.0)
    settings = Column(JSON, default={})
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    host = relationship('User')

class Board(Base):
    __tablename__ = 'boards'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    room_id = Column(Integer, ForeignKey('rooms.id'))
    numbers = Column(JSON)  # list of 25
    marked = Column(JSON, default=list)  # list of called numbers
    is_winner = Column(Boolean, default=False)
    pattern = Column(String)

    user = relationship('User')
    room = relationship('Room')

class Draw(Base):
    __tablename__ = 'draws'
    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey('rooms.id'))
    number = Column(Integer)
    sequence = Column(Integer)
    called_at = Column(DateTime, default=dt.datetime.utcnow)

    room = relationship('Room')

class Ledger(Base):
    __tablename__ = 'ledger'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    room_id = Column(Integer, ForeignKey('rooms.id'))
    amount = Column(Float)
    type = Column(String)  # debit|credit
    note = Column(String)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    user = relationship('User')
    room = relationship('Room')

# Helpers

def init_db():
    Base.metadata.create_all(engine)

B_RANGES = [(1,15),(16,30),(31,45),(46,60),(61,75)]

def generate_board_numbers():
    cols = []
    for rng in B_RANGES:
        cols.append(random.sample(range(rng[0], rng[1]+1), 5))
    grid = [cols[c][r] for r in range(5) for c in range(5)]
    grid[12] = 0
    return grid
