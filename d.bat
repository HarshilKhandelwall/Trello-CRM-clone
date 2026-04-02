@echo off
echo ===================================================
echo Trello CRM Clone - Quick Deploy Script
echo ===================================================

echo.
echo [1/3] Adding and committing local changes...
git add .
set /p commit_msg="Enter commit message (or press enter for default): "
if "%commit_msg%"=="" set commit_msg=Auto deploy update
git commit -m "%commit_msg%"

echo.
echo [2/3] Pushing changes to remote repository...
git push origin main

echo.
echo [3/3] Connecting to VPS to pull and restart...
:: Connects via SSH to automate the pull and systemctl commands
ssh root@166.0.244.228 "cd /root/Trello-CRM-clone && git pull origin main && cd frontend && npm install && npm run build && cd ../backend && systemctl restart crm"

echo.
echo ===================================================
echo Deployment Complete! 
echo ===================================================
pause
