/** A link to the home page with the given search params; empty values are dropped. */
export function homeHref(
  params: Record<string, string | number | null | undefined>,
  hash?: string,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return `/${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
