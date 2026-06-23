/** Loads and validates server-only environment variables. Throws a clear
 * error naming any missing variable so startup fails fast. */
type ServerConfig = {
  anthropicApiKey: string;
  tavilyApiKey: string;
};

export function loadServerConfig(): ServerConfig {
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
  const tavilyApiKey = requireEnv('TAVILY_API_KEY');

  return { anthropicApiKey, tavilyApiKey };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
