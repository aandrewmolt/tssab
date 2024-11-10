@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================
echo GitHub Repository Update Script
echo ===================================

:: Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Git is not installed or not in PATH
    pause
    exit /b 1
)

:: Set the correct repository URL
set "REPO_URL=https://github.com/aandrewmolt/tssab.git"

:: Check if we're in a git repository
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git remote add origin %REPO_URL%
)

:: Check current branch
for /f "tokens=* USEBACKQ" %%F in (`git branch --show-current`) do set "CURRENT_BRANCH=%%F"
if not "%CURRENT_BRANCH%"=="main" (
    echo Switching to main branch...
    git checkout main 2>nul || git checkout -b main
)

:: Status check
echo.
echo Current Git Status:
git status

:: Ask for commit message
echo.
set /p COMMIT_MESSAGE="Enter commit message (or press Enter for default): "
if "!COMMIT_MESSAGE!"=="" set "COMMIT_MESSAGE=Update repository with latest changes"

:: Add all changes
echo.
echo Adding changes...
git add .

:: Commit changes
echo.
echo Committing changes...
git commit -m "%COMMIT_MESSAGE%"

:: Pull latest changes
echo.
echo Pulling latest changes from remote...
git pull origin main

:: Push changes
echo.
echo Pushing changes to remote...
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Failed to push changes. Setting upstream...
    git push --set-upstream origin main
)

echo.
echo ===================================
echo Repository update complete!
echo ===================================
pause 