/** Renders a single chat message: optional thinking disclosure, tool steps
 * (for assistant turns), followed by the message text. */
import { ToolStep } from '@/components/ToolStep/ToolStep';
import type { DisplayMessage } from '@/state/useChatStream';
import styles from './Message.module.scss';

export function Message({ message }: { message: DisplayMessage }) {
    return (
        <div className={styles[message.role]}>
            {message.role === 'assistant' && message.thinking ? (
                <details className={styles.thinking}>
                    <summary className={styles.thinkingSummary}>Thinking</summary>
                    <p className={styles.thinkingText}>{message.thinking}</p>
                </details>
            ) : null}
            {message.toolSteps.length > 0 ? (
                <div className={styles.steps}>
                    {message.toolSteps.map((step) => (
                        <ToolStep key={step.id} step={step} />
                    ))}
                </div>
            ) : null}
            {message.content ? <p className={styles.text}>{message.content}</p> : null}
        </div>
    );
}
