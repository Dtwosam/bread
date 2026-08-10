const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_EXTERNAL_PROTOCOLS = ['javascript:', 'data:'] as const;

export function normalizeExternalMetadataUrl(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a complete http or https URL.`);
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    const explicitlyBlocked = BLOCKED_EXTERNAL_PROTOCOLS.includes(
      parsed.protocol.toLowerCase() as (typeof BLOCKED_EXTERNAL_PROTOCOLS)[number],
    );
    throw new Error(
      explicitlyBlocked
        ? `${label} uses a blocked URL scheme.`
        : `${label} must use http or https.`,
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`${label} must not contain embedded credentials.`);
  }

  return parsed.href;
}
