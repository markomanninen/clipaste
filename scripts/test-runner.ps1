# Quick Test Script for clipaste (PowerShell)
# This script provides easy commands for testing across platforms

param(
    [string]$Action = "interactive"
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    return (Get-Command $Command -ErrorAction SilentlyContinue) -ne $null
}

# Function to run local tests
function Invoke-LocalTests {
    Write-Status "Running local tests..."
    npm run test:pre-commit
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Local tests completed!"
    } else {
        Write-Error "Local tests failed!"
        exit 1
    }
}

# Function to build Docker image
function Build-DockerImage {
    Write-Status "Building Docker test image..."
    if (-not (Test-Command "docker")) {
        Write-Error "Docker is not installed or not in PATH"
        exit 1
    }
    
    docker build -f scripts/Dockerfile.test -t clipaste-test-ubuntu-node16 .
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker image built successfully!"
    } else {
        Write-Error "Docker build failed!"
        exit 1
    }
}

# Function to run Docker tests
function Invoke-DockerTests {
    Write-Status "Running tests in Docker (Ubuntu headless environment)..."
    if (-not (Test-Command "docker")) {
        Write-Error "Docker is not installed or not in PATH"
        exit 1
    }
    
    # Check if image exists
    $imageExists = docker image inspect clipaste-test-ubuntu-node16 2>$null
    if (-not $imageExists) {
        Write-Warning "Docker image not found. Building..."
        Build-DockerImage
    }
    
    docker run --rm clipaste-test-ubuntu-node16 /bin/bash -c "npm run test:pre-commit"
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker tests completed!"
    } else {
        Write-Error "Docker tests failed!"
        exit 1
    }
}

# Function to run full cross-platform test suite
function Invoke-FullTests {
    Write-Status "Running full cross-platform test suite..."
    
    # Local tests
    Write-Status "Step 1/2: Local environment tests"
    Invoke-LocalTests
    
    # Docker tests
    Write-Status "Step 2/2: Docker headless environment tests"
    Invoke-DockerTests
    
    Write-Success "All cross-platform tests passed! ✅"
}

# Function to run interactive mode
function Invoke-InteractiveMode {
    Write-Host ""
    Write-Host "=== clipaste Test Runner ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Choose a test option:"
    Write-Host "1) Local tests only (fast)"
    Write-Host "2) Docker tests only (headless simulation)"
    Write-Host "3) Full cross-platform tests (local + Docker)"
    Write-Host "4) Build Docker image only"
    Write-Host "5) Quick development test (pre-commit)"
    Write-Host "q) Quit"
    Write-Host ""
    $choice = Read-Host "Enter your choice [1-5, q]"
    
    switch ($choice) {
        "1" {
            Invoke-LocalTests
        }
        "2" {
            Invoke-DockerTests
        }
        "3" {
            Invoke-FullTests
        }
        "4" {
            Build-DockerImage
        }
        "5" {
            Write-Status "Running quick pre-commit tests..."
            npm run test:pre-commit
        }
        { $_ -eq "q" -or $_ -eq "Q" } {
            Write-Status "Goodbye!"
            exit 0
        }
        default {
            Write-Error "Invalid choice. Please try again."
            Invoke-InteractiveMode
        }
    }
}

# Function to show help
function Show-Help {
    Write-Host "clipaste Test Runner (PowerShell)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\test-runner.ps1 [OPTION]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  local       Run tests in local environment only"
    Write-Host "  docker      Run tests in Docker environment only"
    Write-Host "  full        Run full cross-platform test suite"
    Write-Host "  build       Build Docker test image"
    Write-Host "  quick       Run quick pre-commit tests"
    Write-Host "  interactive Interactive mode (default)"
    Write-Host "  help        Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\test-runner.ps1              # Interactive mode"
    Write-Host "  .\scripts\test-runner.ps1 local        # Quick local tests"
    Write-Host "  .\scripts\test-runner.ps1 docker       # Test headless environment"
    Write-Host "  .\scripts\test-runner.ps1 full         # Complete cross-platform testing"
    Write-Host ""
    Write-Host "Environment Detection:"
    Write-Host "  Local tests will use your system's clipboard (GUI environment)"
    Write-Host "  Docker tests simulate headless CI/CD environments"
    Write-Host ""
}

# Main script logic
switch ($Action.ToLower()) {
    "local" {
        Invoke-LocalTests
    }
    "docker" {
        Invoke-DockerTests
    }
    "full" {
        Invoke-FullTests
    }
    "build" {
        Build-DockerImage
    }
    "quick" {
        Write-Status "Running quick pre-commit tests..."
        npm run test:pre-commit
    }
    "interactive" {
        Invoke-InteractiveMode
    }
    { $_ -eq "help" -or $_ -eq "--help" -or $_ -eq "-h" } {
        Show-Help
    }
    default {
        Write-Error "Unknown option: $Action"
        Write-Host ""
        Show-Help
        exit 1
    }
}