/** Renders one agent tool-use step: the tool name, its input, and a result
 * summary once available. */
import type { ToolStep as ToolStepData } from '@/types/chat';
import styles from './ToolStep.module.scss';

export function ToolStep({ step }: { step: ToolStepData }) {
    const label = describeInput(step.input);
    const stateClass = step.summary ? styles.done : styles.running;
    return (
        <div className={`${styles.step} ${stateClass}`} aria-label={`Tool: ${step.name}`}>
            <span className={styles.name}>{step.name}</span>
            {label ? <span className={styles.input}>{label}</span> : null}
            <span className={styles.summary}>{step.summary ?? 'searching...'}</span>
        </div>
    );
}

function describeInput(input: unknown): string {
    if (input && typeof input === 'object') {
        const record = input as Record<string, unknown>;
        const value = record.query ?? record.title;
        if (typeof value === 'string') {
            return value;
        }
    }
    return '';
}
