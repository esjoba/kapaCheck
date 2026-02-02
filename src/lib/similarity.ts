// Common English stopwords to filter out
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare", "ought",
  "used", "it", "its", "this", "that", "these", "those", "i", "you", "he",
  "she", "we", "they", "what", "which", "who", "whom", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also", "now", "here", "there", "then",
  "once", "if", "because", "until", "while", "about", "into", "through",
  "during", "before", "after", "above", "below", "between", "under", "again",
  "further", "any", "our", "your", "their", "my", "his", "her", "up", "down",
  "out", "off", "over", "am", "being", "get", "got", "getting", "make",
  "made", "let", "us", "me", "him", "them", "myself", "yourself", "himself",
  "herself", "itself", "ourselves", "themselves", "much", "many", "like",
  "want", "please", "thanks", "thank", "hi", "hello", "hey",
]);

/**
 * Tokenize text into lowercase words, removing punctuation and stopwords
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    // Replace non-alphanumeric chars with spaces
    .replace(/[^a-z0-9\s]/g, " ")
    // Split on whitespace
    .split(/\s+/)
    // Filter out empty strings, short words, and stopwords
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Build a term frequency map from tokens
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  return tf;
}

/**
 * Calculate cosine similarity between two term frequency vectors
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function cosineSimilarity(
  tf1: Map<string, number>,
  tf2: Map<string, number>
): number {
  if (tf1.size === 0 || tf2.size === 0) {
    return 0;
  }

  // Calculate dot product
  let dotProduct = 0;
  for (const [term, freq1] of tf1) {
    const freq2 = tf2.get(term) || 0;
    dotProduct += freq1 * freq2;
  }

  // Calculate magnitudes
  let magnitude1 = 0;
  for (const freq of tf1.values()) {
    magnitude1 += freq * freq;
  }
  magnitude1 = Math.sqrt(magnitude1);

  let magnitude2 = 0;
  for (const freq of tf2.values()) {
    magnitude2 += freq * freq;
  }
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate similarity score between two text strings
 * Returns a value between 0 and 1
 */
export function textSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  const tf1 = termFrequency(tokens1);
  const tf2 = termFrequency(tokens2);

  return cosineSimilarity(tf1, tf2);
}

/**
 * Compare a Slack message to a Linear issue
 * Returns similarity score 0..1
 */
export function compareSlackToLinear(
  slackText: string,
  linearTitle: string,
  linearDescription?: string
): number {
  const linearText = linearDescription
    ? `${linearTitle} ${linearDescription}`
    : linearTitle;

  return textSimilarity(slackText, linearText);
}

/**
 * Find the most similar Linear issues for a Slack message
 * Returns issues sorted by similarity (highest first)
 */
export function findSimilarIssues<T extends { title: string; description?: string }>(
  slackText: string,
  linearIssues: T[],
  minScore: number = 0
): Array<{ issue: T; score: number }> {
  const results = linearIssues.map((issue) => ({
    issue,
    score: compareSlackToLinear(slackText, issue.title, issue.description),
  }));

  return results
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
