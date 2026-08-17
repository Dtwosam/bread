import { createHash } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

export const MAX_TOKEN_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TOKEN_IMAGE_FORMATS = new Set(['png', 'jpeg', 'webp']);
const ACCEPTED_DECLARED_MIME = new Set([
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const FORMAT_MIME = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const;

export type TokenImageVariantName = 'card' | 'detail';

export type ProcessedTokenImageVariant = Readonly<{
  name: TokenImageVariantName;
  bytes: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}>;

export type ProcessedTokenImage = Readonly<{
  assetId: string;
  sourceFormat: 'png' | 'jpeg' | 'webp';
  sourceWidth: number;
  sourceHeight: number;
  variants: readonly ProcessedTokenImageVariant[];
}>;

export type TokenMediaStoredVariant = Readonly<{
  name: TokenImageVariantName;
  canonicalUrl: string;
  width: number;
  height: number;
  contentType: 'image/webp';
}>;

export type TokenMediaStore = Readonly<{
  put: (input: Readonly<{
    assetId: string;
    variant: ProcessedTokenImageVariant;
  }>) => Promise<TokenMediaStoredVariant>;
}>;

export type StoredTokenImage = Readonly<{
  assetId: string;
  canonicalUrl: string;
  width: number;
  height: number;
  variants: readonly TokenMediaStoredVariant[];
}>;

export class TokenImageValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TokenImageValidationError';
    this.code = code;
  }
}

function normalizeDeclaredMime(value: string | undefined): string {
  return (value ?? 'application/octet-stream').split(';', 1)[0]!.trim().toLowerCase();
}

function ensureDeclaredMimeMatches(
  declaredMime: string,
  decodedFormat: 'png' | 'jpeg' | 'webp',
): void {
  if (!ACCEPTED_DECLARED_MIME.has(declaredMime)) {
    throw new TokenImageValidationError('UNSUPPORTED_TOKEN_IMAGE_TYPE', 'Token image must be PNG, JPEG, or WebP.');
  }
  if (declaredMime === 'application/octet-stream') return;
  if (declaredMime !== FORMAT_MIME[decodedFormat]) {
    throw new TokenImageValidationError('TOKEN_IMAGE_MIME_MISMATCH', 'Declared token-image MIME does not match decoded bytes.');
  }
}

async function renderVariant(
  input: Buffer,
  name: TokenImageVariantName,
  size: number,
): Promise<ProcessedTokenImageVariant> {
  const rendered = await sharp(input, {
    failOn: 'error',
    limitInputPixels: 40_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    // Sharp strips EXIF/XMP/IPTC metadata by default when it re-encodes output.
    .webp({ quality: 86, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  if (!rendered.info.width || !rendered.info.height) {
    throw new TokenImageValidationError('INVALID_TOKEN_IMAGE', 'Decoded token image has invalid dimensions.');
  }

  return {
    name,
    bytes: rendered.data,
    contentType: 'image/webp',
    width: rendered.info.width,
    height: rendered.info.height,
  };
}

export async function processTokenImage(
  bytes: Buffer,
  declaredMime?: string,
): Promise<ProcessedTokenImage> {
  if (bytes.length === 0) {
    throw new TokenImageValidationError('EMPTY_TOKEN_IMAGE', 'Token image is empty.');
  }
  if (bytes.length > MAX_TOKEN_IMAGE_BYTES) {
    throw new TokenImageValidationError('TOKEN_IMAGE_TOO_LARGE', 'Token image exceeds the 5 MB limit.');
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new TokenImageValidationError('INVALID_TOKEN_IMAGE', 'Token image bytes could not be decoded.');
  }

  const format = metadata.format;
  if (!format || !ACCEPTED_TOKEN_IMAGE_FORMATS.has(format)) {
    throw new TokenImageValidationError('UNSUPPORTED_TOKEN_IMAGE_TYPE', 'Token image must decode as PNG, JPEG, or WebP.');
  }
  if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
    throw new TokenImageValidationError('UNSUPPORTED_TOKEN_IMAGE_TYPE', 'Token image must decode as PNG, JPEG, or WebP.');
  }
  if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
    throw new TokenImageValidationError('INVALID_TOKEN_IMAGE', 'Decoded token image has invalid dimensions.');
  }

  ensureDeclaredMimeMatches(normalizeDeclaredMime(declaredMime), format);

  const variants = await Promise.all([
    renderVariant(bytes, 'card', 64),
    renderVariant(bytes, 'detail', 256),
  ]);
  const canonicalBytes = variants.find((variant) => variant.name === 'detail')!.bytes;
  const assetId = createHash('sha256').update(canonicalBytes).digest('hex');

  return {
    assetId,
    sourceFormat: format,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    variants,
  };
}

function canonicalHttpsBaseUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Token media public base URL must be credential-free HTTPS.');
  }
  if (!parsed.pathname.endsWith('/')) parsed.pathname = `${parsed.pathname}/`;
  return parsed;
}

export class FileSystemTokenMediaStore implements TokenMediaStore {
  private readonly baseUrl: URL;

  constructor(
    private readonly rootDirectory: string,
    publicBaseUrl: string,
  ) {
    if (!rootDirectory.trim()) throw new Error('Token media storage directory is required.');
    this.baseUrl = canonicalHttpsBaseUrl(publicBaseUrl);
  }

  async put(input: Readonly<{
    assetId: string;
    variant: ProcessedTokenImageVariant;
  }>): Promise<TokenMediaStoredVariant> {
    if (!/^[0-9a-f]{64}$/.test(input.assetId)) throw new Error('Invalid token media asset identity.');
    const relativePath = `token-images/${input.assetId}/${input.variant.name}.webp`;
    const target = join(this.rootDirectory, relativePath);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, input.variant.bytes, { flag: 'w' });
    await rename(temporary, target);
    const canonicalUrl = new URL(relativePath, this.baseUrl).toString();
    if (!canonicalUrl.startsWith('https://')) throw new Error('Canonical token media reference must be HTTPS.');
    return {
      name: input.variant.name,
      canonicalUrl,
      width: input.variant.width,
      height: input.variant.height,
      contentType: input.variant.contentType,
    };
  }
}

export async function storeProcessedTokenImage(
  store: TokenMediaStore,
  processed: ProcessedTokenImage,
): Promise<StoredTokenImage> {
  const variants = await Promise.all(
    processed.variants.map((variant) => store.put({ assetId: processed.assetId, variant })),
  );
  for (const variant of variants) {
    const parsed = new URL(variant.canonicalUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error('Token media store returned a non-canonical media reference.');
    }
  }
  const detail = variants.find((variant) => variant.name === 'detail');
  if (!detail) throw new Error('Token media store did not return the canonical detail variant.');
  return {
    assetId: processed.assetId,
    canonicalUrl: detail.canonicalUrl,
    width: detail.width,
    height: detail.height,
    variants,
  };
}
