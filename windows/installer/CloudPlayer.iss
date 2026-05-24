; Shared Inno Setup script for per-architecture CloudPlayer desktop installers.
[Setup]
AppId=com.cloudplayer.desktop.{#ArchSlug}
AppName=CloudPlayer
AppVersion={#AppVersion}
AppPublisher=CloudPlayer
DefaultDirName={autopf}\CloudPlayer
DefaultGroupName=CloudPlayer
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed={#ArchitecturesAllowed}
ArchitecturesInstallIn64BitMode={#ArchitecturesInstallIn64BitMode}
PrivilegesRequired=admin
UninstallDisplayIcon={app}\CloudPlayer.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\CloudPlayer"; Filename: "{app}\CloudPlayer.exe"
Name: "{autodesktop}\CloudPlayer"; Filename: "{app}\CloudPlayer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\CloudPlayer.exe"; Description: "{cm:LaunchProgram,CloudPlayer}"; Flags: nowait postinstall skipifsilent
