import { describeProviders } from '@/lib/music-providers';
import { json } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** Reports which providers are configured. Never returns credentials. */
export async function GET() {
  return json({ providers: describeProviders(), lyrics: { configured: Boolean(process.env.MUSIXMATCH_API_KEY) } }, { maxAge: 30 });
}
