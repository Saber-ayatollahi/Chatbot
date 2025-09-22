@echo off
setlocal enabledelayedexpansion
title Fund Management Chatbot - Environment Setup

cls
echo ========================================
echo   Environment Setup Wizard
echo   Fund Management Chatbot
echo ========================================
echo.
echo This wizard will help you set up your environment
echo for the Fund Management Chatbot system.
echo.

REM Check prerequisites
echo 🔍 Checking prerequisites...
echo.

REM Check Node.js
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo    Please install Node.js 18+ from https://nodejs.org/
    echo    Then run this script again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js found: !NODE_VERSION!
)

REM Check npm
where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ npm is not installed or not in PATH
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm found: !NPM_VERSION!
)

REM Check PostgreSQL
where psql >nul 2>&1
if !errorlevel! neq 0 (
    echo ⚠️  PostgreSQL command line tools not found in PATH
    echo    PostgreSQL may not be installed or configured
    echo    You may need to install PostgreSQL and add it to PATH
) else (
    echo ✅ PostgreSQL tools found
)

echo.
echo 📋 Environment Setup Options:
echo.
echo [1] Full Setup (Recommended for first-time users)
echo     - Install all dependencies
echo     - Setup development database
echo     - Create environment configuration
echo     - Initialize sample data
echo.
echo [2] Dependencies Only
echo     - Install npm dependencies for backend and frontend
echo     - Skip database and configuration setup
echo.
echo [3] Database Setup Only
echo     - Initialize database schema
echo     - Create development and production databases
echo     - Skip dependency installation
echo.
echo [4] Environment Configuration Only
echo     - Create .env files for different environments
echo     - Skip dependencies and database
echo.
echo [5] Verify Current Setup
echo     - Check current installation status
echo     - Test database connections
echo     - Validate configuration
echo.
echo [Q] Quit
echo.
set /p choice="Enter your choice (1-5, Q): "

if /i "%choice%"=="1" goto FULL_SETUP
if /i "%choice%"=="2" goto DEPS_ONLY
if /i "%choice%"=="3" goto DB_ONLY
if /i "%choice%"=="4" goto ENV_ONLY
if /i "%choice%"=="5" goto VERIFY_SETUP
if /i "%choice%"=="Q" goto QUIT

echo Invalid choice. Please try again.
timeout /t 2 /nobreak >nul
goto :eof

:FULL_SETUP
cls
echo ========================================
echo   Full Environment Setup
echo ========================================
echo.
echo This will perform a complete setup:
echo ✓ Install all npm dependencies
echo ✓ Setup PostgreSQL databases
echo ✓ Create environment configurations
echo ✓ Initialize sample data
echo.
echo This may take several minutes...
echo.
set /p confirm="Continue with full setup? (Y/N): "
if /i not "%confirm%"=="Y" goto :eof

call :INSTALL_DEPENDENCIES
call :SETUP_DATABASE
call :CREATE_ENV_FILES
call :INITIALIZE_DATA

echo.
echo ✅ Full setup completed successfully!
echo.
echo Next steps:
echo 1. Run 'start-chatbot.bat' to start the application
echo 2. Choose your preferred environment (dev/prod)
echo 3. Access the application at http://localhost:3000
echo.
pause
goto :eof

:DEPS_ONLY
cls
echo ========================================
echo   Installing Dependencies
echo ========================================
echo.
call :INSTALL_DEPENDENCIES
echo.
echo ✅ Dependencies installation completed!
pause
goto :eof

:DB_ONLY
cls
echo ========================================
echo   Database Setup
echo ========================================
echo.
call :SETUP_DATABASE
echo.
echo ✅ Database setup completed!
pause
goto :eof

:ENV_ONLY
cls
echo ========================================
echo   Environment Configuration
echo ========================================
echo.
call :CREATE_ENV_FILES
echo.
echo ✅ Environment configuration completed!
pause
goto :eof

:VERIFY_SETUP
cls
echo ========================================
echo   Verifying Current Setup
echo ========================================
echo.
call :VERIFY_CURRENT_SETUP
echo.
pause
goto :eof

REM ========================================
REM SETUP FUNCTIONS
REM ========================================

:INSTALL_DEPENDENCIES
echo 📦 Installing dependencies...
echo.

echo Installing backend dependencies...
npm install
if !errorlevel! neq 0 (
    echo ❌ Failed to install backend dependencies
    goto :eof
)
echo ✅ Backend dependencies installed

echo.
echo Installing frontend dependencies...
cd client
npm install
if !errorlevel! neq 0 (
    echo ❌ Failed to install frontend dependencies
    cd ..
    goto :eof
)
cd ..
echo ✅ Frontend dependencies installed

