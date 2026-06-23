/** Builds the human-readable markdown report and the full JSON dump from a
 * set of eval results. Returns strings; the runner writes them to disk. */
import type { EvalResult } from '@/types/eval';

type NumericAxis = 'factuality' | 'citationUse' | 'completeness' | 'toolEfficiency';

const AXES: NumericAxis[] = [
    'factuality',
    'citationUse',
    'completeness',
    'toolEfficiency',
];

export function writeReport(results: EvalResult[]): {
    markdown: string;
    json: string;
} {
    const passCount = results.filter((r) => r.score.pass).length;
    const averages = AXES.map(
        (axis) => `${axis}: ${average(results, axis).toFixed(1)}`,
    );

    const rows = results.map(
        (r) =>
            `| ${r.item.id} | ${r.score.factuality} | ${r.score.citationUse} | ` +
            `${r.score.completeness} | ${r.score.toolEfficiency} | ` +
            `${r.score.pass ? 'PASS' : 'FAIL'} | ${r.score.rationale} |`,
    );

    const markdown = [
        '# Eval Report',
        '',
        '> Scores are produced by an LLM judge and are directional, not exact.',
        '',
        `**${passCount}/${results.length} passed**`,
        '',
        `Averages: ${averages.join(', ')}`,
        '',
        '| id | fact | cite | compl | toolEff | result | rationale |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        ...rows,
        '',
    ].join('\n');

    return { markdown, json: JSON.stringify(results, null, 2) };
}

function average(results: EvalResult[], axis: NumericAxis): number {
    if (results.length === 0) {
        return 0;
    }
    const total = results.reduce((sum, r) => sum + Number(r.score[axis]), 0);
    return total / results.length;
}
