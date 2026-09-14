@echo off
powershell.exe -NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -Command ". '%~dp0scripts\BodyOS-Environment.ps1'; Set-Location -LiteralPath '%~dp0'; Write-Host 'Body OS terminal: build tools and caches use E:.'"