echo.
echo Installing global tools...
npm install -g nodemon concurrently
echo ✅ Global tools installed
goto :eof

:SETUP_DATABASE
echo 🗄️  Setting up databases...
echo.

echo Creating development database...
createdb chatbot_development 2>nul
if !errorlevel! equ 0 (
    echo ✅ Development database created
) else (
    echo ⚠️  Development database may already exist
)

echo Creating production database...
createdb chatbot_production 2>nul
if !errorlevel! equ 0 (
    echo ✅ Production database created
) else (
    echo ⚠️  Production database may already exist
)

echo Initializing database schema...
npm run db:init
if !errorlevel! equ 0 (
    echo ✅ Database schema initialized
) else (
    echo ❌ Failed to initialize database schema
)
goto :eof

:CREATE_ENV_FILES
echo 📝 Creating environment configuration files...
echo.

REM Create development environment
echo Creating development environment (.env.development)...

REM Try to read API key from API.txt file
set setup_openai_key=your_openai_api_key_here
if exist "API.txt" (
    echo   📋 Found API.txt file, including OpenAI API key...
    for /f "delims=" %%i in (API.txt) do set setup_openai_key=%%i
) else (
    echo   ℹ️  API.txt not found, using placeholder
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
echo SESSION_SECRET=dev_session_secret_change_in_production
echo JWT_SECRET=dev_jwt_secret_change_in_production
echo ADMIN_PASSWORD=admin123
echo OPENAI_API_KEY=!setup_openai_key!
) > .env.development

echo ✅ Development environment file created

REM Create production environment template
echo Creating production environment template (.env.production.template)...
(
echo NODE_ENV=production
echo PORT=5000
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_production
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=chatbot_production
echo DB_USER=postgres
echo DB_PASSWORD=postgres
echo LOG_LEVEL=info
echo SESSION_SECRET=CHANGE_THIS_IN_PRODUCTION
echo JWT_SECRET=CHANGE_THIS_IN_PRODUCTION
echo ADMIN_PASSWORD=CHANGE_THIS_IN_PRODUCTION
echo OPENAI_API_KEY=!setup_openai_key!
) > .env.production.template

echo ✅ Production environment template created

echo.
echo 📋 Environment files created:
echo   .env.development - Ready to use for development
echo   .env.production.template - Template for production
echo.
echo ⚠️  For production use:
echo   1. Copy .env.production.template to .env
echo   2. Update all CHANGE_THIS values
echo   3. Add your OpenAI API key
goto :eof

:INITIALIZE_DATA
echo 📊 Initializing sample data...
echo.

echo Seeding database with sample data...
npm run db:seed 2>nul
if !errorlevel! equ 0 (
    echo ✅ Sample data initialized
) else (
    echo ⚠️  Sample data initialization skipped (may not be available)
)

echo Ingesting sample documents...
npm run ingest 2>nul
if !errorlevel! equ 0 (
    echo ✅ Sample documents ingested
) else (
    echo ⚠️  Document ingestion skipped (may not be available)
)
goto :eof

:VERIFY_CURRENT_SETUP
echo 🔍 Verifying current setup...
echo.

echo DEPENDENCIES:
if exist "node_modules" (
    echo ✅ Backend dependencies: Installed
) else (
    echo ❌ Backend dependencies: Not installed
)

if exist "client\node_modules" (
    echo ✅ Frontend dependencies: Installed
) else (
    echo ❌ Frontend dependencies: Not installed
)

echo.
echo ENVIRONMENT FILES:
if exist ".env" (
    echo ✅ Environment file: .env exists
) else (
    echo ❌ Environment file: .env not found
)

if exist ".env.development" (
    echo ✅ Development environment: .env.development exists
) else (
    echo ❌ Development environment: .env.development not found
)

if exist ".env.production.template" (
    echo ✅ Production template: .env.production.template exists
) else (
    echo ❌ Production template: .env.production.template not found
)

echo.
echo DATABASE CONNECTIVITY:
echo Testing database connections...

REM Test development database
psql -d chatbot_development -c "SELECT 1;" >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ Development database: Connected
) else (
    echo ❌ Development database: Connection failed
)

REM Test production database
psql -d chatbot_production -c "SELECT 1;" >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ Production database: Connected
) else (
    echo ❌ Production database: Connection failed
)

echo.
echo SYSTEM STATUS:
echo Node.js: !NODE_VERSION!
echo npm: !NPM_VERSION!

where psql >nul 2>&1
if !errorlevel! equ 0 (
    echo PostgreSQL: Available
) else (
    echo PostgreSQL: Not available in PATH
)
goto :eof

:QUIT
echo.
echo Setup wizard cancelled.
echo.
timeout /t 2 /nobreak >nul
exit /b 0
