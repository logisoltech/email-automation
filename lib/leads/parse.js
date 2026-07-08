import { parseEmailField } from "@/lib/leads/parse-emails";

/**
 * Fixed column map from Google Sheets paste (0-indexed).
 * Ignores: col 5 (phone), col 9 (address), col 11 (contact pref), col 12 (posted).
 */
const COL = {
  DATE: 0,
  NAME: 1,
  COUNTRY: 2,
  CATEGORY: 3,
  EMAIL: 4,
  PROJECT: 6,
  BUDGET: 10,
};

/** New lead row starts with a date like 27-June-2026 */
const ROW_START = /^\d{1,2}-[A-Za-z]+-\d{4}\t/;

/**
 * Rejoin lines broken by wrapped cells or blank spacer rows in Sheets.
 * @param {string} raw
 */
export function reconstructLeadRows(raw) {
  const lines = raw.split(/\r?\n/);
  const rows = [];
  let buffer = "";

  for (const line of lines) {
    if (isBlankRow(line)) {
      continue;
    }

    const trimmed = line.trimStart();

    if (ROW_START.test(trimmed)) {
      if (buffer) {
        rows.push(buffer);
      }
      buffer = line.trimEnd();
      continue;
    }

    if (buffer) {
      if (line.startsWith("\t")) {
        buffer += line;
      } else {
        buffer += ` ${trimmed.trimEnd()}`;
      }
    } else {
      buffer = line.trimEnd();
    }
  }

  if (buffer) {
    rows.push(buffer);
  }

  return rows;
}

/**
 * @param {string} line
 */
function isBlankRow(line) {
  return !line.replace(/\t/g, "").trim();
}

/**
 * @param {string} row
 * @returns {string[]}
 */
function extractEmailsFromRow(row) {
  const cols = row.split("\t");
  const fromColumn = parseEmailField(cols[COL.EMAIL]);

  if (fromColumn.length) {
    return fromColumn;
  }

  const matches = row.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const normalized = matches.map((email) => email.trim().toLowerCase());

  return [...new Set(normalized)];
}

/**
 * @param {string} row
 */
function parseLeadRow(row, sortOrder) {
  const cols = row.replace(/\r/g, "").split("\t");

  while (cols.length <= COL.BUDGET) {
    cols.push("");
  }

  const name = cols[COL.NAME]?.trim().replace(/\s+/g, " ");
  const emails = extractEmailsFromRow(row);
  const leadDate = cols[COL.DATE]?.trim() || "";
  const label = name || leadDate || `Row ${sortOrder + 1}`;

  if (!name) {
    return { error: `${label}: missing name.` };
  }

  if (!emails.length) {
    return { error: `${label}: missing valid email.` };
  }

  let projectDescription = cols[COL.PROJECT]?.trim() || "";

  if (!projectDescription) {
    const extraParts = cols.slice(COL.PROJECT + 1, COL.BUDGET)
      .map((part) => part?.trim())
      .filter((part) => part && !part.startsWith("http") && !looksLikeAddress(part));

    if (extraParts.length) {
      projectDescription = extraParts.join(" ");
    }
  }

  return {
    lead: {
      sortOrder,
      leadDate,
      name,
      country: cols[COL.COUNTRY]?.trim() || "",
      category: cols[COL.CATEGORY]?.trim().replace(/\s+/g, " ") || "",
      emails,
      projectDescription: projectDescription.replace(/\s+/g, " ").trim(),
      budget: normalizeBudget(cols[COL.BUDGET]?.trim()),
    },
  };
}

/**
 * @param {string} value
 */
function looksLikeAddress(value) {
  return /\d{5}/.test(value) || /\b(Ave|St|Rd|Dr|Blvd|Lane|Way|ON|CA|NY|TX|IL|GA|FL)\b/i.test(value);
}

/**
 * @param {string} raw
 */
export function parseLeadsPaste(raw) {
  const rows = reconstructLeadRows(raw);
  const leads = [];
  const errors = [];
  const skippedBlankLines =
    raw.split(/\r?\n/).filter((line) => line.length > 0 && isBlankRow(line)).length;

  rows.forEach((row, index) => {
    const result = parseLeadRow(row, index);

    if (result.error) {
      errors.push(result.error);
      return;
    }

    leads.push(result.lead);
  });

  return {
    leads,
    errors,
    meta: {
      reconstructedRows: rows.length,
      skippedBlankLines,
      parsed: leads.length,
    },
  };
}

/**
 * @param {string | undefined} value
 */
function normalizeBudget(value) {
  if (!value || value === "-------------" || value === "----------------") {
    return "";
  }
  return value.trim();
}
