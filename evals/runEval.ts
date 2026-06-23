/** Offline eval entry point: loads the dataset, runs the agent per question,
 * judges each result, and writes report.md and report.json. Per-item failures
 * are isolated so one bad judge response does not abort the entire run. */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createAnthropicClient } from '../src/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '../src/config/loadServerConfig';
import { runDataset } from '../src/services/eval/runDataset';
import { writeReport } from '../src/services/eval/writeReport';
import type { EvalItem } from '../src/types/eval';

async function main(): Promise<void> {
    const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
    const client = createAnthropicClient(anthropicApiKey);
    const deps = { tavilyApiKey };
    const items = loadDataset();

    const { results, failures } = await runDataset(items, { client, deps });

    if (failures.length > 0) {
        process.stderr.write(`${failures.length} item(s) failed:\n`);
        for (const failure of failures) {
            process.stderr.write(`  ${failure.id}: ${failure.error}\n`);
        }
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
