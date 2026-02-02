import { NextRequest, NextResponse } from "next/server";
import { tokenize, termFrequency, cosineSimilarity } from "@/lib/similarity";

interface LinearIssue {
  id: string;
  title: string;
  description?: string;
}

interface SimilarityPair {
  issueA: LinearIssue;
  issueB: LinearIssue;
  similarity: number;
}

interface ConsolidationResponse {
  generatedAt: string;
  threshold: number;
  totalIssues: number;
  totalPairsReturned: number;
  approximationMode: boolean;
  pairs: SimilarityPair[];
}

// Get top N tokens from text for bucketing
function getTopTokens(text: string, n: number = 10): Set<string> {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);

  // Sort by frequency and take top N
  const sorted = Array.from(tf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([token]) => token);

  return new Set(sorted);
}

// Calculate similarity between two issues
function calculateIssueSimilarity(issueA: LinearIssue, issueB: LinearIssue): number {
  const textA = `${issueA.title} ${issueA.description || ""}`;
  const textB = `${issueB.title} ${issueB.description || ""}`;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  const tfA = termFrequency(tokensA);
  const tfB = termFrequency(tokensB);

  return cosineSimilarity(tfA, tfB);
}

// Brute force comparison for small datasets
function bruteForceComparison(
  issues: LinearIssue[],
  threshold: number
): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];

  for (let i = 0; i < issues.length; i++) {
    for (let j = i + 1; j < issues.length; j++) {
      const similarity = calculateIssueSimilarity(issues[i], issues[j]);

      if (similarity >= threshold) {
        pairs.push({
          issueA: issues[i],
          issueB: issues[j],
          similarity,
        });
      }
    }
  }

  return pairs;
}

// Optimized comparison using token bucketing for large datasets
function bucketedComparison(
  issues: LinearIssue[],
  threshold: number
): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];
  const seen = new Set<string>();

  // Build token index: token -> set of issue indices
  const tokenIndex = new Map<string, Set<number>>();
  const issueTokens: Set<string>[] = [];

  for (let i = 0; i < issues.length; i++) {
    const text = `${issues[i].title} ${issues[i].description || ""}`;
    const topTokens = getTopTokens(text, 10);
    issueTokens.push(topTokens);

    for (const token of topTokens) {
      if (!tokenIndex.has(token)) {
        tokenIndex.set(token, new Set());
      }
      tokenIndex.get(token)!.add(i);
    }
  }

  // For each issue, find candidates that share at least 2 tokens
  for (let i = 0; i < issues.length; i++) {
    const candidates = new Map<number, number>(); // index -> shared token count

    for (const token of issueTokens[i]) {
      const issuesWithToken = tokenIndex.get(token);
      if (issuesWithToken) {
        for (const j of issuesWithToken) {
          if (j > i) { // Only compare with issues after this one to avoid duplicates
            candidates.set(j, (candidates.get(j) || 0) + 1);
          }
        }
      }
    }

    // Compare only with candidates sharing at least 2 tokens
    for (const [j, sharedCount] of candidates) {
      if (sharedCount >= 2) {
        const pairKey = `${i}-${j}`;
        if (!seen.has(pairKey)) {
          seen.add(pairKey);

          const similarity = calculateIssueSimilarity(issues[i], issues[j]);

          if (similarity >= threshold) {
            pairs.push({
              issueA: issues[i],
              issueB: issues[j],
              similarity,
            });
          }
        }
      }
    }
  }

  return pairs;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threshold = parseFloat(searchParams.get("threshold") || "0.5");

    // Validate threshold
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return NextResponse.json(
        { error: "Invalid threshold. Must be between 0 and 1." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const issues: LinearIssue[] = body.issues || [];

    if (!Array.isArray(issues)) {
      return NextResponse.json(
        { error: "Issues must be an array." },
        { status: 400 }
      );
    }

    const LARGE_DATASET_THRESHOLD = 400;
    const approximationMode = issues.length > LARGE_DATASET_THRESHOLD;

    let pairs: SimilarityPair[];

    if (approximationMode) {
      pairs = bucketedComparison(issues, threshold);
    } else {
      pairs = bruteForceComparison(issues, threshold);
    }

    // Sort by similarity descending
    pairs.sort((a, b) => b.similarity - a.similarity);

    const response: ConsolidationResponse = {
      generatedAt: new Date().toISOString(),
      threshold,
      totalIssues: issues.length,
      totalPairsReturned: pairs.length,
      approximationMode,
      pairs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Consolidation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support GET with issues passed as query param (for small datasets)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Use POST with { issues: [...] } body. Optional query param: ?threshold=0.5",
  });
}
