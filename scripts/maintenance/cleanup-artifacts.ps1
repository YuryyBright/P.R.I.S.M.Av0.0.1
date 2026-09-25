#!/usr/bin/env pwsh
# Maintenance and Cleanup Script
# This script provides various maintenance operations for the FastAPI PRISMA project

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("clean-all", "clean-docker", "clean-cache", "clean-logs", "clean-build", "security-scan", "update-deps", "help")]
    [string]$Action = "clean-all",

    [switch]$Force,
    [switch]$ShowDetails,
    [switch]$DryRun,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    switch ($Color) {
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

function Remove-ItemSafely {
    param([string]$Path, [string]$Description)

    if (Test-Path $Path) {
        if ($DryRun) {
            Write-ColorOutput "Would remove: $Path ($Description)" "Yellow"
        } else {
            try {
                Remove-Item $Path -Recurse -Force
                Write-ColorOutput "✅ Removed: $Description" "Green"            } catch {
                Write-ColorOutput "❌ Failed to remove ${Description}: $($_.Exception.Message)" "Red"
            }
        }
    } else {
        if ($ShowDetails) {
            Write-ColorOutput "ℹ️  Not found: $Description" "Gray"
        }
    }
}

function Clean-DockerArtifacts {
    Write-ColorOutput "🐳 Cleaning Docker Artifacts..." "Cyan"

    if ($DryRun) {
        Write-ColorOutput "Would clean Docker artifacts (containers, images, volumes)" "Yellow"
        return
    }

    try {
        # Stop and remove FastAPI PRISMA containers
        $containers = docker ps -a --filter "name=prisma" --format "{{.Names}}"
        if ($containers) {
            Write-ColorOutput "Stopping FastAPI PRISMA containers..." "Blue"
            docker stop $containers 2>$null
            docker rm $containers 2>$null
        }

        # Remove FastAPI PRISMA images if Force is specified
        if ($Force) {
            $images = docker images --filter "reference=prisma*" --filter "reference=react_frontend*" --format "{{.Repository}}:{{.Tag}}"
            if ($images) {
                Write-ColorOutput "Removing FastAPI PRISMA images..." "Blue"
                docker rmi $images 2>$null
            }
        }

        # Clean up unused Docker resources
        Write-ColorOutput "Cleaning unused Docker resources..." "Blue"
        docker system prune -f

        # Remove volumes if Force is specified
        if ($Force) {
            $volumes = docker volume ls --filter "name=prisma" --format "{{.Name}}"
            if ($volumes) {
                Write-ColorOutput "Removing FastAPI PRISMA volumes..." "Blue"
                docker volume rm $volumes 2>$null
            }
        }

        Write-ColorOutput "✅ Docker cleanup completed" "Green"
    } catch {
        Write-ColorOutput "❌ Docker cleanup failed: $($_.Exception.Message)" "Red"
    }
}

function Clean-CacheFiles {
    Write-ColorOutput "🗂️  Cleaning Cache Files..." "Cyan"

    $projectRoot = "$PSScriptRoot\..\.."

    # Python cache
    Write-ColorOutput "Cleaning Python cache..." "Blue"
    Get-ChildItem -Path "$projectRoot\backend" -Recurse -Name "__pycache__" | ForEach-Object {
        Remove-ItemSafely "$projectRoot\backend\$_" "Python cache directory"
    }

    Get-ChildItem -Path "$projectRoot\backend" -Recurse -Name "*.pyc" | ForEach-Object {
        Remove-ItemSafely "$projectRoot\backend\$_" "Python compiled file"
    }

    # Node.js cache
    Write-ColorOutput "Cleaning Node.js cache..." "Blue"
    Remove-ItemSafely "$projectRoot\admin_frontend\node_modules\.cache" "Node.js cache"
    Remove-ItemSafely "$projectRoot\admin_frontend\.vite" "Vite cache"

    # mypy cache
    Remove-ItemSafely "$projectRoot\backend\.mypy_cache" "MyPy cache"

    # pytest cache
    Remove-ItemSafely "$projectRoot\backend\.pytest_cache" "Pytest cache"

    # Coverage cache
    Remove-ItemSafely "$projectRoot\backend\.coverage" "Coverage cache"
    Remove-ItemSafely "$projectRoot\admin_frontend\coverage" "Frontend coverage"

    Write-ColorOutput "✅ Cache cleanup completed" "Green"
}

function Clean-LogFiles {
    Write-ColorOutput "📝 Cleaning Log Files..." "Cyan"

    $projectRoot = "$PSScriptRoot\..\.."

    # Backend logs
    Remove-ItemSafely "$projectRoot\backend\logs\*.log" "Backend log files"
    Remove-ItemSafely "$projectRoot\backend\celerybeat-schedule.db" "Celery beat schedule"
    Remove-ItemSafely "$projectRoot\backend\celerybeat-schedule" "Celery beat schedule directory"

    # Docker logs can be cleaned with docker system prune
    if (-not $DryRun) {
        try {
            Write-ColorOutput "Cleaning Docker logs..." "Blue"
            docker system prune --volumes -f 2>$null
        } catch {
            Write-ColorOutput "⚠️  Could not clean Docker logs" "Yellow"
        }
    }

    Write-ColorOutput "✅ Log cleanup completed" "Green"
}

function Clean-BuildArtifacts {
    Write-ColorOutput "🔨 Cleaning Build Artifacts..." "Cyan"

    $projectRoot = "$PSScriptRoot\..\.."

    # Frontend build artifacts
    Remove-ItemSafely "$projectRoot\admin_frontend\dist" "Frontend build directory"
    Remove-ItemSafely "$projectRoot\admin_frontend\build" "Frontend build directory"

    # Python build artifacts
    Remove-ItemSafely "$projectRoot\backend\build" "Python build directory"
    Remove-ItemSafely "$projectRoot\backend\dist" "Python distribution directory"
    Remove-ItemSafely "$projectRoot\backend\*.egg-info" "Python egg info"

    Write-ColorOutput "✅ Build artifacts cleanup completed" "Green"
}

function Invoke-SecurityScan {
    Write-ColorOutput "🔒 Running Security Scan..." "Cyan"

    if ($DryRun) {
        Write-ColorOutput "Would run security scans on dependencies" "Yellow"
        return
    }

    $projectRoot = "$PSScriptRoot\..\.."

    # Python security scan
    Write-ColorOutput "Scanning Python dependencies..." "Blue"
    Push-Location "$projectRoot\backend"
    try {
        & pip install safety 2>$null
        & safety check
        Write-ColorOutput "✅ Python security scan completed" "Green"
    } catch {
        Write-ColorOutput "❌ Python security scan failed: $($_.Exception.Message)" "Red"
    } finally {
        Pop-Location
    }

    # Node.js security scan
    Write-ColorOutput "Scanning Node.js dependencies..." "Blue"
    Push-Location "$projectRoot\admin_frontend"
    try {
        & npm audit
        Write-ColorOutput "✅ Node.js security scan completed" "Green"
    } catch {
        Write-ColorOutput "❌ Node.js security scan failed: $($_.Exception.Message)" "Red"
    } finally {
        Pop-Location
    }
}

function Update-Dependencies {
    Write-ColorOutput "📦 Updating Dependencies..." "Cyan"

    if ($DryRun) {
        Write-ColorOutput "Would update Python and Node.js dependencies" "Yellow"
        return
    }

    $projectRoot = "$PSScriptRoot\..\.."

    # Update Python dependencies
    Write-ColorOutput "Updating Python dependencies..." "Blue"
    Push-Location "$projectRoot\backend"
    try {
        & pip install --upgrade pip
        & pip install -r requirements.txt --upgrade
        Write-ColorOutput "✅ Python dependencies updated" "Green"
    } catch {
        Write-ColorOutput "❌ Python dependencies update failed: $($_.Exception.Message)" "Red"
    } finally {
        Pop-Location
    }

    # Update Node.js dependencies
    Write-ColorOutput "Updating Node.js dependencies..." "Blue"
    Push-Location "$projectRoot\admin_frontend"
    try {
        & npm update
        Write-ColorOutput "✅ Node.js dependencies updated" "Green"
    } catch {
        Write-ColorOutput "❌ Node.js dependencies update failed: $($_.Exception.Message)" "Red"
    } finally {
        Pop-Location
    }
}

function Show-Help {
    Write-ColorOutput "`n🧹 Maintenance and Cleanup Script" "Cyan"
    Write-ColorOutput "==================================" "Cyan"
    Write-ColorOutput "`nThis script provides comprehensive maintenance operations for the FastAPI PRISMA project.`n" "White"

    Write-ColorOutput "📋 Parameters:" "Yellow"
    Write-ColorOutput "  -Action      : Action to perform (clean-all, clean-docker, clean-cache, clean-logs, clean-build, security-scan, update-deps)" "White"
    Write-ColorOutput "  -Force       : Force cleanup without confirmation prompts" "White"
    Write-ColorOutput "  -ShowDetails : Show detailed output during operations" "White"
    Write-ColorOutput "  -DryRun      : Show what would be cleaned without making changes" "White"

    Write-ColorOutput "`n💡 Examples:" "Yellow"
    Write-ColorOutput "  .\cleanup-artifacts.ps1                           # Clean all artifacts" "White"
    Write-ColorOutput "  .\cleanup-artifacts.ps1 -Action clean-docker      # Clean only Docker artifacts" "White"
    Write-ColorOutput "  .\cleanup-artifacts.ps1 -Action clean-cache       # Clean only caches" "White"
    Write-ColorOutput "  .\cleanup-artifacts.ps1 -DryRun                   # Preview what would be cleaned" "White"
    Write-ColorOutput "  .\cleanup-artifacts.ps1 -Action security-scan     # Run security scan only" "White"

    Write-ColorOutput "`n🎯 Actions:" "Yellow"
    Write-ColorOutput "  clean-all     : Clean all artifacts (Docker, cache, logs, build)" "White"
    Write-ColorOutput "  clean-docker  : Clean Docker containers, images, volumes, networks" "White"
    Write-ColorOutput "  clean-cache   : Clean Node.js, Python, and build caches" "White"
    Write-ColorOutput "  clean-logs    : Clean log files and temporary logs" "White"
    Write-ColorOutput "  clean-build   : Clean build artifacts and distributions" "White"
    Write-ColorOutput "  security-scan : Run security scans for vulnerabilities" "White"
    Write-ColorOutput "  update-deps   : Check for dependency updates" "White"
    Write-ColorOutput "`n"
}

# Main execution
# Check for help request
if ($Help -or $Action -eq "help") {
    Show-Help
    exit 0
}

Write-ColorOutput "🧹 FastAPI PRISMA Maintenance Manager" "Blue"
Write-ColorOutput "===================================" "Blue"
Write-ColorOutput "Action: $Action" "White"
Write-ColorOutput "Dry Run: $DryRun" "White"
Write-ColorOutput "Force: $Force" "White"
Write-ColorOutput ""

if ($DryRun) {
    Write-ColorOutput "🔍 DRY RUN MODE - No changes will be made" "Yellow"
    Write-ColorOutput ""
}

switch ($Action) {
    "clean-all" {
        Clean-CacheFiles
        Clean-LogFiles
        Clean-BuildArtifacts
        if ($Force) {
            Clean-DockerArtifacts
        }
        Write-ColorOutput "`n🎉 Complete cleanup finished!" "Green"
    }
    "clean-docker" {
        Clean-DockerArtifacts
    }
    "clean-cache" {
        Clean-CacheFiles
    }
    "clean-logs" {
        Clean-LogFiles
    }
    "clean-build" {
        Clean-BuildArtifacts
    }
    "security-scan" {
        Invoke-SecurityScan
    }
    "update-deps" {
        Update-Dependencies
    }
}

Write-ColorOutput "`n💡 Use -Force to remove Docker images and volumes" "Yellow"
Write-ColorOutput "💡 Use -DryRun to see what would be cleaned without making changes" "Yellow"
