import { NextResponse } from "next/server";

const SLACK_API_URL = "https://slack.com/api";
const TARGET_CHANNEL_NAME = "kapa-customer-feedback";

interface SlackMessage {
  type: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackErrorResponse {
  ok: false;
  error: string;
  needed?: string;
  provided?: string;
}

interface ConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
  needed?: string;
}

interface ConversationsHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
  needed?: string;
}

const REQUIRED_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read (if private channel)",
  "groups:history (if private channel)",
];

function formatSlackError(error: string, needed?: string): string {
  if (error === "missing_scope") {
    const scopeInfo = needed ? `Missing scope: ${needed}` : "Missing required scope";
    return `${scopeInfo}. Required scopes: ${REQUIRED_SCOPES.join(", ")}`;
  }
  if (error === "not_in_channel") {
    return "Bot is not in the channel. Please add the bot to #kapa-customer-feedback";
  }
  if (error === "channel_not_found") {
    return "Channel not found. Make sure the bot has access to #kapa-customer-feedback";
  }
  if (error === "invalid_auth") {
    return "Invalid token. Please check your Bot Token (should start with xoxb-)";
  }
  if (error === "token_revoked") {
    return "Token has been revoked. Please generate a new Bot Token";
  }
  return `Slack API error: ${error}`;
}

async function findChannelByName(
  token: string,
  channelName: string
): Promise<string | null> {
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      limit: "200",
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(`${SLACK_API_URL}/conversations.list?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: ConversationsListResponse = await response.json();

    if (!data.ok) {
      throw new Error(formatSlackError(data.error || "unknown_error", data.needed));
    }

    const channel = data.channels?.find((c) => c.name === channelName);
    if (channel) {
      return channel.id;
    }

    cursor = data.response_metadata?.next_cursor;
    if (!cursor) {
      break;
    }
  }

  return null;
}

async function fetchChannelMessages(
  token: string,
  channelId: string,
  oldestTimestamp: string
): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      channel: channelId,
      oldest: oldestTimestamp,
      limit: "200",
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(
      `${SLACK_API_URL}/conversations.history?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data: ConversationsHistoryResponse = await response.json();

    if (!data.ok) {
      throw new Error(formatSlackError(data.error || "unknown_error", data.needed));
    }

    if (data.messages) {
      // Filter out thread replies and system messages, keep only top-level messages
      const topLevelMessages = data.messages.filter(
        (msg) => msg.type === "message" && !msg.thread_ts || msg.thread_ts === msg.ts
      );
      allMessages.push(...topLevelMessages);
    }

    cursor = data.response_metadata?.next_cursor;
    if (!cursor || !data.has_more) {
      break;
    }
  }

  return allMessages;
}

export async function POST(request: Request) {
  try {
    const { token, since } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Slack Bot Token is required" },
        { status: 400 }
      );
    }

    // Find the channel ID
    const channelId = await findChannelByName(token, TARGET_CHANNEL_NAME);

    if (!channelId) {
      return NextResponse.json(
        {
          error: `Channel #${TARGET_CHANNEL_NAME} not found. Make sure the bot is added to the channel.`,
        },
        { status: 404 }
      );
    }

    // Calculate timestamp from provided date or default to 24 hours ago
    let oldestDate: Date;
    if (since) {
      oldestDate = new Date(since);
    } else {
      oldestDate = new Date();
      oldestDate.setHours(oldestDate.getHours() - 24);
    }
    const oldestTimestamp = (oldestDate.getTime() / 1000).toString();

    // Fetch messages
    const messages = await fetchChannelMessages(token, channelId, oldestTimestamp);

    // Return as JSON (the existing ingest page can handle Slack JSON format)
    return NextResponse.json({
      ok: true,
      channel: TARGET_CHANNEL_NAME,
      messages: messages,
      count: messages.length,
    });
  } catch (error) {
    console.error("Error fetching Slack messages:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch Slack messages",
      },
      { status: 500 }
    );
  }
}
