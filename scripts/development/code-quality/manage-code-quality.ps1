#!/usr/bin/env pwsh
# Code Quality Management Script
# This script provides formatting, linting, and import fixing functionality

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("format", "lint", "fix-imports", "all", "help")]
    [string]$Action = "all",

    [Parameter(Mandatory=$false)]
    [ValidateSet("backend", "frontend", "all")]
    [string]$Target = "all",

    [switch]$Check,  # For format checking without modification
    [switch]$ShowDetails
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

function Show-Help {
    Write-ColorOutput "`n🛠️  Code Quality Management Script" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "`nThis script provides comprehensive code quality management for the FastAPI PRISMA project." "White"

    Write-ColorOutput "`n📋 Parameters:" "Yellow"
    Write-ColorOutput "  -Action        : Action to perform (format, lint, fix-imports, all)" "White"
    Write-ColorOutput "  -Target        : Target to process (backend, frontend, all)" "White"
    Write-ColorOutput "  -Check         : Check format without making changes" "White"
    Write-ColorOutput "  -ShowDetails   : Show detailed output" "White"

    Write-ColorOutput "`n💡 Examples:" "Yellow"
    Write-ColorOutput "  .\manage-code-quality.ps1                                    # Format, lint, and fix imports for all code" "White"
    Write-ColorOutput "  .\manage-code-quality.ps1 -Action format                     # Format all code" "White"
    Write-ColorOutput "  .\manage-code-quality.ps1 -Action lint -Target backend       # Lint only backend code" "White"
    Write-ColorOutput "  .\manage-code-quality.ps1 -Action format -Check              # Check formatting without changes" "White"
    Write-ColorOutput "  .\manage-code-quality.ps1 -Action fix-imports -Target frontend # Fix only frontend imports" "White"

    Write-ColorOutput "`n🎯 Actions:" "Yellow"
    Write-ColorOutput "  format      : Format code (Black for Python, Prettier for TypeScript)" "White"
    Write-ColorOutput "  lint        : Lint code (Flake8 for Python, ESLint for TypeScript)" "White"
    Write-ColorOutput "  fix-imports : Fix and sort imports (isort for Python, organize imports for TS)" "White"
    Write-ColorOutput "  all         : Run all actions (format, lint, fix-imports)" "White"

    Write-ColorOutput "`n🎯 Targets:" "Yellow"
    Write-ColorOutput "  backend     : Process only backend Python code" "White"
    Write-ColorOutput "  frontend    : Process only frontend TypeScript/React code" "White"
    Write-ColorOutput "  all         : Process both backend and frontend code" "White"

    Write-ColorOutput "`n🔧 Requirements:" "Yellow"
    Write-ColorOutput "  Backend: Python, black, isort, flake8" "White"
    Write-ColorOutput "  Frontend: Node.js, npm, prettier, eslint" "White"
    Write-ColorOutput "`n"
}

