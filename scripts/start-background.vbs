Option Explicit

Dim shell, scriptPath, scriptsPath, projectPath, command
Set shell = CreateObject("WScript.Shell")

scriptPath = WScript.ScriptFullName
scriptsPath = Left(scriptPath, InStrRev(scriptPath, "\") - 1)
projectPath = Left(scriptsPath, InStrRev(scriptsPath, "\") - 1)
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptsPath & "\start-career-space.ps1"""

shell.CurrentDirectory = projectPath
shell.Run command, 0, False

Set shell = Nothing
