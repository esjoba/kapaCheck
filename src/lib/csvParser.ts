import { LinearIssue } from "@/store/AppContext";

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

interface ColumnMapping {
  id: number;
  title: number;
  description: number;
  status: number;
}

/**
 * Detect column mapping from header row
 * Supports both manual Linear export and API-generated CSV formats
 */
function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // API format: identifier, title, description, status, ...
  const identifierIdx = lowerHeaders.indexOf("identifier");
  if (identifierIdx !== -1) {
    return {
      id: identifierIdx,
      title: lowerHeaders.indexOf("title"),
      description: lowerHeaders.indexOf("description"),
      status: lowerHeaders.indexOf("status"),
    };
  }

  // Manual Linear export format: ID is first column, Title is 3rd (index 2)
  // Headers typically: ID, Priority, Title, Description, Status, ...
  const idIdx = lowerHeaders.findIndex((h) => h === "id");
  if (idIdx !== -1) {
    const titleIdx = lowerHeaders.indexOf("title");
    const descIdx = lowerHeaders.indexOf("description");
    const statusIdx = lowerHeaders.indexOf("status");

    // If we found title by name, use it; otherwise fall back to position 2
    return {
      id: idIdx,
      title: titleIdx !== -1 ? titleIdx : 2,
      description: descIdx !== -1 ? descIdx : 3,
      status: statusIdx !== -1 ? statusIdx : 4,
    };
  }

  return null;
}

/**
 * Parse Linear CSV export into LinearIssue array
 * Handles both manual Linear export and API-generated CSV formats
 * Also handles multiline descriptions and edge cases
 */
export function parseLinearCSV(csvContent: string): LinearIssue[] {
  const results: LinearIssue[] = [];
  const lines = csvContent.split("\n");

  if (lines.length < 2) {
    return results;
  }

  // Parse and detect header format
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  if (!headers) {
    return results;
  }

  const mapping = detectColumnMapping(headers);
  if (!mapping || mapping.id === -1 || mapping.title === -1) {
    return results;
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
    const id = fields[mapping.id]?.trim();
    const title = fields[mapping.title]?.trim();

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
        description:
          mapping.description !== -1
            ? fields[mapping.description]?.trim() || undefined
            : undefined,
        status:
          mapping.status !== -1
            ? fields[mapping.status]?.trim() || undefined
            : undefined,
      };
    } else if (pendingIssue) {
      // This row doesn't look like a new issue
      // It might be a continuation of the previous description or garbage
      // Check if it has meaningful content in what would be the description column
      const possibleDescContinuation =
        mapping.description !== -1 ? fields[mapping.description]?.trim() : null;
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
  const firstLine = content.split("\n")[0].toLowerCase();
  // Check if first line looks like Linear CSV header (either format)
  return (
    (firstLine.includes("id") || firstLine.includes("identifier")) &&
    firstLine.includes("title") &&
    firstLine.includes(",")
  );
}
