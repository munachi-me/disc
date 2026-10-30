import { searchAll } from '@/lib/music-providers';
import { badRequest, clampInt, errorResponse, json, parseProviders, parseQuality } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
const TYPES = ['tracks', 'albums', 'artists'];

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const query = (sp.get('q') || '').trim();
  if (query.length < 1) return badRequest('Enter something to search for.');
  if (query.length > 100) return badRequest('Search text is too long (100 characters max).');
  const types = (sp.get('types') || TYPES.join(',')).split(',').filter((t) => TYPES.includes(t));
  try {
    const result = await searchAll(
      { query, types: types.length ? types : TYPES, providers: parseProviders(sp.get('providers')), limit: clampInt(sp.get('limit'), 1, 30, 12), offset: clampInt(sp.get('offset'), 0, 200, 0) },
      { signal: request.signal, quality: parseQuality(sp.get('quality')) },
    );
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
