export interface RouteMatch {
  key: string;
  params: Record<string, string>;
}

/**
 * Match an HTTP method + path against a list of route keys like "GET /jobs/:id/trigger".
 * Returns the matched key and extracted params, or null.
 */
export function matchRoute(
  routeKeys: string[],
  method: string,
  path: string,
): RouteMatch | null {
  for (const key of routeKeys) {
    const spaceIdx = key.indexOf(" ");
    if (spaceIdx === -1) continue;
    const routeMethod = key.slice(0, spaceIdx).toUpperCase();
    const routePattern = key.slice(spaceIdx + 1);

    if (routeMethod !== method.toUpperCase()) continue;

    const params: Record<string, string> = {};
    const patternParts = routePattern.split("/");
    const pathParts = path.split("/");

    if (patternParts.length !== pathParts.length) continue;

    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }

    if (matched) return { key, params };
  }
  return null;
}
