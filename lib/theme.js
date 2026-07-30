export const THEME_STORAGE_KEY = "outreachos.theme";

/** The stock Printstream palette. */
export const DEFAULT_THEME = {
  ink: "#0a0a0c",
  onInk: "#ffffff",
  surface: "#ffffff",
  page: "#eceef1",
  heading: "#0a0a0c",
  body: "#334155",
  mutedText: "#64748b",
  streaks: true,
};

/**
 * Every colour the editor exposes, mapped to the CSS custom property it drives.
 * All other shades in globals.css are derived from these with color-mix().
 */
export const THEME_FIELDS = [
  {
    key: "ink",
    cssVar: "--ink",
    label: "Ink",
    description: "Sidebar, primary buttons, and dark panels",
  },
  {
    key: "onInk",
    cssVar: "--on-ink",
    label: "On ink",
    description: "Text and icons sitting on dark panels",
  },
  {
    key: "surface",
    cssVar: "--surface",
    label: "Surface",
    description: "Cards, inputs, and the top bar",
  },
  {
    key: "page",
    cssVar: "--page",
    label: "Page",
    description: "Background behind the cards",
  },
  {
    key: "heading",
    cssVar: "--heading",
    label: "Headings",
    description: "Titles and emphasised text",
  },
  {
    key: "body",
    cssVar: "--body",
    label: "Body text",
    description: "Paragraphs and labels",
  },
  {
    key: "mutedText",
    cssVar: "--muted-text",
    label: "Muted text",
    description: "Hints, captions, and placeholders",
  },
];

export const THEME_PRESETS = [
  { id: "printstream", name: "Printstream", theme: DEFAULT_THEME },
  {
    id: "midnight",
    name: "Midnight",
    theme: {
      ink: "#0b1220",
      onInk: "#e8eefc",
      surface: "#141c2b",
      page: "#0b1220",
      heading: "#f1f5fd",
      body: "#c3cde0",
      mutedText: "#8d9ab4",
      streaks: true,
    },
  },
  {
    id: "sandstone",
    name: "Sandstone",
    theme: {
      ink: "#3b2f27",
      onInk: "#fdf8f2",
      surface: "#fffaf4",
      page: "#f2e9dd",
      heading: "#2c231c",
      body: "#5c4c40",
      mutedText: "#8b7767",
      streaks: true,
    },
  },
  {
    id: "indigo",
    name: "Indigo",
    theme: {
      ink: "#2b2a63",
      onInk: "#ffffff",
      surface: "#ffffff",
      page: "#eceafb",
      heading: "#1f1e4a",
      body: "#3f3e70",
      mutedText: "#7472a3",
      streaks: true,
    },
  },
  {
    id: "forest",
    name: "Forest",
    theme: {
      ink: "#10251c",
      onInk: "#f0fbf5",
      surface: "#ffffff",
      page: "#e6f0ea",
      heading: "#0d2019",
      body: "#33544a",
      mutedText: "#6b8b80",
      streaks: true,
    },
  },
];

export const NO_STREAKS_CLASS = "ps-no-streaks";

/** @param {unknown} value */
export function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
}

/**
 * Drops anything that isn't a recognised key or a valid hex colour, so a
 * corrupted localStorage entry can never brick the UI.
 * @param {unknown} value
 */
export function normalizeTheme(value) {
  const theme = { ...DEFAULT_THEME };
  if (!value || typeof value !== "object") return theme;

  for (const field of THEME_FIELDS) {
    const candidate = /** @type {Record<string, unknown>} */ (value)[field.key];
    if (isHexColor(candidate)) {
      theme[field.key] = String(candidate).trim().toLowerCase();
    }
  }

  theme.streaks = /** @type {Record<string, unknown>} */ (value).streaks !== false;
  return theme;
}

export function isDefaultTheme(theme) {
  return THEME_FIELDS.every((field) => theme[field.key] === DEFAULT_THEME[field.key])
    && theme.streaks === DEFAULT_THEME.streaks;
}

/** Writes the palette onto :root. Client-only. */
export function applyTheme(theme) {
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;

  for (const field of THEME_FIELDS) {
    root.style.setProperty(field.cssVar, normalized[field.key]);
  }
  root.classList.toggle(NO_STREAKS_CLASS, normalized.streaks === false);

  return normalized;
}

/** Client-only. */
export function readStoredTheme() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? normalizeTheme(JSON.parse(raw)) : { ...DEFAULT_THEME };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

/** Client-only. */
export function storeTheme(theme) {
  try {
    if (isDefaultTheme(theme)) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    }
  } catch {
    // Private browsing or a full quota: the theme just won't persist.
  }
}
