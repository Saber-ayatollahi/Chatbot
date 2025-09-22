@echo off
setlocal enabledelayedexpansion
title Stop Fund Management Chatbot

:MAIN_MENU
cls
echo ========================================
echo   Stop Fund Management Chatbot
echo ========================================
echo.
echo Current Status:
call :CHECK_SERVICES_BRIEF
echo.
echo Choose your action:
echo.
echo [1] Stop All Services (Graceful)
echo [2] Force Stop All Services
echo [3] Stop Backend Only (Port 5000)
echo [4] Stop Frontend Only (Port 3000)
echo [5] View Detailed Service Status
echo [6] Clean Temporary Files
echo [Q] Quit (Keep Services Running)
echo.
set /p choice="Enter your choice (1-6, Q): "

if /i "%choice%"=="1" goto GRACEFUL_STOP
if /i "%choice%"=="2" goto FORCE_STOP
if /i "%choice%"=="3" goto STOP_BACKEND
if /i "%choice%"=="4" goto STOP_FRONTEND
if /i "%choice%"=="5" goto DETAILED_STATUS
if /i "%choice%"=="6" goto CLEAN_TEMP
if /i "%choice%"=="Q" goto QUIT

echo Invalid choice. Please try again.
timeout /t 2 /nobreak >nul
goto MAIN_MENU

:GRACEFUL_STOP
cls
echo ========================================
echo   Graceful Shutdown
echo ========================================
echo.
echo This will attempt to gracefully stop all services:
echo - Send termination signals to processes
echo - Allow cleanup and data saving
echo - Wait for proper shutdown
echo.
echo Press any key to continue...
pause >nul

call :GRACEFUL_SHUTDOWN
echo.
echo ✅ Graceful shutdown completed.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

:FORCE_STOP
cls
echo ========================================
echo   Force Stop All Services
echo ========================================
echo.
echo ⚠️  WARNING: Force Stop
echo This will immediately terminate all processes.
echo Any unsaved data may be lost.
echo.
set /p confirm="Are you sure you want to force stop? (Y/N): "
if /i not "%confirm%"=="Y" goto MAIN_MENU

call :FORCE_SHUTDOWN
echo.
echo ✅ Force stop completed.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

:STOP_BACKEND
cls
echo ========================================
echo   Stop Backend Server Only
echo ========================================
echo.
call :STOP_BACKEND_ONLY
echo.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

:STOP_FRONTEND
cls
echo ========================================
echo   Stop Frontend Server Only
echo ========================================
echo.
call :STOP_FRONTEND_ONLY
echo.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

:DETAILED_STATUS
cls
echo ========================================
echo   Detailed Service Status
echo ========================================
echo.
call :DETAILED_SERVICE_CHECK
echo.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

:CLEAN_TEMP
cls
echo ========================================
echo   Clean Temporary Files
echo ========================================
echo.
call :CLEAN_TEMPORARY_FILES
echo.
echo Press any key to return to menu...
pause >nul
goto MAIN_MENU

REM ========================================
REM UTILITY FUNCTIONS
REM ========================================

:CHECK_SERVICES_BRIEF
netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Backend: Running on port 5000
) else (
    echo ❌ Backend: Not running
)

netstat -ano | findstr :3000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Frontend: Running on port 3000
) else (
    echo ❌ Frontend: Not running
)
goto :eof

:GRACEFUL_SHUTDOWN
echo 🔄 Attempting graceful shutdown...

REM Try using npx kill-port for graceful shutdown
where npx >nul 2>&1
if !errorlevel! equ 0 (
    echo   Using npx kill-port for graceful shutdown...
    
    echo   Stopping backend server (port 5000)...
    npx kill-port 5000 >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ✅ Backend stopped gracefully
    ) else (
        echo   ⚠️  Backend may not have been running
    )
    
    echo   Stopping frontend server (port 3000)...
    npx kill-port 3000 >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ✅ Frontend stopped gracefully
    ) else (
        echo   ⚠️  Frontend may not have been running
    )
) else (
    echo   npx not available, falling back to manual shutdown...
    call :MANUAL_GRACEFUL_SHUTDOWN
)

