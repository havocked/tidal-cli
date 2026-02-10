import { withRetry } from "../../lib/retry";
import type { Album, Artist, Playlist } from "../types";
import { getClient, getUserId } from "./client";
import { delay } from "./fetcher";
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

/**
 * Get user's favorite albums.
 */
export async function getFavoriteAlbums(limit = 50): Promise<Album[]> {
  const client = getClient();
  const currentUserId = getUserId();

  const albumIds: string[] = [];
  let cursor: string | undefined;

  while (albumIds.length < limit) {
    const queryParams: Record<string, unknown> = {
      countryCode: COUNTRY_CODE,
    };
    if (cursor) queryParams["page[cursor]"] = cursor;

    const { data } = await withRetry(
      () =>
        client.GET("/userCollections/{id}/relationships/albums", {
          params: {
            path: { id: currentUserId },
            query: queryParams as {
              countryCode?: string;
              "page[cursor]"?: string;
            },
          },
        } as never),
      { label: "getFavoriteAlbums" }
    );

    const ids = ((data as unknown as { data?: ResourceId[] })?.data ?? []).map((r) => r.id);
    if (ids.length === 0) break;
    albumIds.push(...ids);

    const nextLink = (data as unknown as { links?: { next?: string } })?.links?.next;
    if (!nextLink) break;

    const cursorMatch = nextLink.match(
      /page%5Bcursor%5D=([^&]+)|page\[cursor\]=([^&]+)/
    );
    cursor = cursorMatch
      ? decodeURIComponent(cursorMatch[1] ?? cursorMatch[2] ?? "")
      : undefined;
    if (!cursor) break;

    await delay(RATE_LIMIT_MS);
  }

  if (albumIds.length === 0) return [];

  // Fetch album details in batches
  const albums: Album[] = [];
  const ALBUM_BATCH_SIZE = 20;
  for (let i = 0; i < albumIds.length; i += ALBUM_BATCH_SIZE) {
    const batch = albumIds.slice(i, i + ALBUM_BATCH_SIZE);

    const { data } = await withRetry(
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
      (data as unknown as { included?: IncludedResource[] })?.included ?? []
    );

    for (const album of (data as unknown as { data?: AlbumResource[] })?.data ?? []) {
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
 * Get user's favorite artists.
 */
export async function getFavoriteArtists(limit = 50): Promise<Artist[]> {
  const client = getClient();
  const currentUserId = getUserId();

  const artistIds: string[] = [];
  let cursor: string | undefined;

  while (artistIds.length < limit) {
    const queryParams: Record<string, unknown> = {
      countryCode: COUNTRY_CODE,
    };
    if (cursor) queryParams["page[cursor]"] = cursor;

    const { data } = await withRetry(
      () =>
        client.GET("/userCollections/{id}/relationships/artists", {
          params: {
            path: { id: currentUserId },
            query: queryParams as {
              countryCode?: string;
              "page[cursor]"?: string;
            },
          },
        } as never),
      { label: "getFavoriteArtists" }
    );

    const ids = ((data as unknown as { data?: ResourceId[] })?.data ?? []).map((r) => r.id);
    if (ids.length === 0) break;
    artistIds.push(...ids);

    const nextLink = (data as unknown as { links?: { next?: string } })?.links?.next;
    if (!nextLink) break;

    const cursorMatch = nextLink.match(
      /page%5Bcursor%5D=([^&]+)|page\[cursor\]=([^&]+)/
    );
    cursor = cursorMatch
      ? decodeURIComponent(cursorMatch[1] ?? cursorMatch[2] ?? "")
      : undefined;
    if (!cursor) break;

    await delay(RATE_LIMIT_MS);
  }

  if (artistIds.length === 0) return [];

  // Fetch artist details in batches
  const artists: Artist[] = [];
  const ARTIST_BATCH_SIZE = 20;
  for (let i = 0; i < artistIds.length; i += ARTIST_BATCH_SIZE) {
    const batch = artistIds.slice(i, i + ARTIST_BATCH_SIZE);

    const { data } = await withRetry(
      () =>
        client.GET("/artists", {
          params: {
            query: {
              countryCode: COUNTRY_CODE,
              "filter[id]": batch,
            },
          },
        }),
      { label: `fetchArtists(${batch.length} ids)` }
    );

    for (const artist of (data as unknown as { data?: ArtistResource[] })?.data ?? []) {
      const attrs = artist.attributes as { name?: string; picture?: Array<{ url?: string }> } | undefined;
      artists.push({
        id: parseInt(artist.id, 10),
        name: attrs?.name ?? "Unknown",
        picture: attrs?.picture?.[0]?.url ?? null,
      });
    }

    if (i + ARTIST_BATCH_SIZE < artistIds.length) {
      await delay(RATE_LIMIT_MS);
    }
  }

  return artists.slice(0, limit);
}

/**
 * Get user's playlists (from collection).
 */
export async function getUserPlaylists(limit = 50): Promise<Playlist[]> {
  const client = getClient();
  const currentUserId = getUserId();

  const playlistIds: string[] = [];
  let cursor: string | undefined;

  while (playlistIds.length < limit) {
    const queryParams: Record<string, unknown> = {
      countryCode: COUNTRY_CODE,
    };
    if (cursor) queryParams["page[cursor]"] = cursor;

    const { data } = await withRetry(
      () =>
        client.GET("/userCollections/{id}/relationships/playlists", {
          params: {
            path: { id: currentUserId },
            query: queryParams as {
              countryCode?: string;
              "page[cursor]"?: string;
            },
          },
        } as never),
      { label: "getUserPlaylists" }
    );

    const ids = ((data as unknown as { data?: ResourceId[] })?.data ?? []).map((r) => r.id);
    if (ids.length === 0) break;
    playlistIds.push(...ids);

    const nextLink = (data as unknown as { links?: { next?: string } })?.links?.next;
    if (!nextLink) break;

    const cursorMatch = nextLink.match(
      /page%5Bcursor%5D=([^&]+)|page\[cursor\]=([^&]+)/
    );
    cursor = cursorMatch
      ? decodeURIComponent(cursorMatch[1] ?? cursorMatch[2] ?? "")
      : undefined;
    if (!cursor) break;

    await delay(RATE_LIMIT_MS);
  }

  if (playlistIds.length === 0) return [];

  // Fetch playlist details
  const playlists: Playlist[] = [];
  for (const pid of playlistIds.slice(0, limit)) {
    const { data } = await withRetry(
      () =>
        client.GET("/playlists/{id}", {
          params: {
            path: { id: pid },
            query: { countryCode: COUNTRY_CODE },
          },
        }),
      { label: `fetchPlaylist(${pid.substring(0, 8)})` }
    );

    const resource = (data as unknown as { data?: { id: string; attributes?: { name?: string; description?: string } } })?.data;
    if (resource) {
      playlists.push({
        id: resource.id,
        title: resource.attributes?.name ?? "Unknown",
        description: resource.attributes?.description ?? "",
      });
    }

    await delay(RATE_LIMIT_MS);
  }

  return playlists;
}
