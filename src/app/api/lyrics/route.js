import { fetchLyrics } from '@/lib/music-providers/lyrics';
import { badRequest, errorResponse, json } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const title = (sp.get('title') || '').trim().slice(0, 150);
  const artist = (sp.get('artist') || '').trim().slice(0, 150);
  if (!title || !artist) return badRequest('title and artist are required.');
  try {
    return json(await fetchLyrics({ title, artist }, { signal: request.signal }), { maxAge: 3600 });
  } catch (err) {
    return errorResponse(err);
  }
}
