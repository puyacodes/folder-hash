@echo off
setlocal enabledelayedexpansion

set newVersion=%NEW_VERSION%

for /f "tokens=* delims= " %%a in ("%newVersion%") do set newVersion=%%a

:trim
if "!newVersion!"=="" goto end_trim
if "!newVersion:~-1!"==" " (
    set newVersion=!newVersion:~0,-1!
    goto trim
)

:end_trim

git add .
git commit -m "released v%newVersion%"
git push gh
git push origin
call npm publish --access public
