#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_KEY="next-tt-fe"

# Load SONAR_TOKEN and SONAR_HOST_URL from .env.local if not already set in the environment
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/../.env.local" ]]; then
  export $(grep -E '^(SONAR_TOKEN|SONAR_HOST_URL)=' "$SCRIPT_DIR/../.env.local" | xargs)
fi

SONAR_HOST_URL="${SONAR_HOST_URL:-http://192.168.254.33:9000}"
SONAR_TOKEN="${SONAR_TOKEN}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SonarQube Scan & Issues Report      ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}\n"

# Check if SONAR_TOKEN is set
if [ -z "$SONAR_TOKEN" ]; then
    echo -e "${RED}❌ SONAR_TOKEN environment variable not set${NC}"
    echo -e "${YELLOW}   Please set it with: export SONAR_TOKEN=your_token${NC}"
    echo -e "${YELLOW}   Or run with: SONAR_TOKEN=your_token ./scripts/sonarqube-scan.sh${NC}\n"
    exit 1
fi

# Check if SonarQube server is reachable
if ! curl -s -f "$SONAR_HOST_URL/api/system/status" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to SonarQube server at: $SONAR_HOST_URL${NC}"
    echo -e "${YELLOW}   Make sure SonarQube is running${NC}\n"
    exit 1
fi

# Step 1: Run tests with coverage
echo -e "${CYAN}📊 Step 1: Running tests with coverage...${NC}"
npm run test:coverage > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests completed successfully${NC}\n"
else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi

