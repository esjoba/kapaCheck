import { NextResponse } from "next/server";

const LINEAR_API_URL = "https://api.linear.app/graphql";

const ISSUES_QUERY = `
  query Issues($cursor: String, $filter: IssueFilter) {
    issues(first: 100, after: $cursor, filter: $filter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        identifier
        title
        description
        state {
          name
        }
        createdAt
        updatedAt
        team {
          name
          key
        }
        creator {
          name
        }
        assignee {
          name
        }
        url
        priority
        labels {
          nodes {
            name
          }
        }
        customerNeeds {
          nodes {
            customer {
              name
              domains
            }
            body
            createdAt
          }
        }
      }
    }
  }
`;

interface CustomerNeed {
  customer?: {
    name: string;
    domains?: string[];
  };
  body?: string;
  createdAt: string;
}

interface LinearIssueNode {
  identifier: string;
  title: string;
  description?: string;
  state?: { name: string };
  createdAt: string;
  updatedAt: string;
  team?: { name: string; key: string };
  creator?: { name: string };
  assignee?: { name: string };
  url: string;
  priority: number;
  labels?: { nodes: { name: string }[] };
  customerNeeds?: { nodes: CustomerNeed[] };
}

interface GraphQLResponse {
  data?: {
    issues: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: LinearIssueNode[];
    };
  };
  errors?: { message: string }[];
}

function escapeCSV(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  // If the value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCustomerNeeds(needs?: { nodes: CustomerNeed[] }): {
  count: number;
  customers: string;
  requests: string;
} {
  if (!needs?.nodes || needs.nodes.length === 0) {
    return { count: 0, customers: "", requests: "" };
  }

  const customers = needs.nodes
    .map((n) => n.customer?.name)
    .filter(Boolean)
    .join("; ");

  const requests = needs.nodes
    .map((n) => n.body?.trim())
    .filter(Boolean)
    .join(" ||| ");

  return {
    count: needs.nodes.length,
    customers,
    requests,
  };
}

function issuesToCSV(issues: LinearIssueNode[]): string {
  const headers = [
    "identifier",
    "title",
    "description",
    "status",
    "team",
    "creator",
    "assignee",
    "priority",
    "labels",
    "customerCount",
    "customers",
    "customerRequests",
    "createdAt",
    "updatedAt",
    "url",
  ];

  const rows = issues.map((issue) => {
    const customerData = formatCustomerNeeds(issue.customerNeeds);
    return [
      escapeCSV(issue.identifier),
      escapeCSV(issue.title),
      escapeCSV(issue.description),
      escapeCSV(issue.state?.name),
      escapeCSV(issue.team?.name),
      escapeCSV(issue.creator?.name),
      escapeCSV(issue.assignee?.name),
      escapeCSV(String(issue.priority)),
      escapeCSV(issue.labels?.nodes.map((l) => l.name).join("; ")),
      escapeCSV(String(customerData.count)),
      escapeCSV(customerData.customers),
      escapeCSV(customerData.requests),
      escapeCSV(issue.createdAt),
      escapeCSV(issue.updatedAt),
      escapeCSV(issue.url),
    ];
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Linear API key is required" },
        { status: 400 }
      );
    }

    // Calculate date 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const filterDate = twelveMonthsAgo.toISOString();

    const allIssues: LinearIssueNode[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetch(LINEAR_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({
          query: ISSUES_QUERY,
          variables: {
            cursor,
            filter: {
              updatedAt: { gte: filterDate },
              team: { key: { eq: "FEED" } },
            },
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
          { error: `Linear API error: ${response.status} - ${text}` },
          { status: response.status }
        );
      }

      const result: GraphQLResponse = await response.json();

      if (result.errors && result.errors.length > 0) {
        return NextResponse.json(
          { error: `GraphQL error: ${result.errors[0].message}` },
          { status: 400 }
        );
      }

      if (!result.data) {
        return NextResponse.json(
          { error: "No data returned from Linear API" },
          { status: 500 }
        );
      }

      allIssues.push(...result.data.issues.nodes);
      hasNextPage = result.data.issues.pageInfo.hasNextPage;
      cursor = result.data.issues.pageInfo.endCursor;
    }

    const csv = issuesToCSV(allIssues);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="linear-feed-issues-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error fetching Linear issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues from Linear" },
      { status: 500 }
    );
  }
}
