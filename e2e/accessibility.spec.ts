import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('accessibility', () => {
    test('home page has no serious or critical violations on initial render', async ({ page }) => {
        await page.goto('/');

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        const seriousOrCritical = results.violations.filter((v) =>
            ['serious', 'critical'].includes(v.impact ?? ''),
        );

        expect(
            seriousOrCritical,
            `Found axe violations: ${JSON.stringify(
                seriousOrCritical.map((v) => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                })),
                null,
                2,
            )}`,
        ).toHaveLength(0);
    });
});
