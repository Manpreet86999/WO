@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Install it from https://nodejs.org/
  pause
  exit /b 1
)

echo Stopping any existing instances...
call stop.bat >nul 2>&1

title Body OS Server

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

REM Prefer prebuilt dist (from setup.exe). Set WOS_REBUILD=1 to force a fresh build.
if /i "%WOS_REBUILD%"=="1" goto do_build
if exist "dist\server\index.js" goto after_build
if not exist "src\server\index.ts" (
  echo Missing dist\server\index.js — reinstall Body OS or run npm run build.
  pause
  exit /b 1
)

:do_build
echo.
echo Building Body OS...
call npm.cmd run build
if errorlevel 1 (
  echo Build failed. Review the errors above.
  pause
  exit /b 1
)

:after_build

echo.
echo ==================================================
echo Starting Body OS...
echo URL: http://127.0.0.1:10000
echo Keep this window open to keep the server running.
echo To stop, simply close this window or run stop.bat.
echo ==================================================
echo.

REM The server opens an app-style Body OS window as soon as it is ready.
set "BODY_OS_OPEN_APP=1"
call npm.cmd run start:prod

echo.
echo Server has stopped or crashed.
pause
endlocal
