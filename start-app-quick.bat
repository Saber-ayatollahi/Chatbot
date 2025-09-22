@echo off
echo ========================================
echo   DEPRECATED: start-app-quick.bat
echo ========================================
echo.
echo This file has been replaced with improved launchers:
echo.
echo ✅ Use: start-chatbot.bat
echo    - Interactive menu with dev/prod options
echo    - Better error handling
echo    - Environment configuration
echo.
echo ✅ Use: setup-environment.bat  
echo    - First-time setup wizard
echo    - Dependency installation
echo    - Database initialization
echo.
echo ✅ Use: stop-chatbot-enhanced.bat
echo    - Graceful shutdown options
echo    - Service management
echo    - Cleanup utilities
echo.
echo Redirecting to new launcher in 5 seconds...
echo Press any key to skip wait...
timeout /t 5 /nobreak >nul

echo.
echo Starting new launcher...
call start-chatbot.bat
