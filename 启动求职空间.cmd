@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在启动求职空间。关闭此窗口会停止本地服务。
call npm start
