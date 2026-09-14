@echo off
setlocal
title Body OS - Build Android APK
echo Body OS Android APK builder
echo Enter your signing-key password when asked. Do not share it in chat.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Build-Android-APK.ps1"
if errorlevel 1 (
  echo.
  echo The build did not finish successfully. Send the last error lines to Codex.
) else (
  echo.
  echo APK ready at:
  echo E:\Workout OS\apps\mobile\android\app\build\outputs\apk\release\app-release.apk
)
echo.
pause
endlocal
