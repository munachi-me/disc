import { browseAll } from '@/lib/music-providers';
import { browseParams } from '@/data/taxonomy';
import { badRequest, clampInt, errorResponse, json, parseProviders, parseQuality } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
const ORDERS = ['popularity_week', 'popularity_month', 'releasedate_desc', 'relevance'];

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const recipe = browseParams(sp.get('kind'), sp.get('value'));
  if (!recipe) return badRequest('Unknown discovery category.');
  const order = ORDERS.includes(sp.get('order')) ? sp.get('order') : undefined;
  try {
    const result = await browseAll(
      { params: recipe.params, providers: parseProviders(sp.get('providers')), limit: clampInt(sp.get('limit'), 1, 40, 20), offset: clampInt(sp.get('offset'), 0, 150, 0), order },
      { signal: request.signal, quality: parseQuality(sp.get('quality')) },
    );
    return json({ label: recipe.label, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
