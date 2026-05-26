@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_FILE=%SCRIPT_DIR%dev_windows.ps1"

if not exist "%POWERSHELL_FILE%" (
  echo Missing launcher target:
  echo   %POWERSHELL_FILE%
  echo.
  pause
  exit /b 1
)

echo Starting CloudPlayer Windows dev mode...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_FILE%" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo dev_windows.ps1 failed with exit code %EXIT_CODE%.
) else (
  echo dev_windows.ps1 finished.
)
echo.
pause
exit /b %EXIT_CODE%
