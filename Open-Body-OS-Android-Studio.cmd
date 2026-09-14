@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ". '%~dp0scripts\BodyOS-Environment.ps1'; & 'E:\Android Studio\bin\studio64.exe' '%~dp0apps\mobile\android'"
