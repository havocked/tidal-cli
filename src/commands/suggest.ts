import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getSearchSuggestions } from "../services/tidal";

installNodeStorage();

export function registerSuggestCommand(program: Command): void {
  program
    .command("suggest <query>")
    .description("Get search autocomplete suggestions")
    .action(async (query: string) => {
      await initTidalClient();
      const suggestions = await getSearchSuggestions(query);
      console.log(JSON.stringify({ suggestions }, null, 2));
    });
}
