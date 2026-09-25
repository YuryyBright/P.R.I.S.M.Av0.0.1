#!/usr/bin/env pwsh
# Build Environment Images Script for FastAPI PRISMA
# This script builds all Docker images for specified environments with proper tagging

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "test", "prod-test", "prod", "all")]
    [string]$Environment = "test",

    [switch]$VerboseOutput,
    [switch]$NoCache,
    [switch]$CleanFirst,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Color functions for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    if ($Color -eq "Green") { Write-Host $Message -ForegroundColor Green }
    elseif ($Color -eq "Yellow") { Write-Host $Message -ForegroundColor Yellow }
    elseif ($Color -eq "Red") { Write-Host $Message -ForegroundColor Red }
    elseif ($Color -eq "Blue") { Write-Host $Message -ForegroundColor Blue }
    elseif ($Color -eq "Cyan") { Write-Host $Message -ForegroundColor Cyan }
    else { Write-Host $Message }
}

# Environment configuration
$environments = @{
    "dev" = @{
        "tag" = "dev"
        "target" = "development"
        "description" = "Development Environment (Hot-reload, Debug mode)"
        "build_args" = @{
            "NODE_ENV" = "development"
            "ENVIRONMENT" = "development"
            "VITE_MODE" = "development"
        }
    }
    "test" = @{
        "tag" = "test"
        "target" = "testing"
        "description" = "Testing Environment (CI/CD, Integration tests)"
        "build_args" = @{
            "NODE_ENV" = "testing"
            "ENVIRONMENT" = "testing"
            "VITE_MODE" = "testing"
        }
    }
    "prod-test" = @{
        "tag" = "prod-test"
        "target" = "production"
        "description" = "Production Testing Environment (Production-like settings)"
        "build_args" = @{
            "NODE_ENV" = "production"
            "ENVIRONMENT" = "production"
            "VITE_MODE" = "production"
        }
    }
    "prod" = @{
        "tag" = "prod"
        "target" = "production"
        "description" = "Production Environment (Secure, Optimized)"
        "build_args" = @{
            "NODE_ENV" = "production"
            "ENVIRONMENT" = "production"
            "VITE_MODE" = "production"
        }
    }
}

# Handle help request
if ($Help) {
    Write-ColorOutput "🐳 Docker Image Builder - Help" "Cyan"
    Write-ColorOutput "==============================" "Cyan"
    Write-ColorOutput "`nThis script builds Docker images for the FastAPI PRISMA project environments.`n" "White"

    Write-ColorOutput "📋 Usage:" "Yellow"
    Write-ColorOutput "  .\build-images.ps1 -Environment <env> [options]" "White"

    Write-ColorOutput "`n🌐 Environments:" "Yellow"
    foreach ($envKey in $environments.Keys | Sort-Object) {
        $env = $environments[$envKey]
        Write-ColorOutput "  $($envKey.PadRight(10)) : $($env.description)" "White"
    }
    Write-ColorOutput "  all        : Build images for all environments" "White"
      Write-ColorOutput "`n🔧 Options:" "Yellow"
    Write-ColorOutput "  -Environment <env> : Environment to build (default: test)" "White"
    Write-ColorOutput "  -VerboseOutput     : Show detailed build output" "White"
    Write-ColorOutput "  -NoCache           : Build without using Docker cache" "White"
    Write-ColorOutput "  -CleanFirst        : Remove existing images before building" "White"
    Write-ColorOutput "  -Help              : Show this help message" "White"

    Write-ColorOutput "`n📝 Examples:" "Yellow"
    Write-ColorOutput "  .\build-images.ps1 -Environment dev" "Green"
    Write-ColorOutput "  .\build-images.ps1 -Environment test -VerboseOutput -NoCache" "Green"
    Write-ColorOutput "  .\build-images.ps1 -Environment all -CleanFirst" "Green"
    Write-ColorOutput "  .\build-images.ps1 -Help" "Green"

    Write-ColorOutput "`n🏗️ Built Images:" "Yellow"
    Write-ColorOutput "  For each environment, the following images are built:" "White"
    Write-ColorOutput "    • prisma:<tag>        - Backend API service" "White"
    Write-ColorOutput "    • prisma_worker:<tag> - Background worker service" "White"
    Write-ColorOutput "    • react_frontend:<tag>      - Frontend web application" "White"

    Write-ColorOutput "`n💡 Tips:" "Yellow"
    Write-ColorOutput "  • Use -VerboseOutput to troubleshoot build issues" "White"
    Write-ColorOutput "  • Use -NoCache to ensure fresh builds" "White"
    Write-ColorOutput "  • Use -CleanFirst to free up disk space" "White"
    Write-ColorOutput "  • Build 'test' environment for development testing" "White"
    Write-ColorOutput "  • Build 'prod' environment for production deployment" "White"

    exit 0
}

