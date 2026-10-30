import { create } from 'zustand';

/** One place to open app-wide dialogs so they are mounted once in the shell. */
export const useDialogs = create((set) => ({
  trackMenu: null, // { track, playlistId?, pid? }
  addToPlaylist: null, // Track[]
  createPlaylist: null, // { tracks: Track[] }
  openTrackMenu: (track, extra = {}) => set({ trackMenu: { track, ...extra } }),
  closeTrackMenu: () => set({ trackMenu: null }),
  openAddToPlaylist: (tracks) => set({ addToPlaylist: Array.isArray(tracks) ? tracks : [tracks], trackMenu: null }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),
  openCreatePlaylist: (tracks = []) => set({ createPlaylist: { tracks }, addToPlaylist: null }),
  closeCreatePlaylist: () => set({ createPlaylist: null }),
}));
