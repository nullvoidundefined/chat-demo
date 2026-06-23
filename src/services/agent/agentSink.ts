/** Callback interface the agent loop calls as events occur, decoupling the
 * loop from its consumer (SSE route vs eval collector).
 *
 * TODO(future): migrate to an async generator (the loop yields events and
 * callers `for await` them). Callback form chosen for readability here. */
export type AgentSink = {
    onThinking: (delta: string) => void;
    onText: (delta: string) => void;
    onToolCall: (name: string, input: unknown) => void;
    onToolResult: (name: string, summary: string) => void;
    onDone: (finalText: string) => void;
    onError: (message: string) => void;
};
