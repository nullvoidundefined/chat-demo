/** Shared shape for an agent tool: an Anthropic schema plus an execute()
 * that returns the tool_result content string. */
import type Anthropic from '@anthropic-ai/sdk';

export type ToolDeps = { tavilyApiKey: string };

export type AgentTool = {
    schema: Anthropic.Tool;
    execute: (input: unknown, deps: ToolDeps) => Promise<string>;
};
