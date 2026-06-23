### Task 2: Env config loader (fail-fast)

**Files:**
- Create: `src/config/loadServerConfig.ts`
- Test: `src/__tests__/config/loadServerConfig.test.ts`

**Interfaces:**
- Produces: `loadServerConfig(): { anthropicApiKey: string; tavilyApiKey: string }` — throws a clear `Error` if either env var is missing or empty.

- [ ] **Step 1: Write the failing test**

`src/__tests__/config/loadServerConfig.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadServerConfig } from '@/config/loadServerConfig';

describe('loadServerConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.TAVILY_API_KEY = 'tvly-test';
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns both keys when present', () => {
    expect(loadServerConfig()).toEqual({
      anthropicApiKey: 'sk-ant-test',
      tavilyApiKey: 'tvly-test',
    });
  });

  it('throws naming the missing variable', () => {
    delete process.env.TAVILY_API_KEY;
    expect(() => loadServerConfig()).toThrow(/TAVILY_API_KEY/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/config/loadServerConfig.test.ts`
Expected: FAIL with "Cannot find module '@/config/loadServerConfig'".

- [ ] **Step 3: Write the implementation**

`src/config/loadServerConfig.ts`:

```ts
/** Loads and validates server-only environment variables. Throws a clear
 * error naming any missing variable so startup fails fast. */
type ServerConfig = {
  anthropicApiKey: string;
  tavilyApiKey: string;
};

export function loadServerConfig(): ServerConfig {
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
  const tavilyApiKey = requireEnv('TAVILY_API_KEY');

  return { anthropicApiKey, tavilyApiKey };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/config/loadServerConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config src/__tests__/config
git commit -m "feat: add fail-fast server env config loader"
```

---

