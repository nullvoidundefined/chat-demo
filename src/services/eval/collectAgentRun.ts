/** Runs the research agent for one question with a collecting sink, returning
 * the final answer and the tool trajectory for the judge. */
import { runResearchAgent } from '@/services/agent/runResearchAgent';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type { EvalRunOutput } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

type CollectOptions = { client: Anthropic; deps: ToolDeps };

export async function collectAgentRun(
    question: string,
    { client, deps }: CollectOptions,
): Promise<EvalRunOutput> {
    const toolsUsed: string[] = [];
    let finalAnswer = '';
    let iterationCount = 0;

    const sink: AgentSink = {
        onThinking: () => {},
        onText: (delta) => {
            finalAnswer += delta;
        },
        onToolCall: (name) => {
            toolsUsed.push(name);
            iterationCount += 1;
        },
        onToolResult: () => {},
        onDone: (text) => {
            finalAnswer = text;
        },
        onError: (message) => {
            finalAnswer = finalAnswer || `[error: ${message}]`;
        },
    };

    await runResearchAgent([{ role: 'user', content: question }], {
        client,
        sink,
        deps,
    });

    return { finalAnswer, toolsUsed, iterationCount: Math.max(iterationCount, 1) };
}
