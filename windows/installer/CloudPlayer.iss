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
Source: "{#VcRedistPath}"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\CloudPlayer"; Filename: "{app}\CloudPlayer.exe"
Name: "{autodesktop}\CloudPlayer"; Filename: "{app}\CloudPlayer.exe"; Tasks: desktopicon

[Code]
const
  VcRedistExeName = '{#VcRedistFileName}';
  VcRuntimeKey = 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64';

function NeedsVCRuntime: Boolean;
var
  Installed: Cardinal;
begin
  Result := True;
  if RegQueryDWordValue(HKLM64, VcRuntimeKey, 'Installed', Installed) then begin
    Result := Installed <> 1;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  InstallerPath: String;
begin
  Result := '';
  if not NeedsVCRuntime() then begin
    Exit;
  end;

  ExtractTemporaryFile(VcRedistExeName);
  InstallerPath := ExpandConstant('{tmp}\' + VcRedistExeName);

  if not Exec(
    InstallerPath,
    '/install /quiet /norestart',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then begin
    Result := 'Unable to launch the Microsoft Visual C++ runtime installer.';
    Exit;
  end;

  case ResultCode of
    0, 1638:
      begin
      end;
    3010:
      begin
        NeedsRestart := True;
      end;
  else
    Result :=
      'Microsoft Visual C runtime installation failed with code ' +
      IntToStr(ResultCode) +
      '.';
  end;
end;

[Run]
Filename: "{app}\CloudPlayer.exe"; Description: "{cm:LaunchProgram,CloudPlayer}"; Flags: nowait postinstall skipifsilent
