const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "/cmds";

export const BASE_PATH = configuredBasePath === "/"
  ? ""
  : configuredBasePath.replace(/\/$/, "");

export function withBasePath(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!BASE_PATH) {
    return path;
  }

  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) {
    return path;
  }

  return `${BASE_PATH}${path}`;
}
