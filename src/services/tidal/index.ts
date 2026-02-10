// Barrel export — all public API from the tidal module.

export { loadCredentials, initTidalClient, getClient, getUserId, getCurrentUser } from "./client";
export { parseDuration, formatKey, mapTrackResource, resolveTrackMeta, buildIncludedMap } from "./mappers";
export { delay, fetchTracksByIds } from "./fetcher";
export { searchArtists, searchTracks, searchAlbums, searchPlaylists, searchTopHits, getSearchSuggestions } from "./search";
export { getArtistTopTracks, getArtistAlbums, getSimilarArtists, getArtistRadio, getArtistBio, getArtistDetails } from "./artists";
export { getAlbumTracks, getAlbumDetails, getSimilarAlbums } from "./albums";
export { getTrack, getSimilarTracks, getTrackRadio, getLyrics, getTrackGenres } from "./tracks";
export {
  getPlaylistTracks,
  getFavoriteTracks,
  createPlaylist,
  addTracksToPlaylist,
  deletePlaylist,
  removeTracksFromPlaylist,
  type CreatePlaylistOptions,
  updatePlaylist,
} from "./playlists";
export { getFavoriteAlbums, getFavoriteArtists, getUserPlaylists } from "./collections";
export { getDiscoveryMixes, getMyMixes, getNewArrivalMixes, type Mix } from "./recommendations";
