@echo off
call C:\Users\asus\Documents\Projects\Strok project\.venv\Scripts\activate.bat
cd C:\Users\asus\Documents\Projects\Strok project
python manage.py cleanup_trial_users >> C:\path\to\your\project\cleanup.log 2>&1

