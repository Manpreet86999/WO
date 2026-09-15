
[Setup]
AppId={{A7C3E8F1-4B2D-4E9A-9C1F-8D6B5A0E2F73}}
AppName=Body OS
AppVersion=4.5.62
DefaultDirName={pf}\Body OS
DefaultGroupName=Body OS
OutputDir=release
OutputBaseFilename=WorkoutOS-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
UsePreviousAppDir=yes
CloseApplications=yes
RestartApplications=no

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,release\*,dist\*,backups\*,data\*,scratch\*,apps\*,design\*,installer\*,.git\*,.github\*,.build-tools\*,.gradle-user-home\*,.pnpm-store\*,test-results\*,tests\*,docs\*,*.log,*.sqlite,*.db,*.exe,unins*.dat,setup.iss,console.log*,google-fit-debug.json"
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Body OS"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
; Use the current user's Desktop. Many managed PCs deny writes to the shared
; Public Desktop, which previously stopped an otherwise valid installation.
Name: "{userdesktop}\Body OS"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Run]
Filename: "{app}\start.bat"; Description: "{cm:LaunchProgram,Body OS}"; Flags: shellexec postinstall nowait
