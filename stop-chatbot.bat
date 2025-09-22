@echo off
title Stop Fund Management Chatbot
echo ========================================
echo   ENHANCED: stop-chatbot.bat
echo ========================================
echo.
echo This file has been enhanced! 
echo.
echo ✅ Use: stop-chatbot-enhanced.bat for:
echo    - Interactive shutdown options
echo    - Graceful vs force stop
echo    - Individual service control
echo    - Service status checking
echo.
echo Quick stop (current functionality):
echo.

echo Stopping all chatbot processes...
echo.

echo Killing processes on port 5000 (Backend)...
where npx >nul 2>&1
if !errorlevel! equ 0 (
    npx kill-port 5000
) else (
    echo npx not found, using taskkill...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
        if not "%%a"=="0" (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

echo Killing processes on port 3000 (Frontend)...
where npx >nul 2>&1
if !errorlevel! equ 0 (
    npx kill-port 3000
) else (
    echo npx not found, using taskkill...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
        if not "%%a"=="0" (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

echo.
echo All chatbot processes have been stopped.
echo.
echo 💡 Tip: Use 'stop-chatbot-enhanced.bat' for more options!
echo.
pause
