#!/bin/sh
set -e
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export TELEGRAM_BOT_TOKEN="YOUR_TOKEN"
python app.py
