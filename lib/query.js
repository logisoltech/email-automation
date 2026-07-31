export const queryKeys = {
  session: () => ["session"],
  categories: () => ["leads", "categories"],
  leads: (filters) => [
    "leads",
    "list",
    filters?.categoryId || "",
    filters?.page || 1,
    filters?.q || "",
    filters?.date || "",
    filters?.pageSize || 25,
  ],
  templates: () => ["templates"],
  stats: () => ["analytics", "stats"],
  activation: () => ["activation"],
  campaigns: (page = 1) => ["campaigns", "list", page],
  campaign: (id) => ["campaigns", "detail", id],
};

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
