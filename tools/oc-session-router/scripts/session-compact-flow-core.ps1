$ErrorActionPreference = "Stop"

function Initialize-CompactFlowStrictJsonGuard {
  if ($null -ne ('CompactFlow.StrictJsonGuard' -as [type])) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace CompactFlow
{
    public static class StrictJsonGuard
    {
        public static void AssertNoDuplicateMembers(string json)
        {
            if (json == null) throw new FormatException("JSON text is null");
            Parser parser = new Parser(json);
            parser.ParseDocument();
        }

        private sealed class Parser
        {
            private readonly string text;
            private int index;
            internal Parser(string value) { text = value; index = 0; }

            internal void ParseDocument()
            {
                SkipWhitespace(); ParseValue(); SkipWhitespace();
                if (index != text.Length) Fail("Unexpected trailing JSON content");
            }

            private void ParseValue()
            {
                SkipWhitespace();
                if (index >= text.Length) Fail("Unexpected end of JSON");
                char current = text[index];
                if (current == '{') { ParseObject(); return; }
                if (current == '[') { ParseArray(); return; }
                if (current == '"') { ParseString(); return; }
                if (current == 't') { ParseLiteral("true"); return; }
                if (current == 'f') { ParseLiteral("false"); return; }
                if (current == 'n') { ParseLiteral("null"); return; }
                if (current == '-' || (current >= '0' && current <= '9')) { ParseNumber(); return; }
                Fail("Invalid JSON value");
            }

            private void ParseObject()
            {
                Expect('{'); SkipWhitespace();
                HashSet<string> keys = new HashSet<string>(StringComparer.Ordinal);
                if (Consume('}')) return;
                while (true)
                {
                    SkipWhitespace(); string key = ParseString();
                    if (!keys.Add(key)) Fail("Duplicate JSON object member '" + key + "'");
                    SkipWhitespace(); Expect(':'); ParseValue(); SkipWhitespace();
                    if (Consume('}')) return;
                    Expect(',');
                }
            }

            private void ParseArray()
            {
                Expect('['); SkipWhitespace();
                if (Consume(']')) return;
                while (true)
                {
                    ParseValue(); SkipWhitespace();
                    if (Consume(']')) return;
                    Expect(',');
                }
            }

            private string ParseString()
            {
                Expect('"'); StringBuilder builder = new StringBuilder();
                while (index < text.Length)
                {
                    char current = text[index++];
                    if (current == '"') return builder.ToString();
                    if (current < 0x20) Fail("Unescaped control character in JSON string");
                    if (current == '\\')
                    {
                        if (index >= text.Length) Fail("Incomplete JSON escape");
                        char escape = text[index++];
                        switch (escape)
                        {
                            case '"': builder.Append('"'); break;
                            case '\\': builder.Append('\\'); break;
                            case '/': builder.Append('/'); break;
                            case 'b': builder.Append('\b'); break;
                            case 'f': builder.Append('\f'); break;
                            case 'n': builder.Append('\n'); break;
                            case 'r': builder.Append('\r'); break;
                            case 't': builder.Append('\t'); break;
                            case 'u': AppendEscapedUnicode(builder); break;
                            default: Fail("Invalid JSON escape"); break;
                        }
                        continue;
                    }
                    if (char.IsHighSurrogate(current))
                    {
                        if (index >= text.Length || !char.IsLowSurrogate(text[index])) Fail("Unpaired high surrogate in JSON string");
                        builder.Append(current); builder.Append(text[index++]); continue;
                    }
                    if (char.IsLowSurrogate(current)) Fail("Unpaired low surrogate in JSON string");
                    builder.Append(current);
                }
                Fail("Unterminated JSON string"); return null;
            }

            private void AppendEscapedUnicode(StringBuilder builder)
            {
                char first = ParseHexCodeUnit();
                if (char.IsHighSurrogate(first))
                {
                    if (index + 1 >= text.Length || text[index] != '\\' || text[index + 1] != 'u') Fail("Escaped high surrogate lacks a low surrogate");
                    index += 2; char second = ParseHexCodeUnit();
                    if (!char.IsLowSurrogate(second)) Fail("Escaped high surrogate lacks a valid low surrogate");
                    builder.Append(first); builder.Append(second); return;
                }
                if (char.IsLowSurrogate(first)) Fail("Escaped low surrogate has no high surrogate");
                builder.Append(first);
            }

            private char ParseHexCodeUnit()
            {
                if (index + 4 > text.Length) Fail("Incomplete Unicode escape");
                int value = 0;
                for (int offset = 0; offset < 4; offset++)
                {
                    int digit = HexValue(text[index++]);
                    if (digit < 0) Fail("Invalid Unicode escape");
                    value = (value << 4) | digit;
                }
                return (char)value;
            }

            private static int HexValue(char value)
            {
                if (value >= '0' && value <= '9') return value - '0';
                if (value >= 'a' && value <= 'f') return value - 'a' + 10;
                if (value >= 'A' && value <= 'F') return value - 'A' + 10;
                return -1;
            }

            private void ParseNumber()
            {
                if (Consume('-') && index >= text.Length) Fail("Incomplete JSON number");
                if (Consume('0')) { if (index < text.Length && char.IsDigit(text[index])) Fail("Leading zero in JSON number"); }
                else { RequireDigits(); }
                if (Consume('.')) RequireDigits();
                if (index < text.Length && (text[index] == 'e' || text[index] == 'E'))
                {
                    index++;
                    if (index < text.Length && (text[index] == '+' || text[index] == '-')) index++;
                    RequireDigits();
                }
            }

            private void RequireDigits()
            {
                int start = index;
                while (index < text.Length && char.IsDigit(text[index])) index++;
                if (index == start) Fail("Expected JSON number digit");
            }

            private void ParseLiteral(string literal)
            {
                for (int offset = 0; offset < literal.Length; offset++)
                    if (index >= text.Length || text[index++] != literal[offset]) Fail("Invalid JSON literal");
            }

            private void SkipWhitespace()
            {
                while (index < text.Length && (text[index] == ' ' || text[index] == '\t' || text[index] == '\r' || text[index] == '\n')) index++;
            }

            private bool Consume(char expected)
            {
                if (index < text.Length && text[index] == expected) { index++; return true; }
                return false;
            }

            private void Expect(char expected) { if (!Consume(expected)) Fail("Expected '" + expected + "'"); }
            private void Fail(string message) { throw new FormatException(message + " at character " + index.ToString(CultureInfo.InvariantCulture)); }
        }
    }
}
'@
}

function Initialize-CompactFlowFileHandleGuard {
  if ($null -ne ('CompactFlow.FileHandleGuard' -as [type])) { return }
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace CompactFlow
{
    [StructLayout(LayoutKind.Sequential)]
    internal struct ByHandleFileInformation
    {
        public uint FileAttributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
        public uint VolumeSerialNumber;
        public uint FileSizeHigh;
        public uint FileSizeLow;
        public uint NumberOfLinks;
        public uint FileIndexHigh;
        public uint FileIndexLow;
    }

    public static class FileHandleGuard
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint pathLength, uint flags);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out ByHandleFileInformation information);

        public static string GetFinalPath(SafeFileHandle handle)
        {
            StringBuilder path = new StringBuilder(32768);
            uint length = GetFinalPathNameByHandle(handle, path, (uint)path.Capacity, 0);
            if (length == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
            if (length >= path.Capacity) throw new InvalidOperationException("Final path exceeds the fixed verification buffer.");
            return path.ToString();
        }

        public static uint GetLinkCount(SafeFileHandle handle)
        {
            ByHandleFileInformation information;
            if (!GetFileInformationByHandle(handle, out information)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return information.NumberOfLinks;
        }
    }
}
'@
}

