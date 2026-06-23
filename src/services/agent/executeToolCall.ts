/** Executes one tool by name, converting any failure into a structured
 * error result so the agent loop can feed it back to the model. */
import { toolRegistry } from '@/services/agent/toolRegistry';
import type { ToolDeps } from '@/tools/agentTool';

type ToolCallResult = { content: string; isError: boolean };

export async function executeToolCall(
    name: string,
    input: unknown,
    deps: ToolDeps,
): Promise<ToolCallResult> {
    const tool = toolRegistry[name];
    if (!tool) {
        return { content: `Unknown tool: ${name}`, isError: true };
    }
    try {
        const content = await tool.execute(input, deps);
        return { content, isError: false };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Tool error: ${message}`, isError: true };
    }
}
