import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadServerConfig } from '@/config/loadServerConfig';

describe('loadServerConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.TAVILY_API_KEY = 'tvly-test';
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns both keys when present', () => {
    expect(loadServerConfig()).toEqual({
      anthropicApiKey: 'sk-ant-test',
      tavilyApiKey: 'tvly-test',
    });
  });

  it('throws naming the missing variable', () => {
    delete process.env.TAVILY_API_KEY;
    expect(() => loadServerConfig()).toThrow(/TAVILY_API_KEY/);
  });
});