function Assert-CompactFlowStrictJson {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Text, [string]$Label = "JSON")
  Initialize-CompactFlowStrictJsonGuard
  try { [CompactFlow.StrictJsonGuard]::AssertNoDuplicateMembers($Text) }
  catch { throw "$Label is not strict JSON: $($_.Exception.Message)" }
}

function Get-CompactFlowProperty {
  param($Value, [string]$Name, $DefaultValue = $null)
  if ($null -eq $Value) { return $DefaultValue }
  if ($Value -is [System.Collections.IDictionary]) {
    if ($Value.Contains($Name)) { return $Value[$Name] }
    return $DefaultValue
  }
  $Property = $Value.PSObject.Properties[$Name]
  if ($null -eq $Property) { return $DefaultValue }
  return $Property.Value
}

function Get-CompactFlowPropertyNames {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Collections.IDictionary]) { return @($Value.Keys | ForEach-Object { [string]$_ }) }
  return @($Value.PSObject.Properties | ForEach-Object { [string]$_.Name })
}

function Assert-CompactFlowExactProperties {
  param($Value, [string[]]$Allowed, [string[]]$Required = @(), [string]$Label)
  if ($null -eq $Value) { throw "$Label must be an object." }
  $Names = @(Get-CompactFlowPropertyNames -Value $Value)
  foreach ($Name in $Names) { if ($Allowed -cnotcontains $Name) { throw "$Label has unknown field '$Name'." } }
  foreach ($Name in $Required) { if ($Names -cnotcontains $Name) { throw "$Label is missing required field '$Name'." } }
}

function Get-CompactFlowSha256Bytes {
  param([byte[]]$Bytes)
  $Sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
  finally { $Sha.Dispose() }
}

function Get-CompactFlowSha256Text {
  param([AllowEmptyString()][string]$Text)
  return Get-CompactFlowSha256Bytes -Bytes ([Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-CompactFlowFileSha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function ConvertTo-CompactFlowCanonicalJson {
  param($Value)
  if ($null -eq $Value) { return 'null' }
  if ($Value -is [bool]) { return $(if ($Value) { 'true' } else { 'false' }) }
  if ($Value -is [string] -or $Value -is [char]) { return ($Value.ToString() | ConvertTo-Json -Compress) }
  if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or
      $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or
      $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
    return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
  }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [System.Collections.IDictionary] -and $Value -isnot [pscustomobject]) {
    $Items = @($Value | ForEach-Object { ConvertTo-CompactFlowCanonicalJson -Value $_ })
    return '[' + ($Items -join ',') + ']'
  }
  $Names = New-Object System.Collections.Generic.List[string]
  foreach ($Name in @(Get-CompactFlowPropertyNames -Value $Value)) { $Names.Add($Name) }
  $Names.Sort([StringComparer]::Ordinal)
  $Rows = @()
  foreach ($Name in $Names) {
    $Rows += (($Name | ConvertTo-Json -Compress) + ':' + (ConvertTo-CompactFlowCanonicalJson -Value (Get-CompactFlowProperty -Value $Value -Name $Name)))
  }
  return '{' + ($Rows -join ',') + '}'
}

function Get-CompactFlowObjectIdentity {
  param($Value)
  return Get-CompactFlowSha256Text -Text (ConvertTo-CompactFlowCanonicalJson -Value $Value)
}

function Assert-CompactFlowNoNumericValues {
  param($Value, [string]$Label = 'Command entry')
  if ($null -eq $Value -or $Value -is [string] -or $Value -is [char] -or $Value -is [bool]) { return }
  if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or
      $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or
      $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) { throw "$Label contains a forbidden numeric value." }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [System.Collections.IDictionary] -and $Value -isnot [pscustomobject]) {
    foreach ($Item in $Value) { Assert-CompactFlowNoNumericValues -Value $Item -Label $Label }
    return
  }
  foreach ($Name in @(Get-CompactFlowPropertyNames -Value $Value)) { Assert-CompactFlowNoNumericValues -Value (Get-CompactFlowProperty -Value $Value -Name $Name) -Label $Label }
}

function Get-CompactFlowCommandEntryIdentity {
  param($Value)
  Assert-CompactFlowNoNumericValues -Value $Value
  return Get-CompactFlowObjectIdentity -Value $Value
}

function Read-CompactFlowStrictJsonFile {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing." }
  $Item = Get-Item -LiteralPath $Path -Force
  if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  $Text = [IO.File]::ReadAllText($Item.FullName, [Text.Encoding]::UTF8)
  Assert-CompactFlowStrictJson -Text $Text -Label $Label
  return [pscustomobject]@{ Value = ($Text | ConvertFrom-Json); Text = $Text; Path = $Item.FullName; Sha256 = (Get-CompactFlowFileSha256 -Path $Item.FullName) }
}

function Test-CompactFlowStableId {
  param($Value)
  return $Value -is [string] -and [string]$Value -cmatch '^[a-z0-9][a-z0-9.-]*$'
}

function Test-CompactFlowLogicalSessionRef {
  param($Value)
  return (Test-CompactFlowStableId -Value $Value) -and [string]$Value -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
}

function Assert-CompactFlowPrivacySafeValue {
  param($Value, [string]$Path = 'event')
  if ($null -eq $Value -or $Value -is [bool] -or $Value -is [ValueType]) { return }
  if ($Value -is [string]) {
    if ($Value -match '(?i)https?://' -or $Value -match '(?i)\bses_[A-Za-z0-9_-]+' -or $Value -match '^[A-Za-z]:[\\/]' -or $Value -match '^\\\\' -or $Value -match '(?i)(password|credential|token|api[_-]?key)\s*[:=]') { throw "$Path contains forbidden concrete runtime or credential-shaped data." }
    return
  }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [System.Collections.IDictionary] -and $Value -isnot [pscustomobject]) {
    $Index=0;foreach($Item in $Value){Assert-CompactFlowPrivacySafeValue -Value $Item -Path "$Path[$Index]";$Index++};return
  }
  $ForbiddenNames=@('session_id','sessionid','password','credential','endpoint','port','transcript','raw_output','route_body','message_body')
  foreach($Name in @(Get-CompactFlowPropertyNames -Value $Value)){
    if([string]$Name.ToLowerInvariant() -in $ForbiddenNames){throw "$Path contains forbidden privacy field '$Name'."}
    Assert-CompactFlowPrivacySafeValue -Value (Get-CompactFlowProperty -Value $Value -Name $Name) -Path "$Path.$Name"
  }
}

