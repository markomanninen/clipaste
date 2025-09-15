#!/bin/bash

# Quick Test Script for clipaste
# This script provides easy commands for testing across platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run local tests
run_local_tests() {
    print_status "Running local tests..."
    npm run test:pre-commit
    print_success "Local tests completed!"
}

# Function to build Docker image
build_docker() {
    print_status "Building Docker test image..."
    if ! command_exists docker; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    docker build -f scripts/Dockerfile.test -t clipaste-test-ubuntu-node16 .
    print_success "Docker image built successfully!"
}

# Function to run Docker tests
run_docker_tests() {
    print_status "Running tests in Docker (Ubuntu headless environment)..."
    if ! docker image inspect clipaste-test-ubuntu-node16 >/dev/null 2>&1; then
        print_warning "Docker image not found. Building..."
        build_docker
    fi
    
    docker run --rm clipaste-test-ubuntu-node16 /bin/bash -c "npm run test:pre-commit"
    print_success "Docker tests completed!"
}

# Function to run full cross-platform test suite
run_full_tests() {
    print_status "Running full cross-platform test suite..."
    
    # Local tests
    print_status "Step 1/2: Local environment tests"
    run_local_tests
    
    # Docker tests
    print_status "Step 2/2: Docker headless environment tests"
    run_docker_tests
    
    print_success "All cross-platform tests passed! ✅"
}

# Function to run interactive mode
run_interactive() {
    echo ""
    echo "=== clipaste Test Runner ==="
    echo ""
    echo "Choose a test option:"
    echo "1) Local tests only (fast)"
    echo "2) Docker tests only (headless simulation)"
    echo "3) Full cross-platform tests (local + Docker)"
    echo "4) Build Docker image only"
    echo "5) Quick development test (pre-commit)"
    echo "q) Quit"
    echo ""
    read -p "Enter your choice [1-5, q]: " choice
    
    case $choice in
        1)
            run_local_tests
            ;;
        2)
            run_docker_tests
            ;;
        3)
            run_full_tests
            ;;
        4)
            build_docker
            ;;
        5)
            print_status "Running quick pre-commit tests..."
            npm run test:pre-commit
            ;;
        q|Q)
            print_status "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please try again."
            run_interactive
            ;;
    esac
}

# Function to show help
show_help() {
    echo "clipaste Test Runner"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  local       Run tests in local environment only"
    echo "  docker      Run tests in Docker environment only"
    echo "  full        Run full cross-platform test suite"
    echo "  build       Build Docker test image"
    echo "  quick       Run quick pre-commit tests"
    echo "  interactive Interactive mode (default)"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Interactive mode"
    echo "  $0 local        # Quick local tests"
    echo "  $0 docker       # Test headless environment"
    echo "  $0 full         # Complete cross-platform testing"
    echo ""
    echo "Environment Detection:"
    echo "  Local tests will use your system's clipboard (GUI environment)"
    echo "  Docker tests simulate headless CI/CD environments"
    echo ""
}

# Main script logic
case "${1:-interactive}" in
    local)
        run_local_tests
        ;;
    docker)
        run_docker_tests
        ;;
    full)
        run_full_tests
        ;;
    build)
        build_docker
        ;;
    quick)
        print_status "Running quick pre-commit tests..."
        npm run test:pre-commit
        ;;
    interactive)
        run_interactive
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac