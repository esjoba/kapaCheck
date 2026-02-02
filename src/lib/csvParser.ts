import { LinearIssue } from "@/store/AppContext";

// Linear CSV column indices
const COL_ID = 0;
const COL_TITLE = 2;
const COL_DESCRIPTION = 3;
const COL_STATUS = 4;

/**
 * Parse a CSV line handling quoted fields with commas and newlines
 * Returns null if the line is incomplete (unclosed quote)
 */
function parseCSVLine(line: string): string[] | null {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ",") {
        fields.push(current);
        current = "";
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // If we're still in quotes, the line is incomplete
  if (inQuotes) {
    return null;
  }

  fields.push(current);
  return fields;
}

/**
 * Parse Linear CSV export into LinearIssue array
 * Handles multiline descriptions and edge cases
 */
export function parseLinearCSV(csvContent: string): LinearIssue[] {
  const results: LinearIssue[] = [];
  const lines = csvContent.split("\n");

  if (lines.length < 2) {
    return results;
  }

  // Verify header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  if (!headers || !headers[COL_ID]?.includes("ID")) {
    // Try to detect if it's a valid Linear CSV
    const lowerHeaders = headers?.map((h) => h.toLowerCase()) || [];
    if (!lowerHeaders.includes("id") && !lowerHeaders.some((h) => h.includes("title"))) {
      return results;
    }
  }

  let currentLine = "";
  let pendingIssue: Partial<LinearIssue> | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip completely empty lines
    if (!line.trim()) {
      continue;
    }

    // Accumulate lines for multiline fields
    currentLine = currentLine ? `${currentLine}\n${line}` : line;

    const fields = parseCSVLine(currentLine);

    // If fields is null, line is incomplete (unclosed quote), continue accumulating
    if (fields === null) {
      continue;
    }

    // Reset current line since we successfully parsed
    currentLine = "";

    // Check if this looks like a valid issue row
    const id = fields[COL_ID]?.trim();
    const title = fields[COL_TITLE]?.trim();

    // Valid row should have an ID that looks like an issue identifier
    // Linear IDs are typically like "ENG-123", "PROJ-45", etc.
    const looksLikeIssueId = id && /^[A-Z]+-\d+$/i.test(id);

    if (looksLikeIssueId && title) {
      // This is a new valid issue
      if (pendingIssue && pendingIssue.id && pendingIssue.title) {
        results.push(pendingIssue as LinearIssue);
      }

      pendingIssue = {
        id,
        title,
        description: fields[COL_DESCRIPTION]?.trim() || undefined,
        status: fields[COL_STATUS]?.trim() || undefined,
      };
    } else if (pendingIssue) {
      // This row doesn't look like a new issue
      // It might be a continuation of the previous description or garbage
      // Check if it has meaningful content in what would be the description column
      const possibleDescContinuation = fields[COL_DESCRIPTION]?.trim();
      if (possibleDescContinuation && !looksLikeIssueId) {
        // Append to previous issue's description
        pendingIssue.description = pendingIssue.description
          ? `${pendingIssue.description}\n${possibleDescContinuation}`
          : possibleDescContinuation;
      }
      // Otherwise, might be a completely malformed row - skip it
    }
  }

  // Don't forget the last pending issue
  if (pendingIssue && pendingIssue.id && pendingIssue.title) {
    results.push(pendingIssue as LinearIssue);
  }

  return results;
}

/**
 * Detect if content is CSV format
 */
export function isCSVFormat(content: string): boolean {
  const firstLine = content.split("\n")[0];
  // Check if first line looks like Linear CSV header
  return (
    firstLine.includes("ID") &&
    firstLine.includes("Title") &&
    firstLine.includes(",")
  );
}