function Assert-CompactFlowPolicy {
  param($Policy, [ValidateSet('global', 'project_override')][string]$ExpectedScope)
  $Allowed = @('schema_version','contract','scope','mode','checks','warn_ratio','critical_ratio','compact_warn_at_first_safe_boundary','block_long_stage_at_critical','compact_epic_participants_after_closeout','safe_boundary_required','maximum_retry_count','project_override','excluded_role_profiles','required_gates')
  $Required = if ($ExpectedScope -ceq 'global') {
    @('schema_version','contract','scope','mode','checks','warn_ratio','critical_ratio','compact_warn_at_first_safe_boundary','block_long_stage_at_critical','compact_epic_participants_after_closeout','safe_boundary_required','maximum_retry_count','project_override')
  } else { @('schema_version','contract','scope') }
  Assert-CompactFlowExactProperties -Value $Policy -Allowed $Allowed -Required $Required -Label "$ExpectedScope compact policy"
  if ([string]$Policy.schema_version -cne '1' -or [string]$Policy.contract -cne 'opencode-compact-policy/v1' -or [string]$Policy.scope -cne $ExpectedScope) { throw "$ExpectedScope compact policy identity is invalid." }
  if ($ExpectedScope -ceq 'project_override' -and (Get-CompactFlowPropertyNames -Value $Policy).Count -le 3) { throw 'Project compact policy override is empty.' }
  if ($null -ne $Policy.PSObject.Properties['mode'] -and [string]$Policy.mode -cnotin @('auto_safe','recommend','ask','disabled')) { throw 'Compact policy mode is invalid.' }
  if ($null -ne $Policy.PSObject.Properties['checks']) {
    $Checks = @($Policy.checks)
    if ($Checks.Count -eq 0 -or @($Checks | Select-Object -Unique).Count -ne $Checks.Count -or @($Checks | Where-Object { [string]$_ -cnotin @('before_dispatch','after_stage_output','epic_closeout') }).Count -gt 0) { throw 'Compact policy checks are invalid.' }
  }
  foreach ($Name in @('warn_ratio','critical_ratio')) {
    if ($null -ne $Policy.PSObject.Properties[$Name]) {
      $Value = [double]$Policy.$Name
      if ($Value -le 0 -or $Value -ge 1) { throw "Compact policy $Name is invalid." }
    }
  }
  if ($null -ne $Policy.PSObject.Properties['warn_ratio'] -and $null -ne $Policy.PSObject.Properties['critical_ratio'] -and [double]$Policy.critical_ratio -le [double]$Policy.warn_ratio) { throw 'Compact policy critical_ratio must exceed warn_ratio.' }
  foreach ($Name in @('compact_warn_at_first_safe_boundary','block_long_stage_at_critical','compact_epic_participants_after_closeout','safe_boundary_required')) {
    if ($null -ne $Policy.PSObject.Properties[$Name] -and $Policy.$Name -isnot [bool]) { throw "Compact policy $Name must be boolean." }
  }
  if ($null -ne $Policy.PSObject.Properties['maximum_retry_count'] -and ([int]$Policy.maximum_retry_count -lt 0 -or [int]$Policy.maximum_retry_count -gt 1)) { throw 'Compact policy maximum_retry_count is invalid.' }
  if ($null -ne $Policy.PSObject.Properties['project_override'] -and [string]$Policy.project_override -cne 'tighten_only') { throw 'Compact policy project_override must be tighten_only.' }
  foreach ($Name in @('excluded_role_profiles','required_gates')) {
    if ($null -ne $Policy.PSObject.Properties[$Name]) {
      $Values = @($Policy.$Name)
      if (@($Values | Select-Object -Unique).Count -ne $Values.Count -or @($Values | Where-Object { -not (Test-CompactFlowStableId -Value $_) }).Count -gt 0) { throw "Compact policy $Name is invalid." }
    }
  }
}

function Resolve-CompactFlowPolicyObjects {
  param($GlobalPolicy, $ProjectOverride = $null, [string]$GlobalSha256 = '', [string]$OverrideSha256 = '')
  Assert-CompactFlowPolicy -Policy $GlobalPolicy -ExpectedScope global
  $Effective = [ordered]@{}
  foreach ($Name in @('schema_version','contract','mode','checks','warn_ratio','critical_ratio','compact_warn_at_first_safe_boundary','block_long_stage_at_critical','compact_epic_participants_after_closeout','safe_boundary_required','maximum_retry_count','project_override')) { $Effective[$Name] = $GlobalPolicy.$Name }
  $Effective.excluded_role_profiles = @($(if ($null -ne $GlobalPolicy.PSObject.Properties['excluded_role_profiles']) { @($GlobalPolicy.excluded_role_profiles) } else { @() }))
  $Effective.required_gates = @($(if ($null -ne $GlobalPolicy.PSObject.Properties['required_gates']) { @($GlobalPolicy.required_gates) } else { @() }))
  $Diagnostics = New-Object System.Collections.Generic.List[string]
  $AutomaticActionAllowed = $true
  if ($null -ne $ProjectOverride) {
    try {
      Assert-CompactFlowPolicy -Policy $ProjectOverride -ExpectedScope project_override
      $ModeRank = @{ auto_safe = 0; recommend = 1; ask = 2; disabled = 3 }
      if ($null -ne $ProjectOverride.PSObject.Properties['mode']) {
        if ($ModeRank[[string]$ProjectOverride.mode] -lt $ModeRank[[string]$GlobalPolicy.mode]) { throw 'Project mode loosens global mode.' }
        $Effective.mode = [string]$ProjectOverride.mode
      }
      if ($null -ne $ProjectOverride.PSObject.Properties['checks']) {
        foreach ($Check in @($GlobalPolicy.checks)) { if (@($ProjectOverride.checks) -cnotcontains [string]$Check) { throw 'Project checks remove a mandatory global evaluation point.' } }
        foreach ($Check in @($ProjectOverride.checks)) { if (@($GlobalPolicy.checks) -cnotcontains [string]$Check) { throw 'Project checks contain an undeclared evaluation point.' } }
        $Effective.checks = @($ProjectOverride.checks)
      }
      foreach ($Name in @('warn_ratio','critical_ratio')) {
        if ($null -ne $ProjectOverride.PSObject.Properties[$Name]) {
          if ([double]$ProjectOverride.$Name -gt [double]$GlobalPolicy.$Name) { throw "Project $Name loosens the global threshold." }
          $Effective[$Name] = [double]$ProjectOverride.$Name
        }
      }
      if ([double]$Effective.critical_ratio -le [double]$Effective.warn_ratio) { throw 'Effective critical_ratio must exceed warn_ratio.' }
      foreach ($Name in @('compact_warn_at_first_safe_boundary','block_long_stage_at_critical','compact_epic_participants_after_closeout','safe_boundary_required')) {
        if ($null -ne $ProjectOverride.PSObject.Properties[$Name]) {
          if ([bool]$GlobalPolicy.$Name -and -not [bool]$ProjectOverride.$Name) { throw "Project $Name disables a required global safety behavior." }
          $Effective[$Name] = [bool]$ProjectOverride.$Name
        }
      }
      if ($null -ne $ProjectOverride.PSObject.Properties['maximum_retry_count']) {
        if ([int]$ProjectOverride.maximum_retry_count -gt [int]$GlobalPolicy.maximum_retry_count) { throw 'Project retry count loosens global retry policy.' }
        $Effective.maximum_retry_count = [int]$ProjectOverride.maximum_retry_count
      }
      foreach ($Name in @('excluded_role_profiles','required_gates')) {
        if ($null -ne $ProjectOverride.PSObject.Properties[$Name]) {
          $List = New-Object System.Collections.Generic.List[string]
          foreach ($Item in @($Effective[$Name]) + @($ProjectOverride.$Name)) { if (-not $List.Contains([string]$Item)) { $List.Add([string]$Item) } }
          $List.Sort([StringComparer]::Ordinal); $Effective[$Name] = @($List.ToArray())
        }
      }
    } catch {
      $Diagnostics.Add('PROJECT_OVERRIDE_REJECTED: ' + $_.Exception.Message)
      $AutomaticActionAllowed = $false
    }
  }
  $EffectiveObject = [pscustomobject]$Effective
  return [pscustomobject][ordered]@{
    schema_version = 'compact-policy-resolution/v1'
    valid = $true
    automatic_action_allowed = $AutomaticActionAllowed
    global_sha256 = $(if ([string]::IsNullOrWhiteSpace($GlobalSha256)) { 'UNDECLARED' } else { $GlobalSha256 })
    override_sha256 = $(if ([string]::IsNullOrWhiteSpace($OverrideSha256)) { 'UNDECLARED' } else { $OverrideSha256 })
    effective_policy_sha256 = Get-CompactFlowObjectIdentity -Value $EffectiveObject
    effective_policy = $EffectiveObject
    diagnostics = @($Diagnostics.ToArray())
  }
}