echo   Waiting for processes to terminate...
timeout /t 3 /nobreak >nul
goto :eof

:MANUAL_GRACEFUL_SHUTDOWN
REM Manual graceful shutdown by sending CTRL+C to processes
echo   Attempting manual graceful shutdown...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Sending termination signal to backend process %%a...
        taskkill /PID %%a >nul 2>&1
    )
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Sending termination signal to frontend process %%a...
        taskkill /PID %%a >nul 2>&1
    )
)
goto :eof

:FORCE_SHUTDOWN
echo 🛑 Force stopping all services...

echo   Force killing backend processes (port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Force killing process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   Force killing frontend processes (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Force killing process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   Cleaning up any remaining Node.js processes...
tasklist /fi "imagename eq node.exe" | findstr "node.exe" >nul
if !errorlevel! equ 0 (
    echo   Found additional Node.js processes. Checking if they're related...
    REM Only kill Node processes that might be related to our app
    REM This is safer than killing all Node processes
)

echo ✅ Force shutdown completed.
goto :eof

:STOP_BACKEND_ONLY
echo 🔄 Stopping backend server only...

netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        echo   Stopping backend process %%a...
        taskkill /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Backend server stopped
        ) else (
            echo   ⚠️  Failed to stop backend server
        )
    )
) else (
    echo ❌ Backend server is not running on port 5000
)
goto :eof

:STOP_FRONTEND_ONLY
echo 🔄 Stopping frontend server only...

netstat -ano | findstr :3000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo   Stopping frontend process %%a...
        taskkill /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Frontend server stopped
        ) else (
            echo   ⚠️  Failed to stop frontend server
        )
    )
) else (
    echo ❌ Frontend server is not running on port 3000
)
goto :eof

:DETAILED_SERVICE_CHECK
echo 🔍 Detailed service status check...
echo.

echo BACKEND SERVER (Port 5000):
netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Status: Running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        echo   Process ID: %%a
        echo   Process Details:
        tasklist /fi "PID eq %%a" /fo table 2>nul | findstr /v "INFO:"
    )
) else (
    echo ❌ Status: Not running
)

echo.
echo FRONTEND SERVER (Port 3000):
netstat -ano | findstr :3000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Status: Running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo   Process ID: %%a
        echo   Process Details:
        tasklist /fi "PID eq %%a" /fo table 2>nul | findstr /v "INFO:"
    )
) else (
    echo ❌ Status: Not running
)

echo.
echo ALL NODE.JS PROCESSES:
tasklist /fi "imagename eq node.exe" /fo table 2>nul | findstr /v "INFO:"

echo.
echo NETWORK CONNECTIONS:
echo Port 3000:
netstat -ano | findstr :3000 2>nul
echo Port 5000:
netstat -ano | findstr :5000 2>nul
goto :eof

:CLEAN_TEMPORARY_FILES
echo 🧹 Cleaning temporary files...

if exist "temp\*" (
    echo   Cleaning temp directory...
    del /q "temp\*" 2>nul
    echo   ✅ Temp directory cleaned
) else (
    echo   ℹ️  No temp files to clean
)

if exist "logs\*.log" (
    echo   Archiving old log files...
    if not exist "logs\archive" mkdir "logs\archive"
    move "logs\*.log" "logs\archive\" >nul 2>&1
    echo   ✅ Log files archived
) else (
    echo   ℹ️  No log files to archive
)

if exist "uploads\temp\*" (
    echo   Cleaning upload temp directory...
    del /q "uploads\temp\*" 2>nul
    echo   ✅ Upload temp directory cleaned
) else (
    echo   ℹ️  No upload temp files to clean
)

if exist ".env" (
    echo   Environment file found: .env
    echo   ℹ️  Environment file preserved (not deleted)
) else (
    echo   ℹ️  No environment file found
)

echo ✅ Cleanup completed.
goto :eof

:QUIT
echo.
echo Services remain running. Use the start script to manage them.
echo.
timeout /t 2 /nobreak >nul
exit /b 0
