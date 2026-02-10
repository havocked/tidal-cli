import { withRetry } from "../../lib/retry";
import type { Album, Artist, Track } from "../types";
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

export async function getArtistTopTracks(
  artistId: number,
  limit = 10
): Promise<Track[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/artists/{id}/relationships/tracks", {
        params: {
          path: { id: String(artistId) },
          query: {
            countryCode: COUNTRY_CODE,
            collapseBy: "FINGERPRINT",
            "page[limit]": limit,
          },
        },
      }),
    { label: `getTopTracks(${artistId})` }
  );

  const trackIds = data?.data?.map((r: ResourceId) => r.id) ?? [];
  if (trackIds.length === 0) return [];

  return fetchTracksByIds(client, trackIds.slice(0, limit));
}

export async function getArtistAlbums(
  artistId: number,
  limit = 50
): Promise<Album[]> {
  const client = getClient();
  const albumIds: string[] = [];
  let cursor: string | undefined;

  // Paginate to collect album IDs
  while (albumIds.length < limit) {
    const { data } = await withRetry(
      () =>
        client.GET("/artists/{id}/relationships/albums", {
          params: {
            path: { id: String(artistId) },
            query: {
              countryCode: COUNTRY_CODE,
              ...(cursor ? { "page[cursor]": cursor } : {}),
            },
          },
        }),
      { label: `getArtistAlbums(${artistId})` }
    );

    const ids =
      (data as { data?: ResourceId[] })?.data?.map((r) => r.id) ?? [];
    if (ids.length === 0) break;
    albumIds.push(...ids);

    const links = (data as { links?: { next?: string } })?.links;
    if (links?.next) {
      const url = new URL(links.next, "https://openapi.tidal.com");
      cursor = url.searchParams.get("page[cursor]") ?? undefined;
      if (!cursor) break;
      await delay(RATE_LIMIT_MS);
    } else {
      break;
    }
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
      (data as { included?: IncludedResource[] })?.included ?? []
    );

    for (const album of (data as { data?: AlbumResource[] })?.data ?? []) {
      const attrs = album.attributes as AlbumAttrs | undefined;
      const rels = album.relationships as
        | Record<string, { data?: Array<{ id: string; type: string }> }>
        | undefined;

      // Resolve primary artist
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
      const releaseYear = releaseDate
        ? new Date(releaseDate).getFullYear()
        : null;

      albums.push({
        id: album.id,
        title: attrs?.title ?? "Unknown",
        artist: artistName,
        releaseDate,
        releaseYear,
        trackCount:
          (attrs as { numberOfItems?: number })?.numberOfItems ?? null,
      });
    }

    if (i + ALBUM_BATCH_SIZE < albumIds.length) {
      await delay(RATE_LIMIT_MS);
    }
  }

  // Sort by release date descending (newest first)
  albums.sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return b.releaseDate.localeCompare(a.releaseDate);
  });

  return albums.slice(0, limit);
}

/**
 * Get artists similar to the given artist.
 */
export async function getSimilarArtists(
  artistId: number,
  limit = 10
): Promise<Artist[]> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/artists/{id}/relationships/similarArtists", {
        params: {
          path: { id: String(artistId) },
          query: {
            countryCode: COUNTRY_CODE,
            "page[limit]": limit,
          },
        },
      } as never),
    { label: `getSimilarArtists(${artistId})` }
  );

  const artistIds =
    ((data as unknown as { data?: ResourceId[] })?.data ?? []).map((r) => r.id) ?? [];
  if (artistIds.length === 0) return [];

  // Fetch full artist details
  const artists: Artist[] = [];
  const ARTIST_BATCH_SIZE = 20;
  for (let i = 0; i < artistIds.length; i += ARTIST_BATCH_SIZE) {
    const batch = artistIds.slice(i, i + ARTIST_BATCH_SIZE);

    const { data: artistData } = await withRetry(
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

    for (const artist of (artistData as { data?: ArtistResource[] })?.data ?? []) {
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
 * Get radio tracks based on an artist.
 */
export async function getArtistRadio(
  artistId: number,
  limit = 20
): Promise<Track[]> {
  const client = getClient();

  const resp = await withRetry(
    () =>
      client.GET("/artists/{id}/relationships/radio", {
        params: {
          path: { id: String(artistId) },
          query: { countryCode: COUNTRY_CODE },
        },
      } as never),
    { label: `getArtistRadio(${artistId})` }
  );

  const { data } = resp;
  const responseData = (
    (data ?? {}) as { data?: ResourceId | ResourceId[] }
  ).data;

  // Same pattern as trackRadio — may return playlist or track IDs
  if (Array.isArray(responseData)) {
    const playlists = responseData.filter((r) => r.type === "playlists");
    if (playlists.length > 0 && playlists[0]?.id) {
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
 * Get artist biography text.
 */
/**
 * Get artist details: name, popularity, externalLinks.
 */
export async function getArtistDetails(
  artistId: string
): Promise<{
  id: string;
  name: string;
  popularity: number | null;
  externalLinks: Array<{ href: string; meta: { type: string } }>;
  picture: string | null;
}> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/artists", {
        params: {
          query: {
            countryCode: COUNTRY_CODE,
            "filter[id]": [artistId],
          },
        },
      }),
    { label: `getArtistDetails(${artistId})` }
  );

  const artist = (data as { data?: ArtistResource[] })?.data?.[0];
  if (!artist) {
    throw new Error(`Artist ${artistId} not found`);
  }

  const attrs = artist.attributes as {
    name?: string;
    popularity?: number;
    externalLinks?: Array<{ href: string; meta: { type: string } }>;
    picture?: Array<{ url?: string }>;
  } | undefined;

  return {
    id: artist.id,
    name: attrs?.name ?? "Unknown",
    popularity: attrs?.popularity ?? null,
    externalLinks: attrs?.externalLinks ?? [],
    picture: attrs?.picture?.[0]?.url ?? null,
  };
}

export async function getArtistBio(
  artistId: number
): Promise<{ text: string; source: string } | null> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      (client as { GET: Function }).GET("/artistBiographies/{id}", {
        params: {
          path: { id: String(artistId) },
          query: { countryCode: COUNTRY_CODE },
        },
      }) as Promise<{ data?: unknown; error?: unknown; response?: Response }>,
    { label: `getArtistBio(${artistId})` }
  );

  const resource = (data as unknown as { data?: { attributes?: { text?: string; source?: string } } })?.data;
  if (!resource?.attributes?.text) return null;

  return {
    text: resource.attributes.text,
    source: resource.attributes.source ?? "TIDAL",
  };
}
