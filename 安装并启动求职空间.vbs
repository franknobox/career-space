Option Explicit

Dim shell, scriptPath, basePath, command, exitCode
Set shell = CreateObject("WScript.Shell")

scriptPath = WScript.ScriptFullName
basePath = Left(scriptPath, InStrRev(scriptPath, "\") - 1)
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & basePath & "\scripts\install-career-space.ps1"""

exitCode = shell.Run(command, 0, True)
If exitCode <> 0 Then
  shell.Popup "Installation or startup failed. Check career-space.log or use the command-line instructions in README.md.", 0, "Career Space", 16
End If

Set shell = Nothing
