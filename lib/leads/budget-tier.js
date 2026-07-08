/**
 * @typedef {'simple' | 'moderate' | 'detailed'} BudgetTier
 */

const SIMPLE_PHRASES = [
  "not sure",
  "i'm not sure",
  "recommended",
  "recommended by pro",
  "pro recommended",
  "no budget",
  "flexible",
  "negotiable",
  "open",
  "discuss",
  "n/a",
  "na",
  "unknown",
  "tbd",
];

/**
 * @param {string | undefined | null} budget
 * @returns {BudgetTier}
 */
export function getBudgetTier(budget) {
  if (!budget?.trim()) {
    return "simple";
  }

  const lower = budget.toLowerCase().trim();

  if (SIMPLE_PHRASES.some((phrase) => lower.includes(phrase))) {
    return "simple";
  }

  const amount = extractBudgetAmount(budget);

  if (amount === null) {
    return "simple";
  }

  if (amount > 1000) {
    return "detailed";
  }

  if (amount >= 500) {
    return "moderate";
  }

  return "simple";
}

/**
 * @param {string} budget
 * @returns {number | null}
 */
function extractBudgetAmount(budget) {
  const lower = budget.toLowerCase().trim();

  const lessThanMatch = lower.match(/(?:less|under|below|max|up to)\s*(?:than\s*)?\$?\s*([\d,]+(?:\.\d+)?)/);
  if (lessThanMatch) {
    const cap = parseMoney(lessThanMatch[1]);
    if (cap !== null) {
      return Math.max(cap - 1, 0);
    }
  }

  const moreThanMatch = lower.match(/(?:more|over|above|greater)\s*(?:than\s*)?\$?\s*([\d,]+(?:\.\d+)?)/);
  if (moreThanMatch) {
    const floor = parseMoney(moreThanMatch[1]);
    if (floor !== null) {
      return floor + 1;
    }
  }

  const rangeMatch = budget.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(?:-|to)\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const low = parseMoney(rangeMatch[1]);
    const high = parseMoney(rangeMatch[2]);
    if (low !== null && high !== null) {
      return Math.max(low, high);
    }
  }

  const amounts = [...budget.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)/g)]
    .map((match) => parseMoney(match[1]))
    .filter((value) => value !== null);

  if (!amounts.length) {
    return null;
  }

  return Math.max(...amounts);
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseMoney(value) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {BudgetTier} tier
 */
export function getBudgetTierLabel(tier) {
  if (tier === "detailed") return "High budget";
  if (tier === "moderate") return "Mid budget";
  return "Standard";
}
