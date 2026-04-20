param(
    [string]$OutputZip = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputZip)) {
    $OutputZip = Join-Path $projectRoot "fleet-management-app-ubuntu-$timestamp.zip"
}

$stagingRoot = Join-Path $projectRoot ".transfer-package"
$stagingProject = Join-Path $stagingRoot "fleet-management-app"

$excludedDirs = @(
    ".git",
    ".next",
    ".transfer-package",
    "backups",
    "coverage",
    "dist",
    "node_modules"
)

$excludedFiles = @(
    "*.log",
    "*.tar",
    "*.tar.gz",
    "*.zip",
    "dev.db",
    "tsconfig.tsbuildinfo"
)

function Should-SkipFile {
    param([string]$Name)

    foreach ($pattern in $excludedFiles) {
        if ($Name -like $pattern) {
            return $true
        }
    }

    return $false
}

function Copy-FilteredTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null

    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        $targetPath = Join-Path $Destination $_.Name

        if ($_.PSIsContainer) {
            if ($excludedDirs -contains $_.Name) {
                return
            }

            Copy-FilteredTree -Source $_.FullName -Destination $targetPath
            return
        }

        if (Should-SkipFile -Name $_.Name) {
            return
        }

        Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
    }
}

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path -LiteralPath $OutputZip) {
    Remove-Item -LiteralPath $OutputZip -Force
}

Copy-FilteredTree -Source $projectRoot -Destination $stagingProject

$itemsToArchive = Get-ChildItem -LiteralPath $stagingRoot -Force
Compress-Archive -Path $itemsToArchive.FullName -DestinationPath $OutputZip -CompressionLevel Optimal

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host "Archive creee :" $OutputZip
