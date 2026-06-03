import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TOKEN_ICONS } from '@/config/ui_config';

const MIME_BY_TYPE: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  if (!/^[A-Za-z0-9_\- .]+$/.test(symbol)) {
    return new Response('bad request', { status: 400 });
  }

  const root = path.join(
    process.cwd(),
    'src',
    'image',
    'tokens',
    TOKEN_ICONS.fileType,
    TOKEN_ICONS.fileSize
  );
  const file = path.join(root, `${symbol}.${TOKEN_ICONS.fileType}`);
  const normalized = path.normalize(file);
  if (!normalized.startsWith(root)) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(normalized);
    const body = new Uint8Array(data);
    return new Response(body, {
      headers: {
        'Content-Type': MIME_BY_TYPE[TOKEN_ICONS.fileType] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
