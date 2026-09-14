@echo off
title Body OS Uninstaller
setlocal
cd /d "%~dp0"

echo ==================================================
echo  WARNING: You are about to DESTROY Body OS!
echo ==================================================
echo This action will permanently delete all your data,
echo settings, source code, and the entire project.
echo This CANNOT be undone.
echo.

set /p confirm="Type 'DESTROY' to confirm: "

if not "%confirm%"=="DESTROY" (
    echo Uninstallation cancelled.
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo Deleting everything in %~dp0...
echo.

REM Stop the project first just in case
call stop.bat >nul 2>&1

REM Delete all files and folders except uninstall.bat
for /f "delims=" %%i in ('dir /b /a') do (
    if /i not "%%i"=="uninstall.bat" (
        if exist "%%i\" (
            rmdir /s /q "%%i"
            echo Deleted directory: %%i/
        ) else (
            del /f /q "%%i"
            echo Deleted file: %%i
        )
    )
)

echo.
echo Uninstallation complete. The project has been wiped.
echo This window will close in 5 seconds.
timeout /t 5 >nul

REM Delete self
(goto) 2>nul & del "%~f0"
