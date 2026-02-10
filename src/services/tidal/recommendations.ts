import { withRetry } from "../../lib/retry";
import { getClient, getUserId } from "./client";
import { COUNTRY_CODE, type ResourceId } from "./types";

export interface Mix {
  id: string;
  title: string;
  subTitle: string;
}

type MixResource = {
  id: string;
  type: string;
  attributes?: {
    title?: string;
    subTitle?: string;
  };
};

/**
 * Fetch mixes from a userRecommendations relationship endpoint.
 */
async function fetchMixes(
  relationship: string,
  label: string
): Promise<Mix[]> {
  const client = getClient();
  const currentUserId = getUserId();

  const { data } = await withRetry(
    () =>
      (client as { GET: Function }).GET(
        `/userRecommendations/${currentUserId}/relationships/${relationship}`,
        {
          params: {
            query: { countryCode: COUNTRY_CODE },
          },
        }
      ) as Promise<{ data?: unknown; error?: unknown; response?: Response }>,
    { label }
  );

  const resources = (data as { data?: MixResource[] })?.data ?? [];
  return resources.map((r) => ({
    id: r.id,
    title: r.attributes?.title ?? "Unknown",
    subTitle: r.attributes?.subTitle ?? "",
  }));
}

/**
 * Get TIDAL discovery mixes for the current user.
 */
export async function getDiscoveryMixes(): Promise<Mix[]> {
  return fetchMixes("discoveryMixes", "getDiscoveryMixes");
}

/**
 * Get personalized "My Mixes" for the current user.
 */
export async function getMyMixes(): Promise<Mix[]> {
  return fetchMixes("myMixes", "getMyMixes");
}

/**
 * Get new arrival mixes for the current user.
 */
export async function getNewArrivalMixes(): Promise<Mix[]> {
  return fetchMixes("newArrivalMixes", "getNewArrivalMixes");
}
