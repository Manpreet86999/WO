@echo off
setlocal

echo ==================================================
echo Stopping Body OS...
echo ==================================================

REM Kill node processes listening on ports (with child processes /T)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":10000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

REM Kill terminal windows with Body OS title
taskkill /F /FI "WINDOWTITLE eq Body OS Server*" /IM cmd.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Body OS Server*" /IM powershell.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Body OS Server*" /IM WindowsTerminal.exe /T >nul 2>&1

echo Body OS has been stopped.
timeout /t 2 >nul
endlocal
