import os from "os";
import path from "path";

export function expandHome(inputPath: string): string {
  if (!inputPath.startsWith("~")) {
    return inputPath;
  }
  if (inputPath === "~") {
    return os.homedir();
  }
  return path.join(os.homedir(), inputPath.slice(2));
}