function Assert-CompactFlowEvent {
  param($Event)
  $Allowed = @('schema_version','contract','event_id','event_type','boundary_id','project_id','wave_id','epic_id','workflow_phase','state_revision','candidate_identity','worktree_identity','configuration_identity','combined_row_identity','sender_logical_ref','recipient_logical_ref','safe_boundary','duplicate_send_disposition','satisfied_gates','stage_artifact','closeout','host_attestation','participants','manual_compact_participants','unresolved_blocker_codes','triggered_reference_ids','created_utc')
  $Required = @('schema_version','contract','event_id','event_type','boundary_id','project_id','wave_id','epic_id','workflow_phase','state_revision','candidate_identity','configuration_identity','combined_row_identity','safe_boundary','duplicate_send_disposition','satisfied_gates','participants','created_utc')
  Assert-CompactFlowExactProperties -Value $Event -Allowed $Allowed -Required $Required -Label 'compact event'
  if ([string]$Event.schema_version -cne '1' -or [string]$Event.contract -cne 'compact-flow-event/v1') { throw 'Compact event identity is invalid.' }
  if (-not (Test-CompactFlowStableId -Value $Event.event_id) -or -not (Test-CompactFlowStableId -Value $Event.boundary_id) -or -not (Test-CompactFlowStableId -Value $Event.project_id)) { throw 'Compact event stable identity is invalid.' }
  if ([string]$Event.event_type -cnotin @('before_dispatch','after_stage_output','epic_closeout')) { throw 'Compact event type is invalid.' }
  if ([string]$Event.duplicate_send_disposition -cnotin @('SETTLED','NO_SEND','MANUAL_COMPACT_RECORDED','UNRESOLVED')) { throw 'Compact event duplicate-send disposition is invalid.' }
  if (@($Event.satisfied_gates | Select-Object -Unique).Count -ne @($Event.satisfied_gates).Count -or @($Event.satisfied_gates | Where-Object { -not (Test-CompactFlowStableId -Value $_) }).Count -gt 0) { throw 'Compact event satisfied_gates is invalid.' }
  if ([string]$Event.event_type -ceq 'before_dispatch' -and (-not (Test-CompactFlowLogicalSessionRef -Value $Event.sender_logical_ref) -or -not (Test-CompactFlowLogicalSessionRef -Value $Event.recipient_logical_ref))) { throw 'before_dispatch requires safe sender and recipient logical references.' }
  if ([string]$Event.event_type -ceq 'after_stage_output' -and $null -eq $Event.PSObject.Properties['stage_artifact']) { throw 'after_stage_output requires a pinned stage artifact.' }
  if ([string]$Event.event_type -ceq 'epic_closeout') {
    if ($null -eq $Event.PSObject.Properties['closeout'] -or [string]::IsNullOrWhiteSpace([string]$Event.closeout.receipt_path) -or [string]$Event.closeout.routing_verdict -cne 'CLOSED' -or [string]$Event.closeout.receipt_identity -cnotmatch '^[a-f0-9]{64}$') { throw 'epic_closeout requires an exact CLOSED receipt path and identity.' }
  }
  $SafeFields = @('stage_output_complete','stage_output_classified','stage_artifact_pinned','stage_artifact_hash_verified','state_combined_agree','participant_idle','no_unresolved_question','route_exact','transport_settled','prior_compact_certain')
  Assert-CompactFlowExactProperties -Value $Event.safe_boundary -Allowed $SafeFields -Required $SafeFields -Label 'compact event safe_boundary'
  foreach ($Name in $SafeFields) { if ($Event.safe_boundary.$Name -isnot [bool]) { throw "safe_boundary.$Name must be boolean." } }
  if ($null -ne $Event.PSObject.Properties['stage_artifact']) {
    Assert-CompactFlowExactProperties -Value $Event.stage_artifact -Allowed @('path','sha256','logical_identity') -Required @('path','sha256','logical_identity') -Label 'compact event stage_artifact'
    if ([string]$Event.stage_artifact.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'stage_artifact sha256 is invalid.' }
  }
  if ($null -ne $Event.PSObject.Properties['closeout']) { Assert-CompactFlowExactProperties -Value $Event.closeout -Allowed @('receipt_path','receipt_identity','routing_verdict') -Required @('receipt_path','receipt_identity','routing_verdict') -Label 'compact event closeout' }
  if ($null -ne $Event.PSObject.Properties['host_attestation']) {
    Assert-CompactFlowExactProperties -Value $Event.host_attestation -Allowed @('opencode_version','opencode_launcher_identity','command_registry_identity') -Required @('opencode_version','opencode_launcher_identity','command_registry_identity') -Label 'compact event host_attestation'
    if ([string]$Event.host_attestation.opencode_version -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+$' -or [string]$Event.host_attestation.opencode_launcher_identity -cnotmatch '^[a-f0-9]{64}$' -or [string]$Event.host_attestation.command_registry_identity -cnotmatch '^[a-f0-9]{64}$') { throw 'host_attestation is invalid.' }
  }
  $Participants = @($Event.participants)
  if ($Participants.Count -eq 0) { throw 'Compact event requires at least one participant.' }
  $SeenRefs = @{}; $SeenOrders = @{}
  foreach ($Participant in $Participants) {
    $ParticipantAllowed = @('logical_session_ref','profile_id','role_hint','participation_class','compact_order','resume_mode','expected_next_actor','expected_next_command','selected_command_identity','route_input')
    $ParticipantRequired = @('logical_session_ref','profile_id','role_hint','participation_class','compact_order','resume_mode','expected_next_actor','expected_next_command','route_input')
    Assert-CompactFlowExactProperties -Value $Participant -Allowed $ParticipantAllowed -Required $ParticipantRequired -Label 'compact event participant'
    if (-not (Test-CompactFlowLogicalSessionRef -Value $Participant.logical_session_ref)) { throw 'Participant logical_session_ref is invalid.' }
    if (-not (Test-CompactFlowStableId -Value $Participant.profile_id)) { throw 'Participant profile_id is invalid.' }
    if ($SeenRefs.ContainsKey([string]$Participant.logical_session_ref)) { throw 'Participant logical_session_ref is duplicated.' }
    $SeenRefs[[string]$Participant.logical_session_ref] = $true
    if ([int]$Participant.compact_order -lt 1 -or $SeenOrders.ContainsKey([string]$Participant.compact_order)) { throw 'Participant compact_order is invalid or duplicated.' }
    $SeenOrders[[string]$Participant.compact_order] = $true
    if ([string]$Participant.participation_class -cnotin @('DELIVERY','REVIEW_SUPPORT','META_ORCHESTRATOR')) { throw 'Participant class is invalid.' }
    if ([string]$Participant.resume_mode -cnotin @('AUTO_RESUME','HYDRATE_ONLY')) { throw 'Participant resume mode is invalid.' }
    if ([string]$Participant.role_hint -cnotmatch '^[A-Za-z0-9][A-Za-z0-9 .-]{0,79}$' -or [string]$Participant.expected_next_actor -cnotmatch '^[A-Za-z0-9][A-Za-z0-9 .-]{0,79}$') { throw 'Participant role or next-actor label is invalid.' }
    if ($null -ne $Participant.PSObject.Properties['selected_command_identity'] -and [string]$Participant.selected_command_identity -cnotmatch '^[a-f0-9]{64}$') { throw 'Participant selected_command_identity is invalid.' }
    if ([string]$Participant.resume_mode -ceq 'AUTO_RESUME' -and ([string]$Participant.expected_next_command -cnotmatch '^/[a-z0-9][a-z0-9-]{0,126}$' -or [string]$Participant.selected_command_identity -cnotmatch '^[a-f0-9]{64}$' -or [string]$Participant.route_input.mode -cnotin @('PINNED_ARTIFACT','EXACT_EMPTY'))) { throw 'AUTO_RESUME participant lacks exact command or route evidence.' }
    if ([string]$Participant.resume_mode -ceq 'HYDRATE_ONLY' -and ([string]$Participant.expected_next_command -cne 'NONE' -or [string]$Participant.route_input.mode -cne 'NOT_APPLICABLE')) { throw 'HYDRATE_ONLY participant must use NONE and NOT_APPLICABLE.' }
    $RouteRequired = if ([string]$Participant.route_input.mode -ceq 'PINNED_ARTIFACT') { @('mode','path','sha256','logical_identity') } else { @('mode') }
    Assert-CompactFlowExactProperties -Value $Participant.route_input -Allowed $RouteRequired -Required $RouteRequired -Label 'compact event participant route_input'
    if ([string]$Participant.route_input.mode -ceq 'PINNED_ARTIFACT' -and ([string]$Participant.route_input.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [string]::IsNullOrWhiteSpace([string]$Participant.route_input.path) -or [string]::IsNullOrWhiteSpace([string]$Participant.route_input.logical_identity))) { throw 'PINNED_ARTIFACT route input is invalid.' }
  }
  if ($null -ne $Event.PSObject.Properties['manual_compact_participants']) {
    foreach ($Ref in @($Event.manual_compact_participants)) { if (-not (Test-CompactFlowLogicalSessionRef -Value $Ref) -or -not $SeenRefs.ContainsKey([string]$Ref)) { throw 'manual_compact_participants contains an unknown or unsafe reference.' } }
  }
  Assert-CompactFlowPrivacySafeValue -Value $Event
  $Created = [datetime]::MinValue
  if (-not [datetime]::TryParse([string]$Event.created_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$Created)) { throw 'Compact event created_utc is invalid.' }
  return $true
}

function Test-CompactFlowSafeBoundary {
  param($SafeBoundary, [string]$DuplicateSendDisposition, [string[]]$BlockerCodes = @())
  $Required = @('stage_output_complete','stage_output_classified','stage_artifact_pinned','stage_artifact_hash_verified','state_combined_agree','participant_idle','no_unresolved_question','route_exact','transport_settled','prior_compact_certain')
  $Failed = New-Object System.Collections.Generic.List[string]
  foreach ($Name in $Required) { if ($null -eq $SafeBoundary.PSObject.Properties[$Name] -or -not [bool]$SafeBoundary.$Name) { $Failed.Add($Name) } }
  if ($DuplicateSendDisposition -cnotin @('SETTLED','NO_SEND','MANUAL_COMPACT_RECORDED')) { $Failed.Add('duplicate_send_unresolved') }
  if (@($BlockerCodes).Count -gt 0) { $Failed.Add('unresolved_blockers') }
  return [pscustomobject][ordered]@{ safe = ($Failed.Count -eq 0); failed_fields = @($Failed.ToArray()) }
}

function Get-CompactFlowPressureDecision {
  param($Event, $PolicyResolution, $Telemetry, [string]$ProfileId)
  $Policy = $PolicyResolution.effective_policy
  if (-not [bool]$PolicyResolution.automatic_action_allowed) { return [pscustomobject]@{ disposition='BLOCKED'; reason='PROJECT_POLICY_REJECTED' } }
  if (@($Policy.checks) -cnotcontains [string]$Event.event_type) { return [pscustomobject]@{ disposition='CONTINUE'; reason='EVENT_NOT_SELECTED' } }
  if (@($Policy.excluded_role_profiles) -ccontains $ProfileId) { return [pscustomobject]@{ disposition='CONTINUE'; reason='PROFILE_EXCLUDED' } }
  $MissingGates=@($Policy.required_gates | Where-Object { @($Event.satisfied_gates) -cnotcontains [string]$_ })
  if ($MissingGates.Count -gt 0) { return [pscustomobject]@{ disposition='PROOF_REQUIRED'; reason=('REQUIRED_GATES_MISSING:' + ($MissingGates -join ',')) } }
  if ([string]$Policy.mode -ceq 'disabled') { return [pscustomobject]@{ disposition='CONTINUE'; reason='POLICY_DISABLED' } }
  $Boundary = Test-CompactFlowSafeBoundary -SafeBoundary $Event.safe_boundary -DuplicateSendDisposition ([string]$Event.duplicate_send_disposition) -BlockerCodes @($Event.unresolved_blocker_codes)
  $Pressure = [string](Get-CompactFlowProperty -Value (Get-CompactFlowProperty -Value $Telemetry -Name 'pressure') -Name 'state' -DefaultValue 'unknown')
  $SessionState = [string](Get-CompactFlowProperty -Value (Get-CompactFlowProperty -Value $Telemetry -Name 'session') -Name 'state' -DefaultValue 'unknown')
  $Provider = [string](Get-CompactFlowProperty -Value (Get-CompactFlowProperty -Value $Telemetry -Name 'model') -Name 'provider_id' -DefaultValue '')
  $Model = [string](Get-CompactFlowProperty -Value (Get-CompactFlowProperty -Value $Telemetry -Name 'model') -Name 'model_id' -DefaultValue '')
  $CloseoutRequired = [string]$Event.event_type -ceq 'epic_closeout' -and [bool]$Policy.compact_epic_participants_after_closeout
  $CompactUseful = $CloseoutRequired -or $Pressure -in @('warn','critical')
  if ($Pressure -ceq 'over_limit') { return [pscustomobject]@{ disposition='PROOF_REQUIRED'; reason='OVER_LIMIT_BOUNDED_RECOVERY_ONLY' } }
  if (-not $CompactUseful) { return [pscustomobject]@{ disposition='CONTINUE'; reason=$(if ($Pressure -ceq 'unknown') { 'UNKNOWN_NONBLOCKING' } else { 'PRESSURE_NORMAL' }) } }
  if (-not $Boundary.safe) { return [pscustomobject]@{ disposition='PROOF_REQUIRED'; reason=('SAFE_BOUNDARY_MISSING:' + ($Boundary.failed_fields -join ',')) } }
  if ($SessionState -cne 'idle') { return [pscustomobject]@{ disposition='PROOF_REQUIRED'; reason='SESSION_NOT_IDLE' } }
  if ([string]::IsNullOrWhiteSpace($Provider) -or [string]::IsNullOrWhiteSpace($Model)) { return [pscustomobject]@{ disposition='PROOF_REQUIRED'; reason='PROVIDER_MODEL_UNAVAILABLE' } }
  switch ([string]$Policy.mode) {
    'recommend' { return [pscustomobject]@{ disposition='RECOMMEND'; reason='SAFE_COMPACT_RECOMMENDED' } }
    'ask' { return [pscustomobject]@{ disposition='CONFIRM'; reason='SAFE_COMPACT_REQUIRES_CONFIRMATION' } }
    default { return [pscustomobject]@{ disposition='AUTO_COMPACT'; reason=$(if ($CloseoutRequired) { 'ACCEPTED_CLOSEOUT' } else { "PRESSURE_$($Pressure.ToUpperInvariant())" }) } }
  }
}

function Merge-CompactFlowParticipants {
  param([object[]]$Existing = @(), [object[]]$Incoming = @())
  $ByRef = @{}
  foreach ($Participant in @($Existing) + @($Incoming)) {
    $Ref = [string]$Participant.logical_session_ref
    if (-not (Test-CompactFlowLogicalSessionRef -Value $Ref)) { throw 'Participant ledger contains an unsafe logical reference.' }
    $Identity = Get-CompactFlowObjectIdentity -Value $Participant
    if ($ByRef.ContainsKey($Ref) -and [string]$ByRef[$Ref].identity -cne $Identity) { throw "Participant '$Ref' has conflicting ledger definitions." }
    $ByRef[$Ref] = [pscustomobject]@{ participant=$Participant; identity=$Identity }
  }
  $ClassRank = @{ DELIVERY=0; REVIEW_SUPPORT=1; META_ORCHESTRATOR=2 }
  $Rows = @($ByRef.Values | ForEach-Object { $_.participant } | Sort-Object @{Expression={ $ClassRank[[string]$_.participation_class] }}, @{Expression={ [string]$_.logical_session_ref }})
  $Order = 1
  foreach ($Participant in $Rows) { $Participant.compact_order = $Order; $Order++ }
  return @($Rows)
}

function New-CompactFlowBoundary {
  param($Event, [object[]]$Participants, [datetime]$NowUtc = [datetime]::UtcNow)
  $Boundary = [ordered]@{
    schema_version = '2'; contract = 'opencode-seamless-compact-boundary/v2'; boundary_id = [string]$Event.boundary_id
    project_id = [string]$Event.project_id; workflow_phase = [string]$Event.workflow_phase
    expected_state_revision = [string]$Event.state_revision; expected_wave_id = [string]$Event.wave_id; expected_epic_id = [string]$Event.epic_id
    expected_candidate_identity = [string]$Event.candidate_identity; expected_compact_boundary = [string]$Event.boundary_id
    expected_configuration_identity = [string]$Event.configuration_identity; expected_combined_row_identity = [string]$Event.combined_row_identity
    participants = @($Participants); created_utc = $NowUtc.ToString('yyyy-MM-ddTHH:mm:ssZ'); expires_utc = $NowUtc.AddHours(1).ToString('yyyy-MM-ddTHH:mm:ssZ')
  }
  foreach ($Pair in @(@('worktree_identity','expected_worktree_identity'), @('host_attestation','host_attestation'), @('triggered_reference_ids','triggered_reference_ids'))) {
    if ($null -ne $Event.PSObject.Properties[$Pair[0]]) { $Boundary[$Pair[1]] = $Event.($Pair[0]) }
  }
  if (@($Event.unresolved_blocker_codes).Count -gt 0) { $Boundary.blocker_codes = @($Event.unresolved_blocker_codes) }
  return [pscustomobject]$Boundary
}

function Get-CompactFlowMarkerSet {
  param([object[]]$ActiveContext)
  $Rows = New-Object System.Collections.Generic.List[object]
  $Ordinal = 0
  foreach ($Item in @($ActiveContext)) {
    if ([string](Get-CompactFlowProperty -Value $Item -Name 'type' -DefaultValue '') -cne 'compaction') { continue }
    $Identity = ''
    foreach ($Name in @('id','messageID','messageId','markerID','markerId','requestID','requestId')) {
      $Value = [string](Get-CompactFlowProperty -Value $Item -Name $Name -DefaultValue '')
      if (-not [string]::IsNullOrWhiteSpace($Value)) { $Identity = $Value; break }
    }
    $Time = Get-CompactFlowProperty -Value (Get-CompactFlowProperty -Value $Item -Name 'time') -Name 'created'
    $Timestamp = if ($null -eq $Time) { 0 } else { [int64]$Time }
    if ([string]::IsNullOrWhiteSpace($Identity)) { $Identity = 'derived:' + (Get-CompactFlowSha256Text -Text "$Timestamp|$Ordinal") }
    $Rows.Add([pscustomobject][ordered]@{ identity=$Identity; created_epoch_ms=$Timestamp })
    $Ordinal++
  }
  $Sorted = @($Rows.ToArray() | Sort-Object identity, created_epoch_ms)
  $DigestRows = @($Sorted | ForEach-Object { "$($_.identity)|$($_.created_epoch_ms)" })
  return [pscustomobject][ordered]@{ count=$Sorted.Count; digest=(Get-CompactFlowSha256Text -Text ($DigestRows -join "`n")); markers=$Sorted }
}

function Get-CompactFlowMarkerAttribution {
  param($Before, $After, [int64]$IntentEpochMs, [string]$TransportStatus, [string]$ResponseMarkerIdentity = '', [int]$OutstandingIntentCount = 1, [bool]$CompetingManualSignal = $false)
  if ($TransportStatus -in @('timeout','exception','interrupted')) { return [pscustomobject]@{ disposition='UNCERTAIN'; reason='TRANSPORT_COMPLETION_UNCERTAIN'; marker_identity='UNDECLARED' } }
  if ($OutstandingIntentCount -ne 1 -or $CompetingManualSignal) { return [pscustomobject]@{ disposition='UNCERTAIN'; reason='COMPETING_INTENT_OR_MANUAL_SIGNAL'; marker_identity='UNDECLARED' } }
  $BeforeIds = @{}; foreach ($Marker in @($Before.markers)) { $BeforeIds[[string]$Marker.identity] = $true }
  $NewMarkers = @($After.markers | Where-Object { -not $BeforeIds.ContainsKey([string]$_.identity) -and [int64]$_.created_epoch_ms -ge $IntentEpochMs })
  if ($NewMarkers.Count -ne 1) { return [pscustomobject]@{ disposition='UNCERTAIN'; reason=$(if ($NewMarkers.Count -eq 0) { 'NO_UNIQUE_NEW_MARKER' } else { 'MULTIPLE_NEW_MARKERS' }); marker_identity='UNDECLARED' } }
  $MarkerIdentity = [string]$NewMarkers[0].identity
  if (-not [string]::IsNullOrWhiteSpace($ResponseMarkerIdentity) -and $ResponseMarkerIdentity -cne $MarkerIdentity) { return [pscustomobject]@{ disposition='BLOCKED'; reason='RESPONSE_MARKER_CONTRADICTION'; marker_identity=$MarkerIdentity } }
  return [pscustomobject]@{ disposition='MARKER_VERIFIED'; reason='UNIQUE_ATTRIBUTABLE_MARKER'; marker_identity=$MarkerIdentity }
}

function Get-CompactFlowRetryDecision {
  param([string]$TransportStatus, $Before, $After, [int]$OutstandingIntentCount, [int]$RetryCount, [int]$MaximumRetryCount)
  $Unchanged = [string]$Before.digest -ceq [string]$After.digest
  $Allowed = $TransportStatus -ceq 'rejected_before_acceptance' -and $Unchanged -and $OutstandingIntentCount -eq 1 -and $RetryCount -lt $MaximumRetryCount
  return [pscustomobject]@{ retry_allowed=$Allowed; reason=$(if ($Allowed) { 'EXPLICIT_REJECTION_UNCHANGED_MARKERS' } else { 'RETRY_NOT_PROVEN_SAFE' }) }
}

function Get-CompactFlowPriorRunDisposition {
  param($RunDocument, [string]$EventId, [string]$LogicalSessionRef)
  $Runs = @($RunDocument.runs | Where-Object { [string]$_.logical_session_ref -ceq $LogicalSessionRef })
  $SameEvent = @($Runs | Where-Object { [string]$_.event_id -ceq $EventId })
  if ($SameEvent.Count -gt 1) { throw "Compact run ledger has duplicate event state for '$LogicalSessionRef'." }
  $Uncertain = @($Runs | Where-Object { [string]$_.state -ceq 'UNCERTAIN' })
  if ($Uncertain.Count -gt 0) { return [pscustomobject]@{ disposition='BLOCKED'; reason='BOUNDARY_PARTICIPANT_UNCERTAIN_RECONCILIATION_REQUIRED' } }
  $OutstandingStates = @('INTENT_PERSISTED','SUMMARIZE_SENT','MARKER_VERIFIED','HYDRATE_SENT','HYDRATION_VERIFIED','RESUME_SENT')
  $Outstanding = @($Runs | Where-Object { -not [bool]$_.terminal -or [string]$_.state -in $OutstandingStates })
  if ($Outstanding.Count -gt 0) { return [pscustomobject]@{ disposition='BLOCKED'; reason='BOUNDARY_PARTICIPANT_OUTSTANDING_INTENT' } }
  if (@($Runs | Where-Object { [bool]$_.compact_performed }).Count -gt 0) { return [pscustomobject]@{ disposition='ALREADY_COMPACTED'; reason='BOUNDARY_PARTICIPANT_COMPACTED_ONCE' } }
  if ($SameEvent.Count -eq 1) { return [pscustomobject]@{ disposition='ALREADY_EVALUATED'; reason='EVENT_PARTICIPANT_ALREADY_SETTLED' } }
  return [pscustomobject]@{ disposition='READY'; reason='NO_PRIOR_BOUNDARY_PARTICIPANT_RUN' }
}

function New-CompactFlowRunState {
  param($Event, $PolicyResolution, $Participant, $MarkerBaseline)
  $State = [ordered]@{
    schema_version='compact-run/v1'; boundary_id=[string]$Event.boundary_id; event_id=[string]$Event.event_id
    event_sha256=(Get-CompactFlowObjectIdentity -Value $Event); policy_sha256=[string]$PolicyResolution.effective_policy_sha256
    logical_session_ref=[string]$Participant.logical_session_ref; state='PLANNED'; terminal=$false; generation=0
    participant_sha256=(Get-CompactFlowObjectIdentity -Value $Participant)
    compact_performed=$false
    marker_baseline=$MarkerBaseline; previous_generation_sha256='GENESIS'; updated_utc=[datetime]::UtcNow.ToString('o')
  }
  $State.generation_sha256 = Get-CompactFlowObjectIdentity -Value ([pscustomobject]$State)
  return [pscustomobject]$State
}

function Move-CompactFlowRunState {
  param($RunState, [string]$NextState, [scriptblock]$Persist = $null)
  $Transitions = @{
    PLANNED=@('INTENT_PERSISTED','MANUAL_COMPACT','PROOF_REQUIRED','CONFIRM','BLOCKED','COMPLETE')
    INTENT_PERSISTED=@('SUMMARIZE_SENT','UNCERTAIN','BLOCKED')
    SUMMARIZE_SENT=@('MARKER_VERIFIED','UNCERTAIN','BLOCKED')
    MARKER_VERIFIED=@('HYDRATE_SENT','BLOCKED')
    HYDRATE_SENT=@('HYDRATION_VERIFIED','PROOF_REQUIRED','CONFIRM','UNCERTAIN','BLOCKED')
    HYDRATION_VERIFIED=@('RESUME_SENT','COMPLETE','PROOF_REQUIRED','CONFIRM','UNCERTAIN','BLOCKED')
    RESUME_SENT=@('COMPLETE','UNCERTAIN','BLOCKED')
  }
  $Current = [string]$RunState.state
  if (-not $Transitions.ContainsKey($Current) -or @($Transitions[$Current]) -cnotcontains $NextState) { throw "Illegal compact run transition $Current -> $NextState." }
  $RunState.previous_generation_sha256 = [string]$RunState.generation_sha256
  $RunState.state = $NextState; $RunState.generation = [int]$RunState.generation + 1; $RunState.updated_utc = [datetime]::UtcNow.ToString('o')
  if ($NextState -in @('MARKER_VERIFIED','MANUAL_COMPACT')) { $RunState.compact_performed = $true }
  $RunState.terminal = $NextState -in @('COMPLETE','MANUAL_COMPACT','PROOF_REQUIRED','CONFIRM','UNCERTAIN','BLOCKED')
  $Projection = [ordered]@{}
  foreach ($Name in @(Get-CompactFlowPropertyNames -Value $RunState | Where-Object { $_ -cne 'generation_sha256' })) { $Projection[$Name] = $RunState.$Name }
  $RunState.generation_sha256 = Get-CompactFlowObjectIdentity -Value ([pscustomobject]$Projection)
  if ($null -ne $Persist) { & $Persist $RunState }
  return $RunState
}

function Invoke-CompactFlowParticipantMachine {
  param(
    $Event, $PolicyResolution, $Participant, $Telemetry,
    [scriptblock]$GetMarkers, [scriptblock]$SendSummarize, [scriptblock]$Hydrate, [scriptblock]$Resume,
    [scriptblock]$Persist = $null, [bool]$ManualCompact = $false,
    [ValidateSet('PASS','PROOF_REQUIRED','BLOCKED')][string]$PreflightDisposition = 'PASS'
  )
  $Decision = Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $PolicyResolution -Telemetry $Telemetry -ProfileId ([string]$Participant.profile_id)
  $EmptyMarkers = [pscustomobject]@{ count=0; digest=(Get-CompactFlowSha256Text -Text ''); markers=@() }
  $RunState = New-CompactFlowRunState -Event $Event -PolicyResolution $PolicyResolution -Participant $Participant -MarkerBaseline $EmptyMarkers
  if ($ManualCompact) {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState MANUAL_COMPACT -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='MANUAL_COMPACT'; reason='EXPLICIT_MANUAL_BOUNDARY'; run_state=$RunState }
  }
  if ([string]$Decision.disposition -cne 'AUTO_COMPACT') {
    $Terminal = switch ([string]$Decision.disposition) { 'CONFIRM' {'CONFIRM'} 'BLOCKED' {'BLOCKED'} 'PROOF_REQUIRED' {'PROOF_REQUIRED'} default {'COMPLETE'} }
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState $Terminal -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition=[string]$Decision.disposition; reason=[string]$Decision.reason; run_state=$RunState }
  }
  if ($PreflightDisposition -cne 'PASS') {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState $PreflightDisposition -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition=$PreflightDisposition; reason='CANON_PREFLIGHT_NOT_READY'; run_state=$RunState }
  }
  try { $Before = & $GetMarkers }
  catch {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState PROOF_REQUIRED -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='PROOF_REQUIRED'; reason='MARKER_BASELINE_UNAVAILABLE'; run_state=$RunState }
  }
  $RunState.marker_baseline = $Before
  $RunState | Add-Member -NotePropertyName summarize_intent_sha256 -NotePropertyValue (Get-CompactFlowObjectIdentity -Value ([pscustomobject][ordered]@{event_id=[string]$Event.event_id;boundary_id=[string]$Event.boundary_id;logical_session_ref=[string]$Participant.logical_session_ref;provider_id=[string]$Telemetry.model.provider_id;model_id=[string]$Telemetry.model.model_id;marker_baseline=[string]$Before.digest})) -Force
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState INTENT_PERSISTED -Persist $Persist
  $IntentMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $Transport = & $SendSummarize
  if ([string]$Transport.status -in @('timeout','exception','interrupted')) {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState UNCERTAIN -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='UNCERTAIN'; reason='TRANSPORT_COMPLETION_UNCERTAIN'; run_state=$RunState }
  }
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState SUMMARIZE_SENT -Persist $Persist
  $After = & $GetMarkers
  if ([string]$Transport.status -ceq 'rejected_before_acceptance') {
    $Retry = Get-CompactFlowRetryDecision -TransportStatus ([string]$Transport.status) -Before $Before -After $After -OutstandingIntentCount ([int]$Transport.outstanding_intent_count) -RetryCount 0 -MaximumRetryCount ([int]$PolicyResolution.effective_policy.maximum_retry_count)
    if (-not $Retry.retry_allowed) {
      $RunState = Move-CompactFlowRunState -RunState $RunState -NextState BLOCKED -Persist $Persist
      return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='BLOCKED'; reason=[string]$Retry.reason; run_state=$RunState }
    }
    $Transport = & $SendSummarize
    if ([string]$Transport.status -cne 'success') {
      $RunState = Move-CompactFlowRunState -RunState $RunState -NextState UNCERTAIN -Persist $Persist
      return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='UNCERTAIN'; reason='RETRY_NOT_CONFIRMED'; run_state=$RunState }
    }
    $After = & $GetMarkers
  }
  $Attribution = Get-CompactFlowMarkerAttribution -Before $Before -After $After -IntentEpochMs $IntentMs -TransportStatus ([string]$Transport.status) -ResponseMarkerIdentity ([string]$Transport.marker_identity) -OutstandingIntentCount ([int]$Transport.outstanding_intent_count) -CompetingManualSignal ([bool]$Transport.competing_manual_signal)
  if ([string]$Attribution.disposition -cne 'MARKER_VERIFIED') {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState ([string]$Attribution.disposition) -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition=[string]$Attribution.disposition; reason=[string]$Attribution.reason; run_state=$RunState }
  }
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState MARKER_VERIFIED -Persist $Persist
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState HYDRATE_SENT -Persist $Persist
  try { $Hydration = & $Hydrate }
  catch {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState UNCERTAIN -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='UNCERTAIN'; reason='HYDRATION_COMPLETION_UNCERTAIN'; run_state=$RunState }
  }
  $HydrationAction = [string]$Hydration.action
  if ([string]$Hydration.verification -cne 'PASS' -or $HydrationAction -in @('PROOF_REQUIRED','CONFIRM','BLOCKED')) {
    $Terminal = if ($HydrationAction -in @('PROOF_REQUIRED','CONFIRM','BLOCKED')) { $HydrationAction } else { 'BLOCKED' }
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState $Terminal -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition=$Terminal; reason='HYDRATION_NOT_RESUMABLE'; run_state=$RunState }
  }
  if ([string]$Participant.resume_mode -ceq 'HYDRATE_ONLY' -or $HydrationAction -cne 'AUTO_RESUME') {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState HYDRATION_VERIFIED -Persist $Persist
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState COMPLETE -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='COMPLETE'; reason='HYDRATION_COMPLETE_NO_RESUME'; run_state=$RunState }
  }
  $ResumeContext = [pscustomobject]@{ intent_persisted=$false; run_state=$RunState }
  $PersistResumeIntent = {
    param($HeldRouteProof)
    if ([bool]$ResumeContext.intent_persisted) { throw 'Resume intent was already persisted.' }
    $ResumeContext.run_state | Add-Member -NotePropertyName resume_intent_sha256 -NotePropertyValue (Get-CompactFlowObjectIdentity -Value ([pscustomobject][ordered]@{logical_session_ref=[string]$Participant.logical_session_ref;command=[string]$Participant.expected_next_command;route_input=$Hydration.route_input;held_route_proof=$HeldRouteProof})) -Force
    $ResumeContext.run_state = Move-CompactFlowRunState -RunState $ResumeContext.run_state -NextState HYDRATION_VERIFIED -Persist $Persist
    $ResumeContext.intent_persisted = $true
  }.GetNewClosure()
  try { $ResumeResult = & $Resume $Hydration $PersistResumeIntent }
  catch { $ResumeResult = [pscustomobject]@{ sent=$false; disposition='UNCERTAIN' } }
  $RunState = $ResumeContext.run_state
  if (-not [bool]$ResumeContext.intent_persisted) {
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState BLOCKED -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='BLOCKED'; reason='RESUME_INTENT_NOT_PERSISTED_UNDER_HELD_ROUTE'; run_state=$RunState }
  }
  if (-not [bool]$ResumeResult.sent) {
    $ResumeDisposition = if ([string]$ResumeResult.disposition -ceq 'UNCERTAIN') { 'UNCERTAIN' } else { 'BLOCKED' }
    $RunState = Move-CompactFlowRunState -RunState $RunState -NextState $ResumeDisposition -Persist $Persist
    return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition=$ResumeDisposition; reason='RESUME_NOT_PROVEN'; run_state=$RunState }
  }
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState RESUME_SENT -Persist $Persist
  $RunState = Move-CompactFlowRunState -RunState $RunState -NextState COMPLETE -Persist $Persist
  return [pscustomobject]@{ logical_session_ref=[string]$Participant.logical_session_ref; disposition='COMPLETE'; reason='COMPACT_HYDRATE_RESUME_COMPLETE'; run_state=$RunState }
}

