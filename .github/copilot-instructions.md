# GitHub Copilot Instructions for text-conversation-rewards

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information in these instructions is incomplete or found to be in error.**

## Repository Overview

The text-conversation-rewards repository is a TypeScript-based GitHub plugin that generates rewards for meaningful conversation contributions in issues and pull requests. It consists of two main applications: an API server and a web UI interface built with Vite.

## Essential Setup Requirements

### Install Bun Package Manager (MANDATORY)
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # Verify installation
```

### Bootstrap the Repository
```bash
# Install dependencies - NEVER CANCEL: Takes 2-3 minutes on first run due to network dependencies
bun install --ignore-scripts  # Use --ignore-scripts to avoid network issues
```

### Handle Network Dependency (CRITICAL)
If bun install fails with "ConnectionRefused" for chainlist.org, create the required rpcs.json file manually:
```bash
mkdir -p src/types
cat > src/types/rpcs.json << 'EOF'
[
  {
    "chainId": 1,
    "explorers": [{"url": "https://etherscan.io"}]
  },
  {
    "chainId": 100,
    "explorers": [{"url": "https://gnosisscan.io"}]
  }
]
EOF
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with appropriate values for your environment
```

## Build and Test Commands

### Build the UI (Required for server to work properly)
```bash
cd src/web
# NEVER CANCEL: Build takes 10-15 seconds. Set timeout to 60+ seconds
bun run ui:build
cd ../..
```

### Run Tests
```bash
# NEVER CANCEL: Test suite takes 45-60 seconds. Set timeout to 120+ seconds
bun run test
```

### Run Linting and Formatting
```bash
# NEVER CANCEL: Linting takes 30-45 seconds. Set timeout to 90+ seconds
bun run format:lint

# NEVER CANCEL: Prettier takes 2-3 seconds. Set timeout to 30+ seconds
bun run format:prettier

# NEVER CANCEL: Spell check takes 2-3 seconds. Set timeout to 30+ seconds
bun run format:cspell
```

### Run All Formatting Checks
```bash
# NEVER CANCEL: All formatting takes 45-60 seconds total. Set timeout to 120+ seconds
bun run format
```

## Running the Applications

### Start the API Server
```bash
# Starts server on http://localhost:4000
# ALWAYS build UI first with: cd src/web && bun run ui:build && cd ../..
bun run server
```

### Start the UI Development Server (Separate from API server)
```bash
cd src/web
# Starts Vite dev server on http://localhost:5173
bun run ui:dev
```

### Preview Built UI
```bash
cd src/web
# Serves built UI on http://localhost:4173
bun run ui:preview
```

## Validation Requirements

### ALWAYS Test Complete Workflows After Changes
1. **Build and Serve Validation:**
   ```bash
   # Build UI
   cd src/web && bun run ui:build && cd ../..
   
   # Start server
   bun run server &
   SERVER_PID=$!
   
   # Test server responds with UI
   curl -s http://localhost:4000/ | grep -q "text-conversation-rewards"
   
   # Test API endpoint
   curl -X POST http://localhost:4000/openai/contentEvaluator/test \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"content":"The number of entries in the JSON response must equal 1"}]}' \
     | grep -q "choices"
   
   # Stop server
   kill $SERVER_PID
   ```

2. **Development Workflow Validation:**
   ```bash
   # Always run linting before committing
   bun run format:lint
   
   # Always run tests to ensure no regressions
   bun run test
   ```

### Manual Testing Scenarios
- **Server Functionality**: Verify server starts on port 4000 and serves the built UI correctly
- **API Endpoints**: Test that POST to "/" and "/openai/*" endpoints respond appropriately
- **UI Build Process**: Ensure `bun run ui:build` creates dist/ folder with index.html and assets
- **Development Server**: Verify `bun run ui:dev` starts Vite server on port 5173

## Common Commands and Expected Times

| Command | Expected Time | Timeout Setting | Description |
|---------|---------------|-----------------|-------------|
| `bun install` | 2-3 minutes (first time) | 600+ seconds | Install dependencies |
| `bun install` | <1 second (cached) | 60+ seconds | Install when cached |
| `bun run ui:build` | 10-15 seconds | 60+ seconds | Build production UI |
| `bun run test` | 45-60 seconds | 120+ seconds | Run full test suite |
| `bun run format:lint` | 30-45 seconds | 90+ seconds | ESLint with auto-fix |
| `bun run format:prettier` | 2-3 seconds | 30+ seconds | Format all files |
| `bun run format:cspell` | 2-3 seconds | 30+ seconds | Spell checking |
| `bun run server` | <1 second to start | N/A | Start API server |
| `bun run ui:dev` | <1 second to start | N/A | Start UI dev server |

## Repository Structure and Key Files

### Main Application Code
- `src/index.ts` - Main plugin entry point
- `src/run.ts` - Core execution logic
- `src/parser/` - Content evaluation and processing modules
- `src/web/api/index.ts` - API server implementation
- `src/web/main.tsx` - UI application entry point

### Configuration Files
- `package.json` - Main dependencies and scripts
- `src/web/package.json` - UI-specific dependencies and scripts
- `jest.config.ts` - Test configuration
- `eslint.config.mjs` - Linting rules
- `.env.example` - Environment variables template

### Build Outputs
- `src/web/dist/` - Built UI files (served by API server)
- `coverage/` - Test coverage reports
- `results/` - Generated reward calculation results

## Troubleshooting Common Issues

### Network Connectivity Issues
If `bun install` fails with "ConnectionRefused" for chainlist.org:
1. Use `bun install --ignore-scripts` to skip the failing script
2. Manually create `src/types/rpcs.json` with the chain data structure shown above

### TypeScript Compilation Errors
If you see errors about missing chains or rpcs.json:
- Ensure `src/types/rpcs.json` exists with proper chain data structure
- The file must be a JSON array of objects with `chainId` and `explorers` properties

### Server Won't Start or Serves 404
- Always run `cd src/web && bun run ui:build` before starting the server
- The server serves static files from `src/web/dist/`

### Test Failures
- Some tests may fail due to missing environment variables - this is expected in development
- Focus on ensuring no NEW test failures are introduced by your changes
- Test suite coverage should remain stable or improve

## Working Effectively

1. **ALWAYS build UI before testing server changes**: `cd src/web && bun run ui:build && cd ../..`
2. **ALWAYS run formatting before committing**: `bun run format`
3. **ALWAYS run tests to verify changes**: `bun run test`
4. **Use specific timeout values** as listed above to avoid premature command cancellation
5. **Follow the complete validation workflow** after making any changes
6. **Check both server (port 4000) and UI dev server (port 5173)** functionality when working on frontend changes

## Important Notes

- **NEVER CANCEL long-running commands** - builds and tests can take several minutes
- **Network dependencies can cause failures** - use the rpcs.json workaround when needed
- **Two separate applications** - API server and UI dev server run on different ports
- **UI must be built** for the server to serve it correctly
- **Environment variables are required** for full functionality but optional for basic development