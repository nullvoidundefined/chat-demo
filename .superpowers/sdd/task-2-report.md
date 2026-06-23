# Task 2 Report: Env config loader (fail-fast)

## TDD Evidence

### Step 1: RED (Failing Test)
```bash
$ npx vitest run src/__tests__/config/loadServerConfig.test.ts
Exit code 1

FAIL  src/__tests__/config/loadServerConfig.test.ts
Error: Failed to resolve import "@/config/loadServerConfig" from "src/__tests__/config/loadServerConfig.test.ts". 
Does the file exist?
```
Expected failure: module does not exist.

### Step 2: Implementation Written
Created `src/config/loadServerConfig.ts` with:
- `ServerConfig` type defining `anthropicApiKey` and `tavilyApiKey` as strings
- `loadServerConfig()` function reading both env vars and returning config object
- `requireEnv()` helper that throws a clear error naming any missing variable

### Step 3: GREEN (Passing Tests)
```bash
$ npx vitest run src/__tests__/config/loadServerConfig.test.ts
✓ src/__tests__/config/loadServerConfig.test.ts (2 tests) 2ms

Test Files  1 passed (1)
Tests  2 passed (2)
```

## Files Changed

| File | Change |
|---|---|
| `src/config/loadServerConfig.ts` | Created: server-only env config loader with fail-fast validation |
| `src/__tests__/config/loadServerConfig.test.ts` | Created: unit tests for both keys present and missing key detection |

## Test Coverage

Both required test cases pass:
1. **Happy path**: Returns correct config when both `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` are set
2. **Fail-fast**: Throws error naming `TAVILY_API_KEY` when missing (error message includes the variable name)

## Implementation Notes

- File includes required `/** */` header comment explaining purpose
- `requireEnv()` helper centralizes the validation logic and provides clear error messages
- Function is synchronous (no async overhead for env validation)
- TypeScript strict mode satisfied (all types explicit)

## Commit

```
Commit: 4b268e2
Message: feat: add fail-fast server env config loader
```

Branch: `feat/tool-use-research-chatbot` (current branch, no new branches created)

## Self-Review

✓ Test file follows brief exactly (imports, setup, two test cases)
✓ Implementation file follows brief exactly (type, functions, error handling)
✓ File-level header comment present and accurate
✓ Both tests pass
✓ Error message clearly names the missing variable (regex assertion validates this)
✓ TDD steps executed in order: RED → implement → GREEN → commit
✓ No concerns

## Status

DONE
