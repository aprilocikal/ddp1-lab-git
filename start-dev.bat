@echo off
echo ===================================================
echo     STARTING SCELE NOTIF (DDP 1 TUGAS AKHIR)
echo ===================================================
echo.

set PY_BIN=
if exist "C:\Users\HP Probook\AppData\Local\Programs\Python\Python313\python.exe" (
    set "PY_BIN=C:\Users\HP Probook\AppData\Local\Programs\Python\Python313\python.exe"
) else (
    set "PY_BIN=python"
)

echo Menggunakan Python: "%PY_BIN%"
echo.

echo [1/2] Menjalankan Backend Python (Port 8000)...
start "SCELE Python Backend (Port 8000)" cmd /k "cd /d "%~dp0" && "%PY_BIN%" run.py"

echo [2/2] Menjalankan Frontend Web (Port 3000)...
start "SCELE Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================
echo [OK] Keduanya sudah berjalan!
echo.
echo - Web Frontend : http://localhost:3000
echo - Python API   : http://localhost:8000
echo - Swagger Docs : http://localhost:8000/docs
echo.
echo * Jangan tutup jendela CMD yang baru terbuka agar server tetap menyala.
echo ===================================================
echo.
pause