function Build-DockerImage {
    param(
        [string]$Context,
        [string]$Dockerfile,
        [string]$ImageName,
        [string]$Target,
        [hashtable]$BuildArgs = @{}
    )

    Write-ColorOutput "Building image: $ImageName (target: $Target)" "Blue"

    $buildCommand = @("docker", "build")

    if ($NoCache) {
        $buildCommand += "--no-cache"
    }

    $buildCommand += "-t", $ImageName
    $buildCommand += "--target", $Target
    $buildCommand += "-f", $Dockerfile

    foreach ($key in $BuildArgs.Keys) {
        $buildCommand += "--build-arg", "$key=$($BuildArgs[$key])"
    }

    $buildCommand += $Context
      if ($VerboseOutput) {
        Write-ColorOutput "Executing: $($buildCommand -join ' ')" "Yellow"
    }

    try {
        $output = & $buildCommand[0] $buildCommand[1..($buildCommand.Length-1)] 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Successfully built: $ImageName" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Failed to build: $ImageName" "Red"
            if ($VerboseOutput) {
                Write-ColorOutput "Build output: $output" "Red"
            }
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Exception while building: $ImageName" "Red"
        Write-ColorOutput "Error: $_" "Red"
        return $false
    }
}

function Get-ImageConfiguration {
    param([string]$Environment, [string]$Tag)

    $config = $environments[$Environment]
    $images = @(
        @{
            Context = "backend"
            Dockerfile = "backend/Dockerfile"
            ImageName = "prisma:$Tag"
            Target = $config.target
            BuildArgs = @{
                NODE_ENV = $config.build_args.NODE_ENV
                ENVIRONMENT = $config.build_args.ENVIRONMENT
            }
        },
        @{
            Context = "backend"
            Dockerfile = "backend/Dockerfile"
            ImageName = "prisma_worker:$Tag"
            Target = $config.target
            BuildArgs = @{
                NODE_ENV = $config.build_args.NODE_ENV
                ENVIRONMENT = $config.build_args.ENVIRONMENT
            }
        },
        @{
            Context = "admin_frontend"
            Dockerfile = "admin_frontend/Dockerfile"
            ImageName = "react_frontend:$Tag"
            Target = $config.target
            BuildArgs = @{
                NODE_ENV = $config.build_args.NODE_ENV
                VITE_MODE = $config.build_args.VITE_MODE
            }
        }
    )

    return $images
}

function Remove-ExistingImages {
    param([string[]]$ImageNames)

    Write-ColorOutput "Cleaning up existing images..." "Yellow"
    foreach ($image in $ImageNames) {
        $existing = docker images -q $image 2>$null
        if ($existing) {
            Write-ColorOutput "  Removing: $image" "Yellow"
            docker image rm $image -f 2>$null | Out-Null
        }
    }
    Write-ColorOutput "✅ Cleanup completed" "Green"
}

