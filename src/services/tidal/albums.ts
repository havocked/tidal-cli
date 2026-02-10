import { withRetry } from "../../lib/retry";
import type { Track } from "../types";
import { getClient } from "./client";
import { delay, fetchTracksByIds } from "./fetcher";
import { buildIncludedMap } from "./mappers";
import {
  COUNTRY_CODE,
  RATE_LIMIT_MS,
  type AlbumResource,
  type AlbumAttrs,
  type IncludedResource,
  type ResourceId,
} from "./types";

/**
 * Get album details by ID.
 */
export async function getAlbumDetails(albumId: string): Promise<{
  id: string;
  title: string;
  artist: string;
  duration: string | null;
  releaseDate: string | null;
  popularity: number | null;
  numberOfItems: number | null;
  explicit: boolean;
  mediaTags: string[];
}> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      client.GET("/albums/{id}", {
        params: {
          path: { id: albumId },
          query: { countryCode: COUNTRY_CODE, include: ["artists"] },
        },
      }),
    { label: `getAlbumDetails(${albumId})` }
  );

  const resource = (data as { data?: AlbumResource })?.data;
  if (!resource) throw new Error(`Album ${albumId} not found`);

  const attrs = resource.attributes as (AlbumAttrs & {
    explicit?: boolean;
    mediaTags?: string[];
    popularity?: number;
    duration?: string;
  }) | undefined;

  const includedMap = buildIncludedMap(
    (data as { included?: IncludedResource[] })?.included ?? []
  );

  const rels = resource.relationships as
    | Record<string, { data?: Array<{ id: string; type: string }> }>
    | undefined;
  const artistRel = rels?.artists?.data?.[0];
  let artistName = "Unknown";
  if (artistRel) {
    const artist = includedMap.get(`artists:${artistRel.id}`);
    if (artist?.attributes) {
      artistName = (artist.attributes as { name?: string }).name ?? "Unknown";
    }
  }

  return {
    id: resource.id,
    title: attrs?.title ?? "Unknown",
    artist: artistName,
    duration: attrs?.duration ?? null,
    releaseDate: attrs?.releaseDate ?? null,
    popularity: attrs?.popularity ?? null,
    numberOfItems: (attrs as { numberOfItems?: number })?.numberOfItems ?? null,
    explicit: attrs?.explicit ?? false,
    mediaTags: attrs?.mediaTags ?? [],
  };
}

/**
 * Get albums similar to the given album.
 */
export async function getSimilarAlbums(
  albumId: string,
  limit = 10
): Promise<Array<{ id: string; type: string }>> {
  const client = getClient();

  const { data } = await withRetry(
    () =>
      (client as { GET: Function }).GET(
        "/albums/{id}/relationships/similarAlbums",
        {
          params: {
            path: { id: albumId },
            query: { countryCode: COUNTRY_CODE, "page[limit]": limit },
          },
        }
      ) as Promise<{ data?: unknown; error?: unknown }>,
    { label: `getSimilarAlbums(${albumId})` }
  );

  const ids =
    ((data as { data?: ResourceId[] })?.data ?? []).map((r) => ({
      id: r.id,
      type: r.type,
    }));

  return ids;
}

export async function getAlbumTracks(
  albumId: string,
  limit = 100
): Promise<Track[]> {
  const client = getClient();
  const allTrackIds: string[] = [];
  let cursor: string | undefined;

  while (allTrackIds.length < limit) {
    const { data } = await withRetry(
      () =>
        client.GET("/albums/{id}/relationships/items", {
          params: {
            path: { id: albumId },
            query: {
              countryCode: COUNTRY_CODE,
              ...(cursor ? { "page[cursor]": cursor } : {}),
            },
          },
        }),
      { label: `getAlbumTracks(${albumId})` }
    );

    const ids =
      (data as { data?: ResourceId[] })?.data
        ?.filter((r) => r.type === "tracks")
        .map((r) => r.id) ?? [];

    if (ids.length === 0) break;
    allTrackIds.push(...ids);

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

  if (allTrackIds.length === 0) return [];
  return fetchTracksByIds(client, allTrackIds.slice(0, limit));
}
