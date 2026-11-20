import 'server-only';

// First non-empty value among the given environment variable names.
export function readEnv(names: string | readonly string[]): string | undefined {
  for (const name of typeof names === 'string' ? [names] : names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}