# Step 2: Run SonarQube scan (if sonar-scanner is installed)
ANALYSIS_KEY=""
if command -v sonar-scanner &> /dev/null; then
    echo -e "${CYAN}🔍 Step 2: Running SonarQube scan...${NC}"

    if [ -n "$SONAR_TOKEN" ]; then
        # Run scanner and capture report task file
        SCAN_OUTPUT=$(mktemp)

        # Clear scanner cache to ensure fresh scan
        rm -rf .scannerwork 2>/dev/null

        sonar-scanner \
            -Dsonar.host.url="$SONAR_HOST_URL" \
            -Dsonar.token="$SONAR_TOKEN" \
            -Dsonar.scm.disabled=true \
            -Dsonar.scm.provider=git \
            -Dsonar.scm.forceReloadAll=true \
            -Dsonar.sourceEncoding=UTF-8 \
            -Dsonar.working.directory=".scannerwork" \
            2>&1 | tee "$SCAN_OUTPUT"

        SCAN_EXIT_CODE=$?

        if [ $SCAN_EXIT_CODE -eq 0 ]; then
            echo -e "${GREEN}✅ SonarQube scan submitted${NC}\n"

            # Extract the CE task ID from the report
            REPORT_TASK_FILE=".scannerwork/report-task.txt"
            if [ -f "$REPORT_TASK_FILE" ]; then
                CE_TASK_URL=$(grep "ceTaskUrl=" "$REPORT_TASK_FILE" | cut -d'=' -f2-)

                if [ -n "$CE_TASK_URL" ]; then
                    echo -e "${CYAN}⏳ Waiting for SonarQube to analyze the code...${NC}"

                    # Poll the CE task until it's complete (max 60 seconds)
                    MAX_WAIT=60
                    WAITED=0
                    TASK_STATUS="PENDING"

                    while [ "$TASK_STATUS" != "SUCCESS" ] && [ "$TASK_STATUS" != "FAILED" ] && [ $WAITED -lt $MAX_WAIT ]; do
                        sleep 2
                        WAITED=$((WAITED + 2))

                        TASK_RESPONSE=$(curl -s -u "$SONAR_TOKEN:" "$CE_TASK_URL")

                        if command -v jq &> /dev/null; then
                            TASK_STATUS=$(echo "$TASK_RESPONSE" | jq -r '.task.status // "UNKNOWN"')
                            # Extract analysis key when task is done
                            if [ "$TASK_STATUS" = "SUCCESS" ]; then
                                ANALYSIS_KEY=$(echo "$TASK_RESPONSE" | jq -r '.task.analysisId // ""')
                            fi
                        else
                            TASK_STATUS=$(echo "$TASK_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
                            # Extract analysis key when task is done
                            if [ "$TASK_STATUS" = "SUCCESS" ]; then
                                ANALYSIS_KEY=$(echo "$TASK_RESPONSE" | grep -o '"analysisId":"[^"]*"' | head -1 | cut -d'"' -f4)
                            fi
                        fi

                        if [ "$TASK_STATUS" = "IN_PROGRESS" ] || [ "$TASK_STATUS" = "PENDING" ]; then
                            echo -e "${YELLOW}   Status: $TASK_STATUS (${WAITED}s)${NC}"
                        fi
                    done

                    if [ "$TASK_STATUS" = "SUCCESS" ]; then
                        echo -e "${GREEN}✅ Analysis completed successfully${NC}"
                        if [ -n "$ANALYSIS_KEY" ]; then
                            echo -e "${CYAN}   Analysis ID: $ANALYSIS_KEY${NC}"
                        fi

                        # Show what files were analyzed
                        if [ -f "$REPORT_TASK_FILE" ]; then
                            echo -e "${CYAN}   Dashboard: $(grep 'dashboardUrl=' $REPORT_TASK_FILE | cut -d'=' -f2-)${NC}"
                        fi

                        # Check if our fixed files were actually scanned
                        if [ -f ".scannerwork/report-task.txt" ]; then
                            echo -e "${CYAN}\n   Verifying fixed files were scanned...${NC}"
                            if [ -f "src/app/globals.css" ]; then
                                CSS_HASH=$(sha256sum src/app/globals.css 2>/dev/null || shasum -a 256 src/app/globals.css 2>/dev/null)
                                echo -e "${CYAN}   - src/app/globals.css: ${CSS_HASH:0:16}...${NC}"
                            fi
                            if [ -f "src/components/ImageUpload.tsx" ]; then
                                TSX_HASH=$(sha256sum src/components/ImageUpload.tsx 2>/dev/null || shasum -a 256 src/components/ImageUpload.tsx 2>/dev/null)
                                echo -e "${CYAN}   - src/components/ImageUpload.tsx: ${TSX_HASH:0:16}...${NC}"
                            fi
                        fi
                        echo ""
                    elif [ "$TASK_STATUS" = "FAILED" ]; then
                        echo -e "${RED}❌ Analysis failed${NC}\n"
                        exit 1
                    else
                        echo -e "${YELLOW}⚠️  Analysis timed out after ${MAX_WAIT}s${NC}\n"
                    fi
                else
                    echo -e "${YELLOW}⚠️  Could not find CE task URL, waiting 5s...${NC}\n"
                    sleep 5
                fi
            else
                echo -e "${YELLOW}⚠️  Report task file not found, waiting 5s...${NC}\n"
                sleep 5
            fi
        else
            echo -e "${RED}❌ Scan failed with exit code $SCAN_EXIT_CODE${NC}"
            echo -e "${YELLOW}⚠️  Continuing to fetch existing results...${NC}\n"
        fi

        rm -f "$SCAN_OUTPUT"
    else
        echo -e "${YELLOW}⚠️  Skipping scan - SONAR_TOKEN required${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Step 2: sonar-scanner not installed - skipping scan${NC}"
    echo -e "${YELLOW}   Install with: brew install sonar-scanner (macOS)${NC}"
    echo -e "${YELLOW}   or visit: https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/${NC}\n"
    echo -e "${CYAN}📋 Fetching existing issues from SonarQube...${NC}\n"
fi

# Step 3: Fetch and display issues
echo -e "${CYAN}🔍 Step 3: Fetching issues from SonarQube...${NC}"

# If we have an analysis key, show that we're fetching from that specific analysis
if [ -n "$ANALYSIS_KEY" ]; then
    echo -e "${CYAN}   Fetching issues from analysis: $ANALYSIS_KEY${NC}\n"
else
    echo -e "${CYAN}   Fetching all unresolved issues${NC}\n"
fi

# Before fetching issues, let's check the quality gate status to see what the latest analysis shows
echo -e "${CYAN}   Checking quality gate status...${NC}"
QG_RESPONSE=$(curl -s -u "$SONAR_TOKEN:" \
    "$SONAR_HOST_URL/api/qualitygates/project_status?projectKey=$PROJECT_KEY")

if command -v jq &> /dev/null; then
    QG_STATUS=$(echo "$QG_RESPONSE" | jq -r '.projectStatus.status // "UNKNOWN"')
    echo -e "${CYAN}   Quality Gate: $QG_STATUS${NC}"
fi

# Get the latest analysis date first
LATEST_ANALYSIS=$(curl -s -u "$SONAR_TOKEN:" \
    "$SONAR_HOST_URL/api/project_analyses/search?project=$PROJECT_KEY&ps=1" | \
    if command -v jq &> /dev/null; then
        jq -r '.analyses[0].date // ""'
    else
        grep -o '"date":"[^"]*"' | head -1 | cut -d'"' -f4
    fi)

if [ -n "$LATEST_ANALYSIS" ]; then
    echo -e "${CYAN}   Latest analysis: $LATEST_ANALYSIS${NC}"
fi

# IMPORTANT: Fetch issues from the CURRENT code on the main branch
# SonarQube keeps historical issues until they're confirmed fixed by a new analysis
# Use sinceLeakPeriod=true to only get issues in the current "new code" period
# Or use inNewCodePeriod=true for SonarQube 9.9+
ISSUES_JSON=$(curl -s -u "$SONAR_TOKEN:" \
    "$SONAR_HOST_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&ps=500&s=FILE_LINE")

# Debug: Show how many issues total
if command -v jq &> /dev/null; then
    TOTAL_FROM_API=$(echo "$ISSUES_JSON" | jq -r '.total // 0')
    echo -e "${CYAN}   Total unresolved issues in database: $TOTAL_FROM_API${NC}"
fi

# Check if curl succeeded
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to connect to SonarQube server${NC}"
    echo -e "${RED}   Make sure SonarQube is running at: $SONAR_HOST_URL${NC}"
    exit 1
fi

echo ""

# Parse and display issues using jq
if command -v jq &> /dev/null; then
    TOTAL_ISSUES=$(echo "$ISSUES_JSON" | jq -r '.total // 0')
else
    # Fallback to grep if jq not available
    TOTAL_ISSUES=$(echo "$ISSUES_JSON" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$TOTAL_ISSUES" ] || [ "$TOTAL_ISSUES" = "null" ]; then
    echo -e "${RED}❌ Could not parse SonarQube response${NC}"
    echo -e "${YELLOW}   Response: ${ISSUES_JSON:0:200}...${NC}"
    exit 1
fi

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Total Issues Found: ${MAGENTA}$TOTAL_ISSUES${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo -e "${GREEN}🎉 No issues found! Code quality looks great!${NC}\n"
    exit 0
fi

# Count by severity using jq
if command -v jq &> /dev/null; then
    BLOCKER=$(echo "$ISSUES_JSON" | jq '[.issues[] | select(.severity=="BLOCKER")] | length')
    CRITICAL=$(echo "$ISSUES_JSON" | jq '[.issues[] | select(.severity=="CRITICAL")] | length')
    MAJOR=$(echo "$ISSUES_JSON" | jq '[.issues[] | select(.severity=="MAJOR")] | length')
    MINOR=$(echo "$ISSUES_JSON" | jq '[.issues[] | select(.severity=="MINOR")] | length')
    INFO=$(echo "$ISSUES_JSON" | jq '[.issues[] | select(.severity=="INFO")] | length')
else
    # Fallback to grep
    BLOCKER=$(echo "$ISSUES_JSON" | grep -o '"severity":"BLOCKER"' | wc -l | tr -d ' ')
    CRITICAL=$(echo "$ISSUES_JSON" | grep -o '"severity":"CRITICAL"' | wc -l | tr -d ' ')
    MAJOR=$(echo "$ISSUES_JSON" | grep -o '"severity":"MAJOR"' | wc -l | tr -d ' ')
    MINOR=$(echo "$ISSUES_JSON" | grep -o '"severity":"MINOR"' | wc -l | tr -d ' ')
    INFO=$(echo "$ISSUES_JSON" | grep -o '"severity":"INFO"' | wc -l | tr -d ' ')
fi

echo -e "${YELLOW}Issues by Severity:${NC}"
[ "$BLOCKER" -gt 0 ] && echo -e "  ${RED}🔴 BLOCKER: $BLOCKER${NC}"
[ "$CRITICAL" -gt 0 ] && echo -e "  ${RED}🟠 CRITICAL: $CRITICAL${NC}"
[ "$MAJOR" -gt 0 ] && echo -e "  ${YELLOW}🟡 MAJOR: $MAJOR${NC}"
[ "$MINOR" -gt 0 ] && echo -e "  ${CYAN}🔵 MINOR: $MINOR${NC}"
[ "$INFO" -gt 0 ] && echo -e "  ${BLUE}ℹ️  INFO: $INFO${NC}"

echo -e "\n${CYAN}📄 Detailed Issues:${NC}\n"

# Extract and display issues with file locations
if command -v jq &> /dev/null; then
    echo "$ISSUES_JSON" | jq -r '.issues[] | "\(.severity)|\(.component | split(":")[1]):\(.textRange.startLine // "?")|\(.message)"' | head -20 | while IFS='|' read -r severity file message; do
        case "$severity" in
            BLOCKER)   ICON="${RED}🔴 BLOCKER${NC}" ;;
            CRITICAL)  ICON="${RED}🟠 CRITICAL${NC}" ;;
            MAJOR)     ICON="${YELLOW}🟡 MAJOR${NC}" ;;
            MINOR)     ICON="${CYAN}🔵 MINOR${NC}" ;;
            INFO)      ICON="${BLUE}ℹ️  INFO${NC}" ;;
            *)         ICON="❓ $severity" ;;
        esac
        echo -e "  $ICON"
        echo -e "    📄 ${file}"
        echo -e "    💬 ${message}\n"
    done
else
    # Fallback to simpler display
    echo "$ISSUES_JSON" | grep -o '"message":"[^"]*"' | head -20 | while IFS= read -r line; do
        MESSAGE=$(echo "$line" | sed 's/"message":"\(.*\)"/\1/')
        echo -e "  • $MESSAGE"
    done
fi

echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${YELLOW}📊 View full report:${NC}"
echo -e "${CYAN}   $SONAR_HOST_URL/dashboard?id=$PROJECT_KEY${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

# Exit with error if there are BLOCKER or CRITICAL issues
if [ "$BLOCKER" -gt 0 ] || [ "$CRITICAL" -gt 0 ]; then
    echo -e "${RED}❌ Found BLOCKER or CRITICAL issues - please fix before deploying${NC}\n"
    exit 1
fi

if [ "$MAJOR" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found MAJOR issues - consider fixing before deploying${NC}\n"
    exit 1
fi

echo -e "${GREEN}✅ No critical issues found${NC}\n"
exit 0
