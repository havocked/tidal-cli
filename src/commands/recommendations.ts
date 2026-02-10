import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getDiscoveryMixes, getMyMixes, getNewArrivalMixes } from "../services/tidal";

installNodeStorage();

type RecommendationsOptions = {
  type?: string;
};

export function registerRecommendationsCommand(program: Command): void {
  program
    .command("recommendations")
    .description("Show personalized mix recommendations")
    .option("--type <type>", "Mix type: discovery, my, new (default: all)", "all")
    .action(async (options: RecommendationsOptions) => {
      await initTidalClient();
      const type = (options.type ?? "all").toLowerCase();

      const result: Record<string, unknown> = {};

      if (type === "all" || type === "discovery") {
        result.discoveryMixes = await getDiscoveryMixes();
      }
      if (type === "all" || type === "my") {
        result.myMixes = await getMyMixes();
      }
      if (type === "all" || type === "new") {
        result.newArrivalMixes = await getNewArrivalMixes();
      }

      console.log(JSON.stringify(result, null, 2));
    });
}
