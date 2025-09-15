#!/bin/bash

echo "Building Docker test image for Ubuntu Node 16..."
docker build -f scripts/Dockerfile.test -t clipaste-test-ubuntu-node16 .
#docker build -f Dockerfile.test -t clipaste-test-ubuntu-node16 .

if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi

echo ""
echo "Running tests in Docker container..."
echo "This replicates the CI environment: Ubuntu + Node 16 + xvfb"
echo ""

# Run the container
docker run --rm clipaste-test-ubuntu-node16

echo ""
echo "Docker test completed!"