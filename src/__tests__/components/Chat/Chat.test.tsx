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
        await waitFor(() => expect(screen.getByText('Hello from the agent.')).toBeInTheDocument());
    });
});