function Resolve-CompactFlowContainedFile {
  param([string]$Root, [string]$RelativePath)
  if ([string]::IsNullOrWhiteSpace($Root) -or -not [IO.Path]::IsPathRooted($Root)) { throw 'Target root must be absolute.' }
  if ([string]::IsNullOrWhiteSpace($RelativePath) -or [IO.Path]::IsPathRooted($RelativePath) -or $RelativePath.Contains(':') -or $RelativePath -match '(^|[\\/])\.\.([\\/]|$)' -or $RelativePath -match '^[A-Za-z]:') { throw 'Route input path is not a safe relative path.' }
  $RootFull = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/'))
  $Candidate = [IO.Path]::GetFullPath((Join-Path $RootFull $RelativePath))
  $Prefix = $RootFull + [IO.Path]::DirectorySeparatorChar
  if (-not $Candidate.StartsWith($Prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Route input escapes the target root.' }
  $RelativeNative = $Candidate.Substring($Prefix.Length)
  $Current = $RootFull
  foreach ($Component in $RelativeNative.Split([char[]]@('\','/'), [StringSplitOptions]::RemoveEmptyEntries)) {
    $Current = Join-Path $Current $Component
    if (-not (Test-Path -LiteralPath $Current)) { throw 'Route input path is missing.' }
    $Item = Get-Item -LiteralPath $Current -Force
    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Route input path contains a reparse point.' }
  }
  if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { throw 'Route input is not an ordinary file.' }
  return $Candidate
}

function Open-CompactFlowRouteSnapshot {
  param([string]$Root, [string]$RelativePath, [string]$ExpectedSha256)
  $Path = Resolve-CompactFlowContainedFile -Root $Root -RelativePath $RelativePath
  $Stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    Initialize-CompactFlowFileHandleGuard
    $FinalPath = [CompactFlow.FileHandleGuard]::GetFinalPath($Stream.SafeFileHandle)
    if ($FinalPath.StartsWith('\\?\UNC\', [StringComparison]::OrdinalIgnoreCase)) { $FinalPath = '\\' + $FinalPath.Substring(8) }
    elseif ($FinalPath.StartsWith('\\?\', [StringComparison]::OrdinalIgnoreCase)) { $FinalPath = $FinalPath.Substring(4) }
    $FinalPath = [IO.Path]::GetFullPath($FinalPath)
    if (-not $FinalPath.Equals([IO.Path]::GetFullPath($Path), [StringComparison]::OrdinalIgnoreCase)) { throw 'Opened route handle resolves to a different final path.' }
    if ([CompactFlow.FileHandleGuard]::GetLinkCount($Stream.SafeFileHandle) -ne 1) { throw 'Opened route handle must have exactly one hard link.' }
    $Bytes = New-Object byte[] $Stream.Length
    $Offset = 0
    while ($Offset -lt $Bytes.Length) {
      $Read = $Stream.Read($Bytes, $Offset, $Bytes.Length - $Offset)
      if ($Read -le 0) { throw 'Route input ended before its declared length.' }
      $Offset += $Read
    }
    $Hash = Get-CompactFlowSha256Bytes -Bytes $Bytes
    if ($Hash -cne $ExpectedSha256) { throw 'Route input hash changed before resume.' }
    $Stream.Position = 0
    return [pscustomobject]@{ path=$Path; final_path=$FinalPath; stream=$Stream; bytes=$Bytes; sha256=$Hash; link_count=1 }
  } catch { $Stream.Dispose(); throw }
}

function Write-CompactFlowAtomicJson {
  param([string]$Path, $Value)
  $Parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $Parent -PathType Container)) { [void](New-Item -ItemType Directory -Path $Parent -Force) }
  $Temp = Join-Path $Parent ('.' + [IO.Path]::GetFileName($Path) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
  $Backup = Join-Path $Parent ('.' + [IO.Path]::GetFileName($Path) + '.' + [guid]::NewGuid().ToString('N') + '.bak')
  try {
    [IO.File]::WriteAllText($Temp, ($Value | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($Temp, $Path, $Backup, $true) } else { [IO.File]::Move($Temp, $Path) }
  } finally {
    if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Force }
    if (Test-Path -LiteralPath $Backup) { Remove-Item -LiteralPath $Backup -Force }
  }
}
