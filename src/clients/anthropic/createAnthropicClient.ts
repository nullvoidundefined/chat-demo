/** Constructs an Anthropic SDK client from an explicit API key. */
import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
}
