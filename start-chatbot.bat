@echo off
setlocal enabledelayedexpansion
title Fund Management Chatbot Launcher

:MAIN_MENU
cls
echo ========================================
echo   Fund Management Chatbot Launcher
echo   WITH ADVANCED DOCUMENT PROCESSING
echo ========================================
echo.
echo Please select your environment:
echo.
echo [1] Development Environment
echo     - Hot reload enabled
echo     - Debug logging
echo     - Development database
echo     - Local testing mode
echo.
echo [2] Production Environment  
echo     - Optimized performance
echo     - Production database
echo     - Full security features
echo     - Advanced processing
echo.
echo [3] Quick Development (Auto-setup)
echo     - Automatic environment setup
echo     - Sample data included
echo     - Ideal for testing
echo.
echo [4] Stop All Services
echo [5] View Running Services
echo [6] Environment Setup Help
echo [Q] Quit
echo.
set /p choice="Enter your choice (1-6, Q): "

if /i "%choice%"=="1" goto DEV_ENV
if /i "%choice%"=="2" goto PROD_ENV
if /i "%choice%"=="3" goto QUICK_DEV
if /i "%choice%"=="4" goto STOP_SERVICES
if /i "%choice%"=="5" goto VIEW_SERVICES
if /i "%choice%"=="6" goto SETUP_HELP
if /i "%choice%"=="Q" goto QUIT

echo Invalid choice. Please try again.
timeout /t 2 /nobreak >nul
goto MAIN_MENU

:DEV_ENV
cls
echo ========================================
echo   Starting Development Environment
echo ========================================
echo.
echo This will start:
echo - Backend server on port 5000 (development mode)
echo - Frontend server on port 3000 (with hot reload)
echo - Development database connection
echo - Debug logging enabled
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

call :CLEANUP_PORTS
call :SETUP_DEV_ENV
call :START_DEV_SERVERS
goto END

:PROD_ENV
cls
echo ========================================
echo   Starting Production Environment
echo ========================================
echo.
echo ⚠️  WARNING: Production Environment
echo This will start the system in production mode with:
echo - Production database connection
echo - Optimized performance settings
echo - Full security features enabled
echo - Advanced document processing
echo.
echo Make sure you have:
echo ✓ Production database configured
echo ✓ OpenAI API key configured
echo ✓ All dependencies installed
echo.
set /p confirm="Continue with production setup? (Y/N): "
if /i not "%confirm%"=="Y" goto MAIN_MENU

call :CLEANUP_PORTS
call :SETUP_PROD_ENV
call :START_PROD_SERVERS
goto END

:QUICK_DEV
cls
echo ========================================
echo   Quick Development Setup
echo ========================================
echo.
echo This will automatically:
echo ✓ Setup development environment
echo ✓ Initialize development database
echo ✓ Start both servers
echo ✓ Open browser automatically
echo.
echo Perfect for quick testing and development!
echo.
echo Press any key to start...
pause >nul

call :CLEANUP_PORTS
call :SETUP_QUICK_DEV
call :START_DEV_SERVERS
goto END

:STOP_SERVICES
cls
echo ========================================
echo   Stopping All Chatbot Services
echo ========================================
echo.
call :STOP_ALL_SERVICES
echo.
echo All services stopped.
echo Press any key to return to main menu...
pause >nul
goto MAIN_MENU

:VIEW_SERVICES
cls
echo ========================================
echo   Currently Running Services
echo ========================================
echo.
call :CHECK_SERVICES
echo.
echo Press any key to return to main menu...
pause >nul
goto MAIN_MENU

:SETUP_HELP
cls
echo ========================================
echo   Environment Setup Help
echo ========================================
echo.
echo DEVELOPMENT ENVIRONMENT:
echo - Uses local development database
echo - Hot reload for code changes
echo - Debug logging enabled
echo - Ideal for coding and testing
echo.
echo PRODUCTION ENVIRONMENT:
echo - Uses production database
echo - Optimized performance
echo - Full security features
echo - Advanced document processing
echo.
echo QUICK DEVELOPMENT:
echo - Automatic setup with defaults
echo - Sample data included
echo - No manual configuration needed
echo.
echo REQUIREMENTS:
echo - Node.js 18+ installed
echo - PostgreSQL running
echo - npm dependencies installed
echo.
echo For first-time setup, run:
echo   npm run install-all
echo   npm run db:init
echo.
echo Press any key to return to main menu...
pause >nul
goto MAIN_MENU

REM ========================================
REM UTILITY FUNCTIONS
REM ========================================

:CLEANUP_PORTS
echo 🧹 Cleaning up existing processes...
REM Kill processes using port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Stopping process %%a on port 5000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Kill processes using port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Stopping process %%a on port 3000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   Waiting for cleanup to complete...
timeout /t 2 /nobreak >nul
echo ✅ Cleanup complete.
goto :eof

:SETUP_DEV_ENV
echo 🔧 Configuring development environment...
(
echo NODE_ENV=development
echo PORT=5000
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_development
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=chatbot_development
echo DB_USER=postgres
echo DB_PASSWORD=postgres
echo LOG_LEVEL=debug
echo SESSION_SECRET=dev_session_secret
echo JWT_SECRET=dev_jwt_secret
echo ADMIN_PASSWORD=admin123
) > .env
echo ✅ Development environment configured.
goto :eof

:SETUP_PROD_ENV
echo 🔧 Configuring production environment...
echo.

