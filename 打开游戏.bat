@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在用默认浏览器打开《错位夜宵》原型...
start "" "%~dp0index.html"
