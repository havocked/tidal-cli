import { withEmptyRetry, withRetry } from "../../lib/retry";
import type { Album, Artist, Playlist, Track } from "../types";
import { getClient } from "./client";
import { delay, fetchTracksByIds } from "./fetcher";
import { buildIncludedMap } from "./mappers";
import {
  COUNTRY_CODE,
  RATE_LIMIT_MS,
  type AlbumAttrs,
  type AlbumResource,
  type ArtistResource,
  type IncludedResource,
  type ResourceId,
} from "./types";

export async function searchArtists(query: string): Promise<Artist | null> {
  const client = getClient();

  const artist = await withEmptyRetry(
    async () => {
      const { data } = await withRetry(
        () =>
          client.GET("/searchResults/{id}/relationships/artists", {
            params: {
              path: { id: query },
              query: { countryCode: COUNTRY_CODE, "page[limit]": 1 },
            },
          }),
        { label: `searchArtists("${query}")` }
      );

      const id = data?.data?.[0]?.id;
      if (!id) return null;

      return { id: parseInt(id, 10), name: query, picture: null } as Artist;
    },
    () => false, // null result is the empty signal, not a field check
    { label: `searchArtists("${query}")`, maxRetries: 2 }
  );

  return artist ?? null;
}

export async function searchTracks(
  query: string,
  limit = 20
): Promise<Track[]> {
  const client = getClient();

  const { data: searchData } = await withRetry(
    () =>
      client.GET("/searchResults/{id}/relationships/tracks", {
        params: {
          path: { id: query },
          query: { countryCode: COUNTRY_CODE, "page[limit]": limit },
        },
      }),
    { label: `searchTracks("${query}")` }
  );

  const trackIds =
    searchData?.data?.map((r: ResourceId) => r.id) ?? [];
  if (trackIds.length === 0) return [];

  return fetchTracksByIds(client, trackIds.slice(0, limit));
}

/**
 * Search TIDAL for albums matching a query.
 */
export async function searchAlbums(
  query: string,
  limit = 20
): Promise<Album[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/searchResults/{id}/relationships/albums", {
        params: {
          path: { id: query },
          query: { countryCode: COUNTRY_CODE, "page[limit]": limit },
        },
      }),
    { label: `searchAlbums("${query}")` }
  );

  const albumIds =
    (data as { data?: ResourceId[] })?.data?.map((r) => r.id) ?? [];
  if (albumIds.length === 0) return [];

  // Fetch full album details
  const albums: Album[] = [];
  const ALBUM_BATCH_SIZE = 20;
  for (let i = 0; i < albumIds.length; i += ALBUM_BATCH_SIZE) {
    const batch = albumIds.slice(i, i + ALBUM_BATCH_SIZE);

    const { data: albumData } = await withRetry(
      () =>
        client.GET("/albums", {
          params: {
            query: {
              countryCode: COUNTRY_CODE,
              "filter[id]": batch,
              include: ["artists"],
            },
          },
        }),
      { label: `fetchAlbums(${batch.length} ids)` }
    );

    const includedMap = buildIncludedMap(
      (albumData as { included?: IncludedResource[] })?.included ?? []
    );

    for (const album of (albumData as { data?: AlbumResource[] })?.data ?? []) {
      const attrs = album.attributes as AlbumAttrs | undefined;
      const rels = album.relationships as
        | Record<string, { data?: Array<{ id: string; type: string }> }>
        | undefined;

      const artistRel = rels?.artists?.data?.[0];
      let artistName = "Unknown";
      if (artistRel) {
        const artist = includedMap.get(`artists:${artistRel.id}`);
        if (artist?.attributes) {
          artistName =
            (artist.attributes as { name?: string }).name ?? "Unknown";
        }
      }

      const releaseDate = attrs?.releaseDate ?? null;
      albums.push({
        id: album.id,
        title: attrs?.title ?? "Unknown",
        artist: artistName,
        releaseDate,
        releaseYear: releaseDate ? new Date(releaseDate).getFullYear() : null,
        trackCount: (attrs as { numberOfItems?: number })?.numberOfItems ?? null,
      });
    }

    if (i + ALBUM_BATCH_SIZE < albumIds.length) {
      await delay(RATE_LIMIT_MS);
    }
  }

  return albums.slice(0, limit);
}

/**
 * Search TIDAL for playlists matching a query.
 */
export async function searchPlaylists(
  query: string,
  limit = 20
): Promise<Playlist[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/searchResults/{id}/relationships/playlists", {
        params: {
          path: { id: query },
          query: { countryCode: COUNTRY_CODE, "page[limit]": limit },
        },
      } as never),
    { label: `searchPlaylists("${query}")` }
  );

  const playlistIds =
    ((data as unknown as { data?: ResourceId[] })?.data ?? []).map((r) => r.id) ?? [];
  if (playlistIds.length === 0) return [];

  // Fetch full playlist details
  const playlists: Playlist[] = [];
  for (let i = 0; i < playlistIds.length; i += 10) {
    const batch = playlistIds.slice(i, i + 10);

    for (const pid of batch) {
      const { data: plData } = await withRetry(
        () =>
          client.GET("/playlists/{id}", {
            params: {
              path: { id: pid },
              query: { countryCode: COUNTRY_CODE },
            },
          }),
        { label: `fetchPlaylist(${pid.substring(0, 8)})` }
      );

      const resource = (plData as { data?: { id: string; attributes?: { name?: string; description?: string } } })?.data;
      if (resource) {
        playlists.push({
          id: resource.id,
          title: resource.attributes?.name ?? "Unknown",
          description: resource.attributes?.description ?? "",
        });
      }

      if (playlists.length < playlistIds.length) {
        await delay(RATE_LIMIT_MS);
      }
    }
  }

  return playlists.slice(0, limit);
}

/**
 * Search TIDAL for top hits matching a query (mixed results).
 */
export async function searchTopHits(
  query: string,
  limit = 20
): Promise<Track[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/searchResults/{id}/relationships/topHits", {
        params: {
          path: { id: query },
          query: { countryCode: COUNTRY_CODE, "page[limit]": limit },
        },
      } as never),
    { label: `searchTopHits("${query}")` }
  );

  const trackIds = ((data as unknown as { data?: ResourceId[] })?.data ?? [])
    .filter((r) => r.type === "tracks")
    .map((r) => r.id);
  if (trackIds.length === 0) return [];

  return fetchTracksByIds(client, trackIds.slice(0, limit));
}
