#!/bin/bash

echo "Simulating CI environment for clipboard tests..."
echo "Setting CI=true and running tests that depend on clipboard operations"

# Set CI environment variable
export CI=true

# Run specific clipboard-dependent tests
echo ""
echo "Testing phase1-enhancements (clipboard integration tests):"
npm test -- --testPathPattern="phase1-enhancements.test.js" --verbose

echo ""
echo "Testing watcher tests (timing sensitive):"
npm test -- --testPathPattern="watcher.test.js" --verbose

echo ""
echo "If these tests pass, the CI issues should be resolved!"