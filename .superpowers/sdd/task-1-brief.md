### Task 1: Project scaffold, configs, constants, types

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `prettier.config.mjs`, `eslint.config.mjs`, `.env.example`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.scss`
- Create: `src/constants/models.ts`, `src/constants/agent.ts`, `src/types/chat.ts`, `src/types/eval.ts`

**Interfaces:**
- Produces: `AGENT_MODEL`, `JUDGE_MODEL` (string), `MAX_AGENT_ITERATIONS`, `EFFORT` (`'high'`), `MAX_ARTICLE_CHARS` (number); types `ChatRole`, `ChatMessage`, `ToolStep`, `SseEvent`, `EvalItem`, `EvalResult`, `Score`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chat-demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "format": "prettier --write '**/*.{ts,tsx,mjs,scss,md}'",
    "test": "vitest run",
    "test:watch": "vitest",
    "eval": "tsx evals/runEval.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.7.0",
    "eslint": "^9.0.0",
    "jsdom": "^25.0.0",
    "prettier": "^3.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `prettier.config.mjs` (shared CLAUDE.md formatting)**

Use Doppelscript's web config as the structural base, but defer the formatting
values to the shared CLAUDE.md (4-space indent, 100 print width, trailing
commas). Do not carry over Doppelscript's 2-space/80-width values. The
`@trivago` import-sort plugin is dropped to avoid an extra dependency; ESLint's
`unused-imports` plugin still handles unused imports.

`prettier.config.mjs`:

```js
// Prettier config. Formatting follows the shared CLAUDE.md: 4-space indent,
// 100 print width, trailing commas. Shared CLAUDE.md overrides project config.
export default {
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 100,
  semi: true,
  singleQuote: true,
  tabWidth: 4,
  trailingComma: 'all',
  useTabs: false,
};
```

- [ ] **Step 3: Copy `eslint.config.mjs` from Doppelscript web and trim**

Run: `cp /Users/iangreenough/Desktop/code/personal/production/doppelscript/apps/client/web/eslint.config.mjs ./eslint.config.mjs`
Then remove the project-specific `no-restricted-syntax` block that forces `@/services/api` (this repo has its own `api/` shape). Keep `next/core-web-vitals`, `next/typescript`, security, jsx-a11y, and the `react/forbid-dom-props` inline-style rule.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next.config.ts` and `vitest.config.ts`**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 6: Create `src/__tests__/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Create constants**

`src/constants/models.ts`:

```ts
/** Model identifiers and Anthropic call tuning. Swap AGENT_MODEL to
 * 'claude-sonnet-4-6' to reduce eval cost. */
export const AGENT_MODEL = 'claude-opus-4-8';
export const JUDGE_MODEL = 'claude-opus-4-8';
export const EFFORT = 'high' as const;
export const MAX_TOKENS = 8000;
```

`src/constants/agent.ts`:

```ts
/** Agent-loop and tool-output limits. */
export const MAX_AGENT_ITERATIONS = 8;
export const MAX_ARTICLE_CHARS = 6000;
export const DEFAULT_SEARCH_LIMIT = 5;
```

- [ ] **Step 8: Create types**

`src/types/chat.ts`:

```ts
/** Shared chat and streaming types used by the agent, route, and UI. */
export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ToolStep = {
  name: string;
  input: unknown;
  summary: string | null;
};

export type SseEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
```

`src/types/eval.ts`:

```ts
/** Types for the offline eval dataset, run output, and judge scores. */
export type EvalItem = {
  id: string;
  question: string;
  rubric: string;
  referenceFacts?: string[];
};

export type EvalRunOutput = {
  finalAnswer: string;
  toolsUsed: string[];
  iterationCount: number;
};

export type Score = {
  factuality: number;
  citationUse: number;
  completeness: number;
  toolEfficiency: number;
  rationale: string;
  pass: boolean;
};

export type EvalResult = {
  item: EvalItem;
  run: EvalRunOutput;
  score: Score;
};
```

- [ ] **Step 9: Create minimal app shell**

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import './globals.scss';

export const metadata = { title: 'Research Chatbot' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Chat coming soon</main>;
}
```

`src/app/globals.scss`:

```scss
:root {
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 10: Create `.env.example` and `next-env.d.ts` placeholder**

`.env.example`:

```
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
```

Run: `npm install`
Expected: dependencies install; `npx next telemetry disable` optional. `next-env.d.ts` is generated by Next on first `dev`/`build`.

- [ ] **Step 11: Verify typecheck and commit**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

```bash
git add -A
git commit -m "chore: scaffold Next.js app, configs, constants, and types"
```

---

