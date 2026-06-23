### Task 8: Browser stream client + `useChatStream` hook

**Files:**
- Create: `src/api/streamChat.ts`, `src/state/useChatStream.ts`
- Test: `src/__tests__/state/useChatStream.test.tsx`

**Interfaces:**
- Produces:
  - `streamChat(messages: ChatMessage[], onEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void>` — POSTs to `/api/chat` and parses SSE frames.
  - `useChatStream(): { messages: DisplayMessage[]; send: (text: string) => void; isStreaming: boolean }` where `DisplayMessage = { role: ChatRole; content: string; toolSteps: ToolStep[] }`.

- [ ] **Step 1: Implement `streamChat` (transport; covered indirectly by the hook test)**

`src/api/streamChat.ts`:

```ts
/** Browser fetch wrapper around POST /api/chat. Parses the SSE byte stream
 * and invokes onEvent for each decoded SseEvent. */
import type { ChatMessage, SseEvent } from '@/types/chat';

export async function streamChat(
  messages: ChatMessage[],
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      onEvent(JSON.parse(line.slice('data:'.length).trim()) as SseEvent);
    }
  }
}
```

- [ ] **Step 2: Write the failing hook test**

The test mocks `streamChat` to push a scripted event sequence and asserts the hook builds the right messages and tool steps.

`src/__tests__/state/useChatStream.test.tsx`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
  streamChat: vi.fn(async (_messages, onEvent) => {
    onEvent({ type: 'tool_call', name: 'search_wikipedia', input: { query: 'x' } });
    onEvent({ type: 'tool_result', name: 'search_wikipedia', summary: '3 result(s)' });
    onEvent({ type: 'text', delta: 'Hello ' });
    onEvent({ type: 'text', delta: 'world.' });
    onEvent({ type: 'done' });
  }),
}));

import { useChatStream } from '@/state/useChatStream';

describe('useChatStream', () => {
  afterEach(() => vi.clearAllMocks());

  it('accumulates the user message, tool steps, and streamed answer', async () => {
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.send('q'));

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const [userMessage, assistantMessage] = result.current.messages;
    expect(userMessage).toMatchObject({ role: 'user', content: 'q' });
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toBe('Hello world.');
    expect(assistantMessage.toolSteps).toEqual([
      { name: 'search_wikipedia', input: { query: 'x' }, summary: '3 result(s)' },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/state/useChatStream.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `useChatStream`**

`src/state/useChatStream.ts`:

```ts
/** React hook that drives a chat conversation: sends history to /api/chat via
 * streamChat and accumulates streamed text and tool steps per assistant turn. */
'use client';

import { useCallback, useState } from 'react';
import { streamChat } from '@/api/streamChat';
import type { ChatMessage, ChatRole, ToolStep } from '@/types/chat';

export type DisplayMessage = {
  role: ChatRole;
  content: string;
  toolSteps: ToolStep[];
};

type UseChatStream = {
  messages: DisplayMessage[];
  send: (text: string) => void;
  isStreaming: boolean;
};

export function useChatStream(): UseChatStream {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) {
        return;
      }
      const userMessage: DisplayMessage = {
        role: 'user',
        content: text,
        toolSteps: [],
      };
      const history: ChatMessage[] = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: 'assistant', content: '', toolSteps: [] },
      ]);
      setIsStreaming(true);

      void runStream(history, setMessages).finally(() =>
        setIsStreaming(false),
      );
    },
    [isStreaming, messages],
  );

  return { messages, send, isStreaming };
}

async function runStream(
  history: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>,
): Promise<void> {
  await streamChat(history, (event) => {
    setMessages((prev) => applyEvent(prev, event));
  });
}

function applyEvent(
  messages: DisplayMessage[],
  event: import('@/types/chat').SseEvent,
): DisplayMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== 'assistant') {
    return next;
  }
  if (event.type === 'text') {
    next[next.length - 1] = { ...last, content: last.content + event.delta };
  } else if (event.type === 'tool_call') {
    next[next.length - 1] = {
      ...last,
      toolSteps: [
        ...last.toolSteps,
        { name: event.name, input: event.input, summary: null },
      ],
    };
  } else if (event.type === 'tool_result') {
    next[next.length - 1] = {
      ...last,
      toolSteps: last.toolSteps.map((step, index) =>
        index === last.toolSteps.length - 1
          ? { ...step, summary: event.summary }
          : step,
      ),
    };
  } else if (event.type === 'error') {
    next[next.length - 1] = {
      ...last,
      content: last.content + `\n[error: ${event.message}]`,
    };
  }
  return next;
}
```

- [ ] **Step 5: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/state/useChatStream.test.tsx`
Expected: PASS (1 test).

```bash
git add src/api src/state src/__tests__/state
git commit -m "feat: add browser SSE client and useChatStream hook"
```

---

