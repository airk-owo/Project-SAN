# Extracts the authoritative DOCX manual into project data without Word/OCR.
param([string]$InputPath = "", [string]$OutputPath = "data/generated/manual.json")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = $null
if (!$InputPath) { $InputPath = (Get-ChildItem -LiteralPath source -Filter *.docx | Select-Object -First 1 -ExpandProperty FullName) }
if (!$InputPath) { throw 'No DOCX manual was found in source/' }
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $InputPath))
try {
  $entry = $zip.GetEntry('word/document.xml'); if (!$entry) { throw 'word/document.xml is missing' }
  $reader = [System.IO.StreamReader]::new($entry.Open()); [xml]$xml = $reader.ReadToEnd(); $reader.Dispose()
  $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable); $ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $paragraphs = @($xml.SelectNodes('//w:p',$ns) | ForEach-Object { (($_.SelectNodes('.//w:t',$ns) | ForEach-Object { $_.'#text' }) -join '').Trim() } | Where-Object { $_ })
  $payload = @{ source=$InputPath; imported_at=(Get-Date).ToUniversalTime().ToString('o'); paragraphs=$paragraphs }
  [IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath)) | Out-Null
  [IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath), ($payload | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
  Write-Output "Imported $($paragraphs.Count) paragraphs from the authoritative manual."
} finally { if ($zip) { $zip.Dispose() } }
