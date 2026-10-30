'use client';
import { useRouter } from 'next/navigation';
import { Disc3, ExternalLink, Heart, ListEnd, ListPlus, ListStart, Play, Trash2, User } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Artwork } from './Artwork';
import { PlaybackBadge } from './Badges';
import { useDialogs } from '@/lib/dialogStore';
import { usePlayer } from '@/lib/player/playerStore';
import { useLibrary } from '@/lib/storage/libraryStore';
import { albumHref, artistHref } from '@/lib/links';
import { toast } from '@/lib/toastStore';

function Item({ icon: Icon, children, onClick, href, danger }) {
  const cls = `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-card ${danger ? 'text-red-300' : ''}`;
  const inner = (
    <>
      <Icon size={18} className={danger ? '' : 'text-muted'} aria-hidden="true" />
      {children}
    </>
  );
  return href ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

export function TrackMenu() {
  const ctx = useDialogs((s) => s.trackMenu);
  const close = useDialogs((s) => s.closeTrackMenu);
  const openAdd = useDialogs((s) => s.openAddToPlaylist);
  const router = useRouter();
  const { playNow, playNext, addToQueue } = usePlayer.getState();
  const fav = useLibrary((s) => (ctx ? Boolean(s.favoriteTracks[ctx.track.id]) : false));
  const toggleFav = useLibrary((s) => s.toggleFavorite);
  const removeFromPlaylist = useLibrary((s) => s.removeTrackFromPlaylist);
  const removeLocal = useLibrary((s) => s.removeLocalTrack);
  const track = ctx?.track;

  const run = (fn) => () => {
    fn();
    close();
  };
  const warnIfUnplayable = () => (track.isPlayable ? true : (toast(track.playabilityReason || 'This track is not playable.', { tone: 'error' }), false));

  return (
    <Dialog open={Boolean(ctx)} onClose={close} title={track ? track.title : 'Track'} sheet>
      {track && (
        <>
          <div className="mb-3 flex items-center gap-3 border-b border-line pb-4">
            <Artwork src={track.artworkUrl} alt="" seed={track.id} className="h-14 w-14" rounded="rounded-md" size={18} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{track.title}</p>
              <p className="truncate text-xs text-muted">{track.artists.map((a) => a.name).join(', ')}</p>
              <PlaybackBadge track={track} />
            </div>
          </div>
          {!track.isPlayable && track.playabilityReason && <p className="mb-2 rounded-lg bg-card px-3 py-2 text-xs text-muted">{track.playabilityReason}</p>}
          <Item icon={Play} onClick={run(() => warnIfUnplayable() && playNow(track))}>
            Play now
          </Item>
          <Item icon={ListStart} onClick={run(() => warnIfUnplayable() && (playNext(track) , toast('Will play next')))}>
            Play next
          </Item>
          <Item icon={ListEnd} onClick={run(() => warnIfUnplayable() && (addToQueue(track), toast('Added to queue')))}>
            Add to queue
          </Item>
          <Item icon={ListPlus} onClick={() => openAdd([track])}>
            Add to playlist…
          </Item>
          <Item icon={Heart} onClick={run(() => toast(toggleFav(track) ? 'Added to favorites' : 'Removed from favorites'))}>
            {fav ? 'Remove from favorites' : 'Add to favorites'}
          </Item>
          {track.artists[0]?.id && (
            <Item icon={User} onClick={run(() => router.push(artistHref(track.artists[0])))}>
              Go to artist
            </Item>
          )}
          {track.album?.id && (
            <Item icon={Disc3} onClick={run(() => router.push(albumHref(track.album.id)))}>
              Go to album
            </Item>
          )}
          {track.externalUrl && (
            <Item icon={ExternalLink} href={track.externalUrl} onClick={close}>
              Open on {track.provider === 'itunes' ? 'Apple Music / iTunes' : track.provider === 'jamendo' ? 'Jamendo' : 'the Internet Archive'}
            </Item>
          )}
          {ctx.playlistId && (
            <Item icon={Trash2} danger onClick={run(() => (removeFromPlaylist(ctx.playlistId, ctx.pid), toast('Removed from playlist')))}>
              Remove from this playlist
            </Item>
          )}
          {track.provider === 'local' && (
            <Item
              icon={Trash2}
              danger
              onClick={run(async () => {
                const { deleteLocalFile } = await import('@/lib/player/localFiles');
                await deleteLocalFile(track);
                removeLocal(track.id);
                toast('Removed imported track');
              })}
            >
              Delete imported file
            </Item>
          )}
        </>
      )}
    </Dialog>
  );
}
