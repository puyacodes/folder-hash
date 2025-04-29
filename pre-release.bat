@echo off
setlocal enabledelayedexpansion

if %NEW_VERSION%=="" (
    echo Please provide the new version as an argument.
    exit /b 1
)

set newVersion=%NEW_VERSION%

for /f "tokens=* delims= " %%a in ("%newVersion%") do set newVersion=%%a

:trim
if "!newVersion!"=="" goto end_trim
if "!newVersion:~-1!"==" " (
    set newVersion=!newVersion:~0,-1!
    goto trim
)

:end_trim

set tempFile=pack_temp.json

(for /f "usebackq delims=" %%A in ("package.json") do (
    set line=%%A
    echo !line! | findstr /r "\"version\":.*" >nul
    if !errorlevel! == 0 (
        echo   "version": "!newVersion!", >> "!tempFile!"
    ) else (
        echo !line! >> "!tempFile!"
    )
)) || exit /b 1

move /y "!tempFile!" package.json >nul
