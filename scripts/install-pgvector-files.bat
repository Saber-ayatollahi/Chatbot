@echo off
echo ========================================
echo pgvector File Installation Helper
echo ========================================
echo.

set POSTGRES_PATH=C:\Program Files\PostgreSQL\16

echo This script helps you install pgvector files manually.
echo.
echo BEFORE RUNNING THIS SCRIPT:
echo 1. Download pgvector binaries for PostgreSQL 16
echo 2. Extract the files to a folder
echo 3. Note the path to the extracted files
echo.

set /p SOURCE_PATH="Enter path to extracted pgvector files (e.g., C:\Downloads\pgvector-win): "

if not exist "%SOURCE_PATH%" (
    echo ERROR: Source path does not exist: %SOURCE_PATH%
    pause
    exit /b 1
)

echo.
echo Checking for required files...

if exist "%SOURCE_PATH%\vector.dll" (
    echo ✅ Found vector.dll
) else (
    echo ❌ vector.dll not found in %SOURCE_PATH%
)

if exist "%SOURCE_PATH%\vector.control" (
    echo ✅ Found vector.control
) else (
    echo ❌ vector.control not found in %SOURCE_PATH%
)

if exist "%SOURCE_PATH%\vector--*.sql" (
    echo ✅ Found SQL files
) else (
    echo ❌ SQL files not found in %SOURCE_PATH%
)

echo.
echo IMPORTANT: This script needs to run as Administrator
echo Press Ctrl+C to cancel and run as Administrator, or
pause

echo.
echo Installing pgvector files...

echo Copying DLL files to lib directory...
if exist "%SOURCE_PATH%\vector.dll" (
    copy "%SOURCE_PATH%\vector.dll" "%POSTGRES_PATH%\lib\" /Y
    if %ERRORLEVEL% equ 0 (
        echo ✅ vector.dll copied successfully
    ) else (
        echo ❌ Failed to copy vector.dll (run as Administrator?)
    )
)

echo.
echo Copying extension files to share\extension directory...
if exist "%SOURCE_PATH%\vector.control" (
    copy "%SOURCE_PATH%\vector.control" "%POSTGRES_PATH%\share\extension\" /Y
    if %ERRORLEVEL% equ 0 (
        echo ✅ vector.control copied successfully
    ) else (
        echo ❌ Failed to copy vector.control (run as Administrator?)
    )
)

if exist "%SOURCE_PATH%\vector--*.sql" (
    copy "%SOURCE_PATH%\vector--*.sql" "%POSTGRES_PATH%\share\extension\" /Y
    if %ERRORLEVEL% equ 0 (
        echo ✅ SQL files copied successfully
    ) else (
        echo ❌ Failed to copy SQL files (run as Administrator?)
    )
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Restart PostgreSQL service:
echo    net stop postgresql-x64-16
echo    net start postgresql-x64-16
echo.
echo 2. Test the installation:
echo    npm run test:pgvector
echo.
echo 3. If test passes, restart your application
echo.
pause
