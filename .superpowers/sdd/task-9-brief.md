### Task 9: Chat UI components and page

**Files:**
- Create: `src/components/ToolStep/ToolStep.tsx`, `src/components/ToolStep/ToolStep.module.scss`
- Create: `src/components/Message/Message.tsx`, `src/components/Message/Message.module.scss`
- Create: `src/components/Chat/Chat.tsx`, `src/components/Chat/Chat.module.scss`
- Modify: `src/app/page.tsx`
- Test: `src/__tests__/components/Chat/Chat.test.tsx`

**Interfaces:**
- Consumes: `useChatStream`, `DisplayMessage`, `ToolStep` type.
- Produces: `<Chat/>`, `<Message message={DisplayMessage}/>`, `<ToolStep step={ToolStep}/>`.

- [ ] **Step 1: Implement `ToolStep` and `Message` (presentational)**

`src/components/ToolStep/ToolStep.tsx`:

```tsx
/** Renders one agent tool-use step: the tool name, its input, and a result
 * summary once available. */
import type { ToolStep as ToolStepData } from '@/types/chat';
import styles from './ToolStep.module.scss';

export function ToolStep({ step }: { step: ToolStepData }) {
  const label = describeInput(step.input);
  return (
    <div className={styles.step}>
      <span className={styles.name}>{step.name}</span>
      {label ? <span className={styles.input}>{label}</span> : null}
      <span className={styles.summary}>
        {step.summary ?? 'running...'}
      </span>
    </div>
  );
}

function describeInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const value = record.query ?? record.title;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}
```

`src/components/ToolStep/ToolStep.module.scss`:

```scss
.step {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-left: 2px solid #888;
  margin: 0.25rem 0;
}

.name {
  font-weight: 600;
}

.input {
  font-style: italic;
}

.summary {
  color: #666;
  margin-left: auto;
}
```

`src/components/Message/Message.tsx`:

```tsx
/** Renders a single chat message: tool steps (for assistant turns) followed
 * by the message text. */
import { ToolStep } from '@/components/ToolStep/ToolStep';
import type { DisplayMessage } from '@/state/useChatStream';
import styles from './Message.module.scss';

export function Message({ message }: { message: DisplayMessage }) {
  return (
    <div className={styles[message.role]}>
      {message.toolSteps.length > 0 ? (
        <div className={styles.steps}>
          {message.toolSteps.map((step, index) => (
            <ToolStep key={index} step={step} />
          ))}
        </div>
      ) : null}
      <p className={styles.text}>{message.content}</p>
    </div>
  );
}
```

`src/components/Message/Message.module.scss`:

```scss
.user,
.assistant {
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  border-radius: 0.5rem;
}

.user {
  background: #e8eef6;
}

.assistant {
  background: #f4f1ea;
}

.text {
  margin: 0;
  white-space: pre-wrap;
}

.steps {
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 2: Write the failing `Chat` test**

`src/__tests__/components/Chat/Chat.test.tsx`:

```ts
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
  streamChat: vi.fn(async (_messages, onEvent) => {
    onEvent({ type: 'text', delta: 'Hello from the agent.' });
    onEvent({ type: 'done' });
  }),
}));

import { Chat } from '@/components/Chat/Chat';

describe('Chat', () => {
  afterEach(() => vi.clearAllMocks());

  it('sends input and renders the streamed answer', async () => {
    render(<Chat />);
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Tell me about Anthropic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('Tell me about Anthropic')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Hello from the agent.')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/Chat/Chat.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `Chat`**

`src/components/Chat/Chat.tsx`:

```tsx
/** The chat surface: message list plus a labelled input that sends to the
 * research agent and renders streamed answers and tool steps. */
'use client';

import { useState } from 'react';
import { Message } from '@/components/Message/Message';
import { useChatStream } from '@/state/useChatStream';
import styles from './Chat.module.scss';

export function Chat() {
  const { messages, send, isStreaming } = useChatStream();
  const [draft, setDraft] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    send(draft);
    setDraft('');
  }

  return (
    <main className={styles.chat}>
      <div className={styles.messages}>
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="message" className={styles.label}>
          Message
        </label>
        <input
          id="message"
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask for an overview or a dossier..."
        />
        <button type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </main>
  );
}
```

`src/components/Chat/Chat.module.scss`:

```scss
.chat {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.messages {
  flex: 1;
  overflow-y: auto;
}

.form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-top: 1rem;
}

.label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.input {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
}
```

- [ ] **Step 5: Wire the page and run the test**

`src/app/page.tsx`:

```tsx
import { Chat } from '@/components/Chat/Chat';

export default function HomePage() {
  return <Chat />;
}
```

Run: `npx vitest run src/__tests__/components/Chat/Chat.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/page.tsx src/__tests__/components
git commit -m "feat: add chat UI components and wire the home page"
```

---

