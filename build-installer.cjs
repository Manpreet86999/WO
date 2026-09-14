const fs = require('fs');
const path = require('path');
const inno = require('innosetup-compiler');

const pkg = require('./package.json');
const appName = "Body OS";
// Keep this legacy filename: older 2.x clients only recognise WorkoutOS-Setup.exe.
const exeName = "WorkoutOS-Setup.exe";
const requirementsFile = path.join(__dirname, 'requirements.txt');
const requirementsVerifier = path.join(__dirname, 'scripts', 'verify-update-requirements.cjs');

if (!fs.existsSync(requirementsFile) || !fs.existsSync(requirementsVerifier)) {
  console.error('Missing embedded update requirements files. Restore requirements.txt and scripts/verify-update-requirements.cjs before building.');
  process.exit(1);
}
// Old builds may have left this beside the installer. It is now embedded, never published separately.
fs.rmSync(path.join(__dirname, 'release', 'requirements.txt'), { force: true });

const issContent = `
[Setup]
AppId={{A7C3E8F1-4B2D-4E9A-9C1F-8D6B5A0E2F73}}
AppName=${appName}
AppVersion=${pkg.version}
DefaultDirName={pf}\\${appName}
DefaultGroupName=${appName}
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
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\\*,release\\*,dist\\*,backups\\*,data\\*,scratch\\*,apps\\*,design\\*,installer\\*,.git\\*,.github\\*,.build-tools\\*,.gradle-user-home\\*,.pnpm-store\\*,test-results\\*,tests\\*,docs\\*,*.log,*.sqlite,*.db,*.exe,unins*.dat,setup.iss,console.log*"
Source: "dist\\*"; DestDir: "{app}\\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\${appName}"; Filename: "{app}\\start.bat"; WorkingDir: "{app}"
; Use the current user's Desktop. Many managed PCs deny writes to the shared
; Public Desktop, which previously stopped an otherwise valid installation.
Name: "{userdesktop}\\${appName}"; Filename: "{app}\\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Run]
Filename: "{app}\\start.bat"; Description: "{cm:LaunchProgram,${appName}}"; Flags: shellexec postinstall nowait
`;

fs.writeFileSync('setup.iss', issContent);

console.log('Compiling installer...');
inno('setup.iss', { gui: false, verbose: true }, function(error) {
  if (error) {
    console.error('Failed to compile installer:', error);
    process.exit(1);
  }
  console.log('Successfully created release/' + exeName);
  console.log('requirements.txt is embedded inside the installer — upload only this .exe file.');
});
