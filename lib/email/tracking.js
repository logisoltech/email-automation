import { randomUUID } from "crypto";

/** 1×1 transparent GIF */
export const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Public app origin for tracking pixel URLs.
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://your-domain.com).
 */
export function getAppBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function createTrackingToken() {
  return randomUUID();
}

/**
 * Append a hidden open-tracking pixel to HTML email content.
 * @param {string} html
 * @param {string} token
 * @param {string} [baseUrl]
 */
export function injectOpenTrackingPixel(html, token, baseUrl = getAppBaseUrl()) {
  if (!html || !token) return html;

  const src = `${baseUrl}/api/t/o/${token}`;
  if (html.includes(src) || /data-open-track=["']1["']/.test(html)) {
    return html;
  }

  const pixel = `<img data-open-track="1" src="${src}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }

  return `${html}${pixel}`;
}
