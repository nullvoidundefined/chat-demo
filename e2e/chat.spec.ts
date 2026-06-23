import { expect, test } from '@playwright/test';

const CANNED_SSE_BODY = [
    'data: {"type":"tool_call","name":"search_wikipedia","input":{"query":"Anthropic"}}\n\n',
    'data: {"type":"tool_result","name":"search_wikipedia","summary":"1 result(s)"}\n\n',
    'data: {"type":"thinking","delta":"Considering the evidence..."}\n\n',
    'data: {"type":"text","delta":"Anthropic "}\n\n',
    'data: {"type":"text","delta":"is an "}\n\n',
    'data: {"type":"text","delta":"AI safety company."}\n\n',
    'data: {"type":"done"}\n\n',
].join('');

test.describe('chat interface', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/chat', async (route) => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive',
                },
                body: CANNED_SSE_BODY,
            });
        });
    });

    test('shows masthead and empty state on initial load', async ({ page }) => {
        await page.goto('/');
        await expect(
            page.getByRole('heading', { name: 'The Reading Room', level: 1 }),
        ).toBeVisible();
        await expect(page.getByText(/Try asking for a high-level overview/)).toBeVisible();
    });

    test('sends a message and renders streamed tool steps and answer', async ({ page }) => {
        await page.goto('/');

        const emptyState = page.getByText(/Try asking for a high-level overview/);
        await expect(emptyState).toBeVisible();

        await page.getByLabel('Message').fill('Tell me about Anthropic');
        await page.getByRole('button', { name: /send/i }).click();

        await expect(page.getByText('Tell me about Anthropic')).toBeVisible();

        await expect(page.locator('[aria-label="Tool: search_wikipedia"]')).toBeVisible();

        await expect(page.getByText('Thinking')).toBeVisible();

        await expect(page.getByText('Anthropic is an AI safety company.')).toBeVisible();

        await expect(emptyState).not.toBeVisible();
    });
});
