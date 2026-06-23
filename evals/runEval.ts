/** Offline eval entry point: loads the dataset, runs the agent per question,
 * judges each result, and writes report.md and report.json. */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createAnthropicClient } from '../src/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '../src/config/loadServerConfig';
import { collectAgentRun } from '../src/services/eval/collectAgentRun';
import { judgeResult } from '../src/services/eval/judgeResult';
import { writeReport } from '../src/services/eval/writeReport';
import type { EvalItem, EvalResult } from '../src/types/eval';

async function main(): Promise<void> {
    const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
    const client = createAnthropicClient(anthropicApiKey);
    const deps = { tavilyApiKey };
    const items = loadDataset();

    const results: EvalResult[] = [];
    for (const item of items) {
        process.stdout.write(`Running ${item.id}...\n`);
        const run = await collectAgentRun(item.question, { client, deps });
        const score = await judgeResult(item, run, client);
        results.push({ item, run, score });
    }

    const { markdown, json } = writeReport(results);
    const outDir = resolve(import.meta.dirname, 'reports');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'report.md'), markdown);
    writeFileSync(resolve(outDir, 'report.json'), json);
    process.stdout.write(`Wrote ${results.length} results to ${outDir}\n`);
}

function loadDataset(): EvalItem[] {
    const path = resolve(import.meta.dirname, 'dataset.jsonl');
    return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as EvalItem);
}

void main();
