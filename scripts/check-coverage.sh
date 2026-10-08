#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Minimum required branch coverage
MIN_COVERAGE=80

echo -e "${YELLOW}Running tests with coverage...${NC}\n"

# Run tests with coverage and capture output
OUTPUT=$(npm run test:coverage 2>&1)
EXIT_CODE=$?

# Display the full output
echo "$OUTPUT"

# Check if tests failed
if [ $EXIT_CODE -ne 0 ]; then
    echo -e "\n${RED}❌ Tests failed!${NC}"
    exit 1
fi

# Extract branch coverage percentage from the summary
BRANCH_COVERAGE=$(echo "$OUTPUT" | grep "Branches" | awk '{print $3}' | sed 's/%//')

# Check if we got a valid number
if [ -z "$BRANCH_COVERAGE" ]; then
    echo -e "\n${RED}❌ Could not extract branch coverage percentage${NC}"
    exit 1
fi

# Compare coverage with minimum
echo -e "\n========================================="
echo -e "Branch Coverage: ${BRANCH_COVERAGE}%"
echo -e "Required: ${MIN_COVERAGE}%"
echo -e "=========================================\n"

# Use bc for floating point comparison
if (( $(echo "$BRANCH_COVERAGE >= $MIN_COVERAGE" | bc -l) )); then
    echo -e "${GREEN}✅ Branch coverage meets minimum requirement (${MIN_COVERAGE}%)${NC}"
    exit 0
else
    echo -e "${RED}❌ Branch coverage below minimum requirement (${MIN_COVERAGE}%)${NC}"
    echo -e "${RED}   Current: ${BRANCH_COVERAGE}%, Required: ${MIN_COVERAGE}%${NC}"
    exit 1
fi
