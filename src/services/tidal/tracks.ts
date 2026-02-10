import { withRetry } from "../../lib/retry";
import type { Track } from "../types";
import { getClient } from "./client";
import { fetchTracksByIds } from "./fetcher";
import { COUNTRY_CODE, type ResourceId } from "./types";

export async function getTrack(trackId: number): Promise<Track | null> {
  const client = getClient();
  const tracks = await fetchTracksByIds(client, [String(trackId)]);
  return tracks[0] ?? null;
}

export async function getSimilarTracks(
  trackId: string,
  limit = 20
): Promise<Track[]> {
  const client = getClient();

  const resp = await withRetry(
    () =>
      client.GET("/tracks/{id}/relationships/similarTracks", {
        params: {
          path: { id: trackId },
          query: {
            countryCode: COUNTRY_CODE,
            include: ["artists", "albums"],
            "page[limit]": limit,
          },
        },
      } as never),
    { label: `similarTracks(${trackId})` }
  );

  const { data } = resp;
  const trackIds = (
    (data as unknown as { data?: ResourceId[] })?.data ?? []
  ).map((r) => r.id);
  if (trackIds.length === 0) return [];

  return fetchTracksByIds(client, trackIds.slice(0, limit));
}

export async function getTrackRadio(
  trackId: string,
  limit = 20
): Promise<Track[]> {
  const client = getClient();

  const resp = await withRetry(
    () =>
      client.GET("/tracks/{id}/relationships/radio", {
        params: {
          path: { id: trackId },
          query: { countryCode: COUNTRY_CODE },
        },
      } as never),
    { label: `trackRadio(${trackId})` }
  );

  const { data } = resp;
  const responseData = (
    (data ?? {}) as { data?: ResourceId | ResourceId[] }
  ).data;

  if (Array.isArray(responseData)) {
    const playlists = responseData.filter((r) => r.type === "playlists");
    if (playlists.length > 0 && playlists[0]?.id) {
      // Dynamic import to avoid circular dependency
      const { getPlaylistTracks } = await import("./playlists");
      return getPlaylistTracks(playlists[0].id, limit);
    }
    const trackIds = responseData
      .filter((r) => r.type === "tracks")
      .map((r) => r.id);
    if (trackIds.length === 0) return [];
    return fetchTracksByIds(client, trackIds.slice(0, limit));
  }

  if (responseData?.id) {
    const { getPlaylistTracks } = await import("./playlists");
    return getPlaylistTracks(responseData.id, limit);
  }

  return [];
}

/**
 * Get lyrics for a track.
 */
export async function getLyrics(
  trackId: string
): Promise<{ lyrics: string; subtitles: string | null } | null> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/tracks/{id}/relationships/lyrics", {
        params: {
          path: { id: trackId },
          query: { countryCode: COUNTRY_CODE },
        },
      } as never),
    { label: `getLyrics(${trackId})` }
  );

  const resource = ((data as unknown as { data?: Array<{ attributes?: { text?: string; subtitles?: string } }> })?.data ?? [])[0];
  if (!resource?.attributes?.text) return null;

  return {
    lyrics: resource.attributes.text,
    subtitles: resource.attributes.subtitles ?? null,
  };
}

/**
 * Get genres for a track.
 */
export async function getTrackGenres(
  trackId: string
): Promise<string[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/tracks/{id}/relationships/genres", {
        params: {
          path: { id: trackId },
          query: { countryCode: COUNTRY_CODE },
        },
      } as never),
    { label: `getTrackGenres(${trackId})` }
  );

  const genres = ((data as unknown as { data?: Array<{ id: string; attributes?: { genreName?: string } }> })?.data ?? []);
  return genres
    .map((g) => g.attributes?.genreName)
    .filter((name): name is string => !!name);
}
