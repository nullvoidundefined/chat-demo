/** The tool-use loop. Streams model output to the sink, executes any tool
 * calls, and repeats until the model ends its turn, refuses, or the
 * iteration cap is hit. Decoupled from its consumer via AgentSink.
 *
 * TODO(future): yield events from an async generator instead of pushing to a
 * sink (see agentSink.ts). */
import { EFFORT, MAX_TOKENS, AGENT_MODEL } from '@/constants/models';
import { MAX_AGENT_ITERATIONS } from '@/constants/agent';
import { RESEARCH_SYSTEM_PROMPT } from '@/prompts/researchSystemPrompt';
import { executeToolCall } from '@/services/agent/executeToolCall';
import { toolSchemas } from '@/services/agent/toolRegistry';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type Anthropic from '@anthropic-ai/sdk';

type RunOptions = {
    client: Anthropic;
    sink: AgentSink;
    deps: ToolDeps;
};

export async function runResearchAgent(
    messages: Anthropic.MessageParam[],
    { client, sink, deps }: RunOptions,
): Promise<void> {
    const working = [...messages];

    for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
        const stream = client.messages.stream({
            model: AGENT_MODEL,
            max_tokens: MAX_TOKENS,
            system: RESEARCH_SYSTEM_PROMPT,
            tools: toolSchemas,
            messages: working,
            thinking: { type: 'adaptive', display: 'summarized' },
            output_config: { effort: EFFORT },
        } as unknown as Anthropic.MessageStreamParams);

        for await (const event of stream) {
            streamDeltaToSink(event, sink);
        }
        const final = await stream.finalMessage();
        working.push({ role: 'assistant', content: final.content });

        if (final.stop_reason === 'refusal') {
            sink.onError('The model declined to answer this request.');
            return;
        }
        if (final.stop_reason !== 'tool_use') {
            sink.onDone(textOf(final.content));
            return;
        }

        const toolResults = await runToolCalls(final.content, sink, deps);
        working.push({ role: 'user', content: toolResults });
    }

    sink.onError('Reached the maximum number of agent iterations.');
}

function streamDeltaToSink(event: unknown, sink: AgentSink): void {
    const typed = event as {
        type?: string;
        delta?: { type?: string; text?: string; thinking?: string };
    };
    if (typed.type !== 'content_block_delta' || !typed.delta) {
        return;
    }
    if (typed.delta.type === 'text_delta' && typed.delta.text) {
        sink.onText(typed.delta.text);
    } else if (typed.delta.type === 'thinking_delta' && typed.delta.thinking) {
        sink.onThinking(typed.delta.thinking);
    }
}

async function runToolCalls(
    content: Anthropic.ContentBlock[],
    sink: AgentSink,
    deps: ToolDeps,
): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') {
            continue;
        }
        sink.onToolCall(block.name, block.input);
        const { content: resultContent, isError } = await executeToolCall(
            block.name,
            block.input,
            deps,
        );
        sink.onToolResult(block.name, summarize(resultContent));
        results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultContent,
            is_error: isError,
        });
    }
    return results;
}

function textOf(content: Anthropic.ContentBlock[]): string {
    return content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
}

function summarize(content: string): string {
    try {
        const parsed: unknown = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return `${parsed.length} result(s)`;
        }
        if (
            parsed &&
            typeof parsed === 'object' &&
            'title' in parsed &&
            typeof (parsed as { title: unknown }).title === 'string'
        ) {
            return `read "${(parsed as { title: string }).title}"`;
        }
    } catch {
        // not JSON; fall through
    }
    return content.length > 80 ? `${content.slice(0, 80)}...` : content;
}