function Invoke-BackendFormat {
    Write-ColorOutput "🎨 Formatting Backend Code..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\backend"

    try {
        if ($Check) {
            Write-ColorOutput "Checking code format (no changes will be made)..." "Yellow"
            & python -m black --check .
            & python -m isort --check-only .
        } else {
            Write-ColorOutput "Formatting Python code with Black..." "Blue"
            & python -m black .

            Write-ColorOutput "Sorting imports with isort..." "Blue"
            & python -m isort .
        }

        Write-ColorOutput "✅ Backend formatting completed" "Green"
    } catch {
        Write-ColorOutput "❌ Backend formatting failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

function Invoke-BackendLint {
    Write-ColorOutput "🔍 Linting Backend Code..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\backend"

    try {
        Write-ColorOutput "Running flake8..." "Blue"
        & python -m flake8 .

        Write-ColorOutput "Running mypy..." "Blue"
        & python -m mypy .

        Write-ColorOutput "✅ Backend linting completed" "Green"
    } catch {
        Write-ColorOutput "❌ Backend linting failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

function Invoke-BackendFixImports {
    Write-ColorOutput "📦 Fixing Backend Imports..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\backend"

    try {
        Write-ColorOutput "Organizing imports with isort..." "Blue"
        & python -m isort . --profile black

        Write-ColorOutput "Removing unused imports..." "Blue"
        & python -m autoflake --remove-all-unused-imports --recursive --in-place .

        Write-ColorOutput "✅ Backend import fixing completed" "Green"
    } catch {
        Write-ColorOutput "❌ Backend import fixing failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

function Invoke-FrontendFormat {
    Write-ColorOutput "🎨 Formatting Frontend Code..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\frontend"

    try {
        if ($Check) {
            Write-ColorOutput "Checking code format (no changes will be made)..." "Yellow"
            & npm run format:check
        } else {
            Write-ColorOutput "Formatting TypeScript/React code with Prettier..." "Blue"
            & npm run format
        }

        Write-ColorOutput "✅ Frontend formatting completed" "Green"
    } catch {
        Write-ColorOutput "❌ Frontend formatting failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

function Invoke-FrontendLint {
    Write-ColorOutput "🔍 Linting Frontend Code..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\frontend"

    try {
        Write-ColorOutput "Running ESLint..." "Blue"
        & npm run lint

        Write-ColorOutput "Running TypeScript type checking..." "Blue"
        & npm run type-check

        Write-ColorOutput "✅ Frontend linting completed" "Green"
    } catch {
        Write-ColorOutput "❌ Frontend linting failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

function Invoke-FrontendFixImports {
    Write-ColorOutput "📦 Fixing Frontend Imports..." "Cyan"

    Push-Location "$PSScriptRoot\..\..\..\frontend"

    try {
        Write-ColorOutput "Organizing imports..." "Blue"
        & npm run lint:fix

        Write-ColorOutput "✅ Frontend import fixing completed" "Green"
    } catch {
        Write-ColorOutput "❌ Frontend import fixing failed: $($_.Exception.Message)" "Red"
        throw
    } finally {
        Pop-Location
    }
}

# Main execution
# Check for help request
if ($Action -eq "help" -or $args -contains "-h" -or $args -contains "--help" -or $args -contains "/?") {
    Show-Help
    exit 0
}

Write-ColorOutput "🛠️  FastAPI PRISMA Code Quality Manager" "Blue"
Write-ColorOutput "====================================" "Blue"
Write-ColorOutput "Action: $Action" "White"
Write-ColorOutput "Target: $Target" "White"
Write-ColorOutput "Check Mode: $Check" "White"
Write-ColorOutput ""

$success = $true

try {
    switch ($Action) {
        "format" {
            if ($Target -eq "backend" -or $Target -eq "all") {
                Invoke-BackendFormat
            }
            if ($Target -eq "frontend" -or $Target -eq "all") {
                Invoke-FrontendFormat
            }
        }
        "lint" {
            if ($Target -eq "backend" -or $Target -eq "all") {
                Invoke-BackendLint
            }
            if ($Target -eq "frontend" -or $Target -eq "all") {
                Invoke-FrontendLint
            }
        }
        "fix-imports" {
            if ($Target -eq "backend" -or $Target -eq "all") {
                Invoke-BackendFixImports
            }
            if ($Target -eq "frontend" -or $Target -eq "all") {
                Invoke-FrontendFixImports
            }
        }
        "all" {
            if ($Target -eq "backend" -or $Target -eq "all") {
                Invoke-BackendFixImports
                Invoke-BackendFormat
                Invoke-BackendLint
            }
            if ($Target -eq "frontend" -or $Target -eq "all") {
                Invoke-FrontendFixImports
                Invoke-FrontendFormat
                Invoke-FrontendLint
            }
        }
    }

    Write-ColorOutput "`n🎉 Code quality operations completed successfully!" "Green"
} catch {
    Write-ColorOutput "`n❌ Code quality operations failed!" "Red"
    $success = $false
}

exit $(if ($success) { 0 } else { 1 })
