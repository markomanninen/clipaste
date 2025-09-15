# Development Scripts

This directory contains development and testing scripts for the clipaste project.

## Scripts

### `test-ci-simulation.sh`

Simulates CI environment for testing clipboard functionality with `CI=true` environment variable.

**Usage:**

```bash
./scripts/test-ci-simulation.sh
```

**Purpose:**

- Tests clipboard-dependent functionality with CI flag set
- Validates that tests still pass in CI-like conditions
- Useful for local CI environment simulation

### `test-ci-protections.sh`

Comprehensive test of CI environment protections and error handling.

**Usage:**

```bash
./scripts/test-ci-protections.sh
```

**Purpose:**

- Validates CI environment protection logic
- Tests error handling scenarios
- Confirms graceful degradation works
- Provides summary of CI readiness

### `test-docker.sh`

Runs tests in a Docker container with Ubuntu and Node 16 to replicate CI environment.

**Usage:**

```bash
./scripts/test-docker.sh
```

**Requirements:**

- Docker must be running
- Uses `Dockerfile.test` for container setup

**Purpose:**

- Full CI environment replication
- Tests with xvfb (virtual display)
- Validates Ubuntu + Node 16 compatibility

### `Dockerfile.test`

Docker configuration for testing in Ubuntu environment with Node 16.

**Purpose:**

- Replicates GitHub Actions CI environment
- Includes xvfb and xclip for clipboard testing
- Runs both regular tests and coverage tests

## When to Use These Scripts

- **During development**: Run `test-ci-protections.sh` to verify CI compatibility
- **Before PR**: Run `test-ci-simulation.sh` to catch potential CI issues
- **Debugging CI failures**: Use `test-docker.sh` to replicate exact CI environment
- **Platform testing**: Use Docker setup to test across different environments

## Notes

These scripts were created to address CI environment issues where clipboard operations behave differently in headless Linux environments compared to local development machines.
