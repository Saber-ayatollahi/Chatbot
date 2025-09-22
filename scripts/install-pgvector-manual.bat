@echo off
echo ========================================
echo pgvector Manual Installation for Windows
echo ========================================
echo.

set POSTGRES_PATH=C:\Program Files\PostgreSQL\16
set PGVECTOR_VERSION=v0.8.0

echo 1. Checking PostgreSQL installation...
if not exist "%POSTGRES_PATH%\bin\psql.exe" (
    echo ERROR: PostgreSQL not found at %POSTGRES_PATH%
    echo Please update POSTGRES_PATH in this script
    pause
    exit /b 1
)

echo ✅ PostgreSQL 16 found at: %POSTGRES_PATH%
echo.

echo 2. Creating temporary directory...
if not exist "temp_pgvector" mkdir temp_pgvector
cd temp_pgvector

echo 3. Downloading pgvector source...
echo Downloading from: https://github.com/pgvector/pgvector/archive/refs/tags/%PGVECTOR_VERSION%.zip

powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/pgvector/pgvector/archive/refs/tags/%PGVECTOR_VERSION%.zip' -OutFile 'pgvector.zip'}"

if not exist "pgvector.zip" (
    echo ERROR: Failed to download pgvector
    pause
    exit /b 1
)

echo ✅ Downloaded pgvector source
echo.

echo 4. Extracting archive...
powershell -Command "& {Expand-Archive -Path 'pgvector.zip' -DestinationPath '.' -Force}"

if not exist "pgvector-%PGVECTOR_VERSION:~1%" (
    echo ERROR: Failed to extract pgvector
    pause
    exit /b 1
)

cd pgvector-%PGVECTOR_VERSION:~1%

echo ✅ Extracted pgvector source
echo.

echo 5. Checking for build tools...
where cl >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo WARNING: Microsoft C++ compiler not found
    echo You need Visual Studio Build Tools or Visual Studio
    echo Download from: https://visualstudio.microsoft.com/downloads/
    echo.
    echo Alternative: Use pre-compiled binaries (see manual steps below)
    pause
)

echo.
echo ========================================
echo MANUAL INSTALLATION STEPS
echo ========================================
echo.
echo Since automatic compilation may not work, here are manual steps:
echo.
echo OPTION 1: Pre-compiled Binaries (Recommended)
echo 1. Visit: https://github.com/pgvector/pgvector/releases
echo 2. Download Windows binaries for PostgreSQL 16
echo 3. Copy files to PostgreSQL directories:
echo    - Copy *.dll to: %POSTGRES_PATH%\lib\
echo    - Copy *.sql to: %POSTGRES_PATH%\share\extension\
echo    - Copy *.control to: %POSTGRES_PATH%\share\extension\
echo.
echo OPTION 2: Using Stack Builder (Easiest)
echo 1. Run: %POSTGRES_PATH%\bin\StackBuilder.exe
echo 2. Select your PostgreSQL installation
echo 3. Look for pgvector in Extensions category
echo 4. Install if available
echo.
echo OPTION 3: Manual SQL Installation
echo 1. Download vector--0.8.0.sql from pgvector releases
echo 2. Run the SQL commands manually in your database
echo.
echo After installation, run: npm run test:pgvector
echo.
pause
