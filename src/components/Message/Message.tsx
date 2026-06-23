/** Renders a single chat message: tool steps (for assistant turns) followed
 * by the message text. */
import { ToolStep } from '@/components/ToolStep/ToolStep';
import type { DisplayMessage } from '@/state/useChatStream';
import styles from './Message.module.scss';

export function Message({ message }: { message: DisplayMessage }) {
    return (
        <div className={styles[message.role]}>
            {message.toolSteps.length > 0 ? (
                <div className={styles.steps}>
                    {message.toolSteps.map((step, index) => (
                        <ToolStep key={index} step={step} />
                    ))}
                </div>
            ) : null}
            {message.content ? <p className={styles.text}>{message.content}</p> : null}
        </div>
    );
}
