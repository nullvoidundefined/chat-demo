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
            <div className={styles.messages}>
                {messages.map((message, index) => (
                    <Message key={index} message={message} />
                ))}
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
                <button type="submit" disabled={isStreaming}>
                    Send
                </button>
            </form>
        </main>
    );
}
