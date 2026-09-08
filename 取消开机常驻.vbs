Option Explicit

Dim shell, fileSystem, startupPath, shortcutPath
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

startupPath = shell.SpecialFolders("Startup")
shortcutPath = startupPath & "\Career Space 4455.lnk"

If fileSystem.FileExists(shortcutPath) Then
  fileSystem.DeleteFile shortcutPath, True
  shell.Popup "Startup disabled. The currently running local server was not stopped.", 5, "Career Space", 64
Else
  shell.Popup "No Career Space startup entry was found.", 5, "Career Space", 64
End If

Set fileSystem = Nothing
Set shell = Nothing
