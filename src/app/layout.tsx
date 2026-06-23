/** Root layout for the Next.js app. Wraps every page with the global SCSS
 * reset and sets the document title. */
import type { ReactNode } from 'react';
import './globals.scss';

export const metadata = { title: 'Research Chatbot' };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
