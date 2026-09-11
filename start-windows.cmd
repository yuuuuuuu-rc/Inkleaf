@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Inkleaf needs Node.js 18 or newer.
  echo Download it from https://nodejs.org/ and then run this file again.
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 (
  echo Your Node.js version is too old. Inkleaf needs Node.js 18 or newer.
  pause
  exit /b 1
)

node server.cjs --open
if errorlevel 1 (
  echo.
  echo Inkleaf could not start. Check the troubleshooting section in README.md.
  pause
)
