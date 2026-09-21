@echo off
cd /d "%~dp0simulation-service"
if not exist venv python -m venv venv
call venv\Scripts\activate
set URBANTWIN_DATA_MODE=REAL
python -m pip install -r requirements.txt
python app.py
