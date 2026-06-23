/** The chat surface: message list plus a labelled input that sends to the
 * research agent and renders streamed answers and tool steps. */
'use client';

import { useState } from 'react';
import { Message } from '@/components/Message/Message';
import { useChatStream } from '@/state/useChatStream';
import styles from './Chat.module.scss';

export function Chat() {
    const { messages, send, isStreaming } = useChatStream();
    const [draft, setDraft] = useState('');

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        send(draft);
        setDraft('');
    }

    return (
        <main className={styles.chat}>
            <header className={styles.masthead}>
                <p className={styles.eyebrow}>Research Desk</p>
                <h1 className={styles.title}>The Reading Room</h1>
                <p className={styles.tagline}>
                    Ask for an overview or a dossier. I gather sources and show my work.
                </p>
            </header>
            <div className={styles.messages}>
                {messages.length === 0 ? (
                    <p className={styles.empty}>
                        Try asking for a high-level overview of the Rape of Nanking, or a dossier on
                        Anthropic.
                    </p>
                ) : (
                    messages.map((message) => <Message key={message.id} message={message} />)
                )}
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
                <label htmlFor="message" className={styles.label}>
                    Message
                </label>
                <input
                    id="message"
                    className={styles.input}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask for an overview or a dossier..."
                />
                <button type="submit" className={styles.send} disabled={isStreaming}>
                    Send
                </button>
            </form>
        </main>
    );
}
