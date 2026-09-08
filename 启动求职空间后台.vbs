Option Explicit

Dim shell, scriptPath, basePath, command
Set shell = CreateObject("WScript.Shell")

scriptPath = WScript.ScriptFullName
basePath = Left(scriptPath, InStrRev(scriptPath, "\") - 1)

command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & basePath & "\scripts\start-career-space.ps1"""
shell.Run command, 0, False

Set shell = Nothing
