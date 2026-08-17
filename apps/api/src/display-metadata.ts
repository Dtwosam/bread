export type SanitizedIndexedDisplayMetadata = Readonly<{
  image?: string;
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
}>;

const CANONICAL_TOKEN_IMAGE_PATH = /^token-images\/[0-9a-f]{64}\/(?:card|detail)\.webp$/;

function normalizedHttps(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return undefined;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function trustedMediaReference(value: unknown, trustedMediaBaseUrl: string | undefined): string | undefined {
  if (!trustedMediaBaseUrl) return undefined;
  const candidate = normalizedHttps(value);
  if (!candidate) return undefined;
  try {
    const base = new URL(trustedMediaBaseUrl);
    if (base.protocol !== 'https:' || base.username || base.password) return undefined;
    if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;
    const parsed = new URL(candidate);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname)) return undefined;
    const relativePath = parsed.pathname.slice(base.pathname.length);
    if (!CANONICAL_TOKEN_IMAGE_PATH.test(relativePath)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function plainText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function sanitizeIndexedDisplayMetadata(
  raw: unknown,
  trustedMediaBaseUrl?: string,
): SanitizedIndexedDisplayMetadata {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const image = trustedMediaReference(source.image, trustedMediaBaseUrl);
  const description = plainText(source.description);
  const website = normalizedHttps(source.website);
  const x = normalizedHttps(source.x);
  const telegram = normalizedHttps(source.telegram);
  return {
    ...(image ? { image } : {}),
    ...(description ? { description } : {}),
    ...(website ? { website } : {}),
    ...(x ? { x } : {}),
    ...(telegram ? { telegram } : {}),
  };
}
