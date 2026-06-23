/** Scores one agent run against its rubric using the judge model, then
 * re-validates the result against ScoreSchema. Uses client.messages.create
 * with a JSON-only system prompt; JSON.parse extracts the score object. */
import { JUDGE_MODEL, MAX_TOKENS } from '@/constants/models';
import { JUDGE_PROMPT } from '@/prompts/judgePrompt';
import { ScoreSchema } from '@/services/eval/scoreSchema';
import type { EvalItem, EvalRunOutput, Score } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

export async function judgeResult(
    item: EvalItem,
    run: EvalRunOutput,
    client: Anthropic,
): Promise<Score> {
    const userContent = [
        `Question: ${item.question}`,
        `Rubric: ${item.rubric}`,
        item.referenceFacts
            ? `Reference facts:\n- ${item.referenceFacts.join('\n- ')}`
            : 'Reference facts: none provided',
        `Tools used: ${run.toolsUsed.join(', ') || 'none'}`,
        `Answer:\n${run.finalAnswer}`,
    ].join('\n\n');

    const response = await client.messages.create({
        model: JUDGE_MODEL,
        max_tokens: MAX_TOKENS,
        system: JUDGE_PROMPT,
        messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (textBlock === undefined || !('text' in textBlock) || typeof textBlock.text !== 'string') {
        throw new Error('Judge returned no text content');
    }

    const raw = textBlock.text
        .trim()
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
    const parsed: unknown = JSON.parse(raw);

    return ScoreSchema.parse(parsed);
}
