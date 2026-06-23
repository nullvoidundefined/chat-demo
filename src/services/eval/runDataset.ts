/** Runs the eval dataset sequentially, isolating per-item failures so one
 * bad judge response does not abort the entire dataset run. */
import { collectAgentRun } from '@/services/eval/collectAgentRun';
import { judgeResult } from '@/services/eval/judgeResult';
import type { ToolDeps } from '@/tools/agentTool';
import type { EvalItem, EvalResult } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

type RunDatasetOptions = {
    client: Anthropic;
    deps: ToolDeps;
};

type RunDatasetOutput = {
    results: EvalResult[];
    failures: { id: string; error: string }[];
};

export async function runDataset(
    items: EvalItem[],
    opts: RunDatasetOptions,
): Promise<RunDatasetOutput> {
    const results: EvalResult[] = [];
    const failures: { id: string; error: string }[] = [];

    for (const item of items) {
        try {
            const run = await collectAgentRun(item.question, opts);
            const score = await judgeResult(item, run, opts.client);
            results.push({ item, run, score });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            failures.push({ id: item.id, error: errorMessage });
        }
    }

    return { results, failures };
}