function Build-EnvironmentImages {
    param([string]$Environment)

    if (-not $environments.ContainsKey($Environment)) {
        Write-ColorOutput "❌ Unknown environment: $Environment" "Red"
        Write-ColorOutput "Available environments: $($environments.Keys -join ', ')" "Yellow"
        return $false
    }

    $config = $environments[$Environment]
    $tag = $config.tag
    $images = Get-ImageConfiguration -Environment $Environment -Tag $tag

    Write-ColorOutput "=== Building images for environment: $Environment ===" "Blue"
    Write-ColorOutput "Description: $($config.description)" "Blue"
    Write-ColorOutput "Target: $($config.target)" "Blue"
    Write-ColorOutput "Tag: $tag" "Blue"
    Write-ColorOutput "" "White"

    if ($CleanFirst) {
        $imageNames = $images | ForEach-Object { $_.ImageName }
        Remove-ExistingImages -ImageNames $imageNames
        Write-ColorOutput "" "White"
    }

    $allBuildsSucceeded = $true

    # Build each image
    foreach ($imageConfig in $images) {
        if (-not (Build-DockerImage -Context $imageConfig.Context -Dockerfile $imageConfig.Dockerfile -ImageName $imageConfig.ImageName -Target $imageConfig.Target -BuildArgs $imageConfig.BuildArgs)) {
            $allBuildsSucceeded = $false
        }
        Write-ColorOutput "" "White"
    }

    # Show results for this environment
    if ($allBuildsSucceeded) {
        Write-ColorOutput "🎉 All images built successfully for environment: $Environment" "Green"
        Write-ColorOutput "" "White"
        Write-ColorOutput "Built images:" "Blue"
        foreach ($imageConfig in $images) {
            Write-ColorOutput "  ✅ $($imageConfig.ImageName)" "Green"
        }
        Write-ColorOutput "" "White"
        Write-ColorOutput "You can now start the $Environment environment with:" "Blue"
        Write-ColorOutput "  .\scripts\docker\environments\manage-environments.ps1 -Environment $Environment -Action up -Detached" "Yellow"
    } else {
        Write-ColorOutput "❌ Some image builds failed for environment: $Environment" "Red"
    }

    Write-ColorOutput "" "White"
    return $allBuildsSucceeded
}

# Main execution logic
Write-ColorOutput "🐳 FastAPI PRISMA Docker Image Builder" "Cyan"
Write-ColorOutput "====================================" "Cyan"
Write-ColorOutput "" "White"

$overallSuccess = $true
$builtEnvironments = @()

if ($Environment -eq "all") {
    Write-ColorOutput "Building images for all environments..." "Blue"
    Write-ColorOutput "" "White"

    foreach ($envKey in @("dev", "test", "prod-test", "prod")) {
        $success = Build-EnvironmentImages -Environment $envKey
        if ($success) {
            $builtEnvironments += $envKey
        } else {
            $overallSuccess = $false
        }

        if ($envKey -ne "prod") {
            Write-ColorOutput "═══════════════════════════════════════════════════════════════" "Blue"
            Write-ColorOutput "" "White"
        }
    }
} else {
    $success = Build-EnvironmentImages -Environment $Environment
    if ($success) {
        $builtEnvironments += $Environment
    } else {
        $overallSuccess = $false
    }
}

# Final summary
Write-ColorOutput "═══════════════════════════════════════════════════════════════" "Blue"
Write-ColorOutput "" "White"

if ($overallSuccess) {
    Write-ColorOutput "🎉 All requested images built successfully!" "Green"
    Write-ColorOutput "" "White"
    Write-ColorOutput "✅ Successfully built environments:" "Green"
    foreach ($env in $builtEnvironments) {
        $config = $environments[$env]
        Write-ColorOutput "   • $env ($($config.description))" "Green"
    }
} else {
    Write-ColorOutput "❌ Some image builds failed. Please check the errors above." "Red"
    if ($builtEnvironments.Count -gt 0) {
        Write-ColorOutput "" "White"
        Write-ColorOutput "✅ Successfully built environments:" "Green"
        foreach ($env in $builtEnvironments) {
            $config = $environments[$env]
            Write-ColorOutput "   • $env ($($config.description))" "Green"
        }
    }
}

# Show disk usage information
Write-ColorOutput "" "White"
Write-ColorOutput "💾 Docker Images Summary:" "Blue"
$allImageNames = @()
foreach ($env in $builtEnvironments) {
    $tag = $environments[$env].tag
    $allImageNames += "prisma:$tag"
    $allImageNames += "prisma_worker:$tag"
    $allImageNames += "react_frontend:$tag"
}

if ($allImageNames.Count -gt 0) {
    foreach ($imageName in $allImageNames) {
        $imageInfo = docker images $imageName --format "{{.Repository}}:{{.Tag}} - {{.Size}} ({{.CreatedSince}})" 2>$null
        if ($imageInfo) {
            Write-ColorOutput "  $imageInfo" "White"
        }
    }

    Write-ColorOutput "" "White"
    Write-ColorOutput "💡 Next Steps:" "Yellow"
    Write-ColorOutput "   • Use manage-environments.ps1 to start your environment" "White"
    Write-ColorOutput "   • Run 'docker system df' to check disk usage" "White"
    Write-ColorOutput "   • Run 'docker system prune' to clean up unused images" "White"
} else {
    Write-ColorOutput "  No images were built successfully." "Red"
}

if (-not $overallSuccess) {
    exit 1
}
