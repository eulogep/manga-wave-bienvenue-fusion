import { execFile } from "child_process";
import { promisify } from "util";
const run = promisify(execFile);

async function searchPython(source: string, query: string): Promise<MangaResult[]> {
  const { stdout } = await run("python3", [
    "python_bridge.py", "search", "--source", source, "--arg", query,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

// Adaptateur qui implémente SourceExtractor
export const pythonExtractor: SourceExtractor = {
  search: (q) => searchPython("webtoons", q),
  // ...
};
