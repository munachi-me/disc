import { getArtist } from '@/lib/music-providers';
import { badRequest, errorResponse, json, parseQuality } from '@/lib/api-helpers';
import { splitEntityId } from '@/lib/utilities/ids';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const id = sp.get('id');
  if (!splitEntityId(id) || id.length > 300) return badRequest('Invalid artist id.');
  try {
    return json(await getArtist(id, { signal: request.signal, quality: parseQuality(sp.get('quality')) }), { maxAge: 300 });
  } catch (err) {
    return errorResponse(err);
  }
}
