import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const resolveApiPath = () => {
  const candidates = [
    path.resolve(process.cwd(), "convex/_generated/api.js"),
    path.resolve(process.cwd(), "be/convex/_generated/api.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Convex API not generated. Run 'npx convex dev' first.");
};

export const loadConvexApi = async () => {
  const apiPath = resolveApiPath();
  const moduleUrl = pathToFileURL(apiPath).href;
  const { api } = await import(moduleUrl);
  return api;
};
