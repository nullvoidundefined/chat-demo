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