REM Try to read API key from API.txt file
set openai_key=
if exist "API.txt" (
    echo 📋 Found API.txt file, reading OpenAI API key...
    for /f "delims=" %%i in (API.txt) do set openai_key=%%i
    echo ✅ OpenAI API key loaded from API.txt
) else (
    echo ⚠️  API.txt file not found. You need to provide your OpenAI API key.
    set /p openai_key="Enter your OpenAI API key (or press Enter to skip): "
    
    if "!openai_key!"=="" (
        echo ⚠️  Warning: No OpenAI API key provided. Some features may not work.
        set openai_key=your_openai_api_key_here
    )
)

(
echo NODE_ENV=production
echo PORT=5000
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_production
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=chatbot_production
echo DB_USER=postgres
echo DB_PASSWORD=postgres
echo OPENAI_API_KEY=%openai_key%
echo SESSION_SECRET=prod_session_secret_secure
echo JWT_SECRET=prod_jwt_secret_secure
echo ADMIN_PASSWORD=prod_admin_secure
echo LOG_LEVEL=info
) > .env
echo ✅ Production environment configured.
goto :eof

:SETUP_QUICK_DEV
echo 🚀 Setting up quick development environment...

REM Try to read API key from API.txt file for development too
set dev_openai_key=demo_key_for_testing
if exist "API.txt" (
    echo 📋 Found API.txt file, using real OpenAI API key for development...
    for /f "delims=" %%i in (API.txt) do set dev_openai_key=%%i
    echo ✅ Real OpenAI API key will be used in development
) else (
    echo ℹ️  API.txt not found, using demo key for development
)

(
echo NODE_ENV=development
echo PORT=5000
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_development
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=chatbot_development
echo DB_USER=postgres
echo DB_PASSWORD=postgres
echo LOG_LEVEL=debug
echo SESSION_SECRET=dev_session_secret
echo JWT_SECRET=dev_jwt_secret
echo ADMIN_PASSWORD=admin123
echo OPENAI_API_KEY=!dev_openai_key!
) > .env
echo ✅ Quick development environment ready.
goto :eof

:START_DEV_SERVERS
echo 🚀 Starting development servers...
echo.
echo Starting backend server (development mode)...
start "Backend Server - Development" cmd /k "cd /d %~dp0 && echo Starting backend in development mode... && npm run server && echo Backend server stopped. Press any key to close... && pause >nul"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Starting frontend server (with hot reload)...
start "Frontend Server - Development" cmd /k "cd /d %~dp0\client && echo Starting frontend with hot reload... && npm start && echo Frontend server stopped. Press any key to close... && pause >nul"

call :VERIFY_STARTUP
goto :eof

:START_PROD_SERVERS
echo 🚀 Starting production servers...
echo.
echo Starting backend server (production mode)...
start "Backend Server - Production" cmd /k "cd /d %~dp0 && echo Starting backend in production mode... && npm start && echo Backend server stopped. Press any key to close... && pause >nul"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Starting frontend server...
start "Frontend Server - Production" cmd /k "cd /d %~dp0\client && echo Starting frontend... && npm start && echo Frontend server stopped. Press any key to close... && pause >nul"

call :VERIFY_STARTUP
goto :eof

:VERIFY_STARTUP
echo.
echo 🔍 Verifying servers...
timeout /t 3 /nobreak >nul

netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Backend server is running on port 5000
) else (
    echo ❌ Backend server failed to start on port 5000
    echo    Check the Backend Server terminal window for errors
)

netstat -ano | findstr :3000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Frontend server is running on port 3000
) else (
    echo ⏳ Frontend server is still starting on port 3000
)
goto :eof

:STOP_ALL_SERVICES
echo 🛑 Stopping all chatbot services...

REM Try graceful shutdown first
echo   Attempting graceful shutdown...
where npx >nul 2>&1
if !errorlevel! equ 0 (
    npx kill-port 5000 >nul 2>&1
    npx kill-port 3000 >nul 2>&1
) else (
    echo   npx not found, using taskkill...
)

REM Force kill if needed
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Force stopping process %%a on port 5000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo   Force stopping process %%a on port 3000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo ✅ All services stopped.
goto :eof

:CHECK_SERVICES
echo Checking for running services...
echo.

netstat -ano | findstr :5000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Backend server is running on port 5000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        echo    Process ID: %%a
    )
) else (
    echo ❌ Backend server is not running on port 5000
)

netstat -ano | findstr :3000 | findstr LISTENING >nul
if !errorlevel! equ 0 (
    echo ✅ Frontend server is running on port 3000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo    Process ID: %%a
    )
) else (
    echo ❌ Frontend server is not running on port 3000
)

echo.
echo Other Node.js processes:
tasklist /fi "imagename eq node.exe" 2>nul | findstr node.exe
goto :eof

:END
echo.
echo ========================================
echo   Chatbot Started Successfully!
echo ========================================
echo.
echo 🌐 Access URLs:
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo 📋 Available Features:
echo   ✓ Advanced Document Processing
echo   ✓ RAG-based Chat System
echo   ✓ Document Management
echo   ✓ Admin Interface
echo.
echo 💡 Tips:
echo   - Both servers are running in separate windows
echo   - Frontend will open in your browser automatically
echo   - Use Ctrl+C in each window to stop servers
echo   - Or run this script again and choose "Stop All Services"
echo.
echo Press any key to close this launcher...
pause >nul
goto :eof

:QUIT
echo.
echo Thank you for using the Fund Management Chatbot!
echo.
timeout /t 2 /nobreak >nul
exit /b 0
