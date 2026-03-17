#!/usr/bin/env node
/**
 * T-FI X Mention Monitor & Auto-Reply
 *
 * Fetches @TFIBTCAGENT mentions, generates Claude replies, posts them.
 * Respects daily budget, tracks replied IDs, updates since_id for next run.
 *
 * Usage: cd /root && node tools/x-mentions.js [--dry-run]
 * State: daemon/x-state.json
 * Log:   memory/tweet-log.md
 */

const { TwitterApi } = require("twitter-api-v2");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_DAILY_REPLIES = 20; // ~600/month ceiling, within free tier 500/mo with headroom
const REPLY_DELAY_MS = 2500; // pause between replies to avoid rate spikes
const MAX_REPLIED_IDS = 500; // cap replied_ids array size

const X_STATE_PATH = path.join(__dirname, "../daemon/x-state.json");
const TWEET_LOG = path.join(__dirname, "../memory/tweet-log.md");

// ── Env ───────────────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, "../.env");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [k, ...v] = line.split("=");
      if (k && v.length) env[k.trim()] = v.join("=").trim();
    });
}

const DRY_RUN = process.argv.includes("--dry-run");

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(X_STATE_PATH)) {
    return { since_id: null, replied_ids: [], daily_count: 0, date: null };
  }
  try {
    return JSON.parse(fs.readFileSync(X_STATE_PATH, "utf8"));
  } catch {
    return { since_id: null, replied_ids: [], daily_count: 0, date: null };
  }
}

function saveState(state) {
  fs.writeFileSync(X_STATE_PATH, JSON.stringify(state, null, 2));
}

// ── Logging ───────────────────────────────────────────────────────────────────

function logEntry(text, tweetId, type = "reply") {
  const timestamp = new Date().toISOString();
  const preview = text.replace(/\n/g, " ").slice(0, 80);
  const entry = `- [${timestamp}] [${type}] https://x.com/TFIBTCAGENT/status/${tweetId} — ${preview}\n`;
  if (!fs.existsSync(TWEET_LOG)) {
    fs.writeFileSync(TWEET_LOG, "# Tweet Log\n\n");
  }
  fs.appendFileSync(TWEET_LOG, entry);
}

// ── Reply generation ──────────────────────────────────────────────────────────

async function generateReply(mentionText, authorHandle) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    system: `You are T-FI (@TFIBTCAGENT), an autonomous AI agent operating on the Bitcoin and Stacks network. You manage sBTC, earn yield, contribute to open-source, and participate in the AIBTC agent economy.

Your reply style:
- Direct and concise — never pad or waffle
- Knowledgeable about Bitcoin, Stacks, DeFi, AI agents, and on-chain economics
- Occasionally witty, never sycophantic
- Honest about being an autonomous AI agent
- No hashtags unless the mention is clearly asking for them
- No emojis unless the mention uses them and it fits

You are replying to a tweet that mentioned you. Write ONLY the reply text — no quotes, no "Here's my reply:", nothing else. Must be under 240 characters to leave room for the @mention prefix.`,
    messages: [
      {
        role: "user",
        content: `Tweet from @${authorHandle}: "${mentionText}"\n\nReply:`,
      },
    ],
  });

  return response.content[0].text.trim().slice(0, 240);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new TwitterApi({
    appKey: env.X_API_KEY,
    appSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_TOKEN_SECRET,
  });

  const state = loadState();

  // Reset daily count at midnight UTC
  const today = new Date().toISOString().slice(0, 10);
  if (state.date !== today) {
    state.daily_count = 0;
    state.date = today;
  }

  if (state.daily_count >= MAX_DAILY_REPLIES) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: "daily_limit_reached",
        count: state.daily_count,
        limit: MAX_DAILY_REPLIES,
      })
    );
    return;
  }

  // Resolve own user ID
  const meResponse = await client.v2.me();
  const myId = meResponse.data.id;

  // Fetch mentions
  const params = {
    max_results: 10,
    "tweet.fields": ["author_id", "created_at", "text", "conversation_id"],
    expansions: ["author_id"],
    "user.fields": ["username", "public_metrics"],
  };
  if (state.since_id) params.since_id = state.since_id;

  const timeline = await client.v2.userMentionTimeline(myId, params);
  const tweets = timeline.data?.data ?? [];

  if (!tweets.length) {
    saveState(state);
    console.log(JSON.stringify({ mentions: 0, replied: 0, daily_count: state.daily_count }));
    return;
  }

  // Build author lookup
  const authorMap = {};
  timeline.data?.includes?.users?.forEach((u) => {
    authorMap[u.id] = u.username;
  });

  // Newest ID becomes next since_id (tweets are newest-first)
  const newestId = tweets[0].id;

  let replied = 0;
  const results = [];

  for (const tweet of tweets) {
    if (state.daily_count >= MAX_DAILY_REPLIES) break;
    if (state.replied_ids.includes(tweet.id)) continue;

    const author = authorMap[tweet.author_id] ?? "unknown";

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would reply to @${author}: "${tweet.text}"`);
      results.push({ dry_run: true, replied_to: tweet.id, author });
      continue;
    }

    try {
      const replyText = await generateReply(tweet.text, author);
      const result = await client.v2.reply(replyText, tweet.id);
      const replyId = result.data.id;

      state.replied_ids.push(tweet.id);
      state.daily_count++;
      replied++;

      logEntry(replyText, replyId, "reply");
      results.push({ replied_to: tweet.id, author, reply_id: replyId, text: replyText });

      // Brief pause between replies
      if (replied < tweets.length) {
        await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      }
    } catch (err) {
      results.push({ replied_to: tweet.id, author, error: err.message });
    }
  }

  if (!DRY_RUN) {
    // Trim replied_ids to avoid unbounded growth
    if (state.replied_ids.length > MAX_REPLIED_IDS) {
      state.replied_ids = state.replied_ids.slice(-MAX_REPLIED_IDS);
    }
    state.since_id = newestId;
    saveState(state);
  }

  console.log(
    JSON.stringify({
      mentions: tweets.length,
      replied,
      daily_count: state.daily_count,
      results,
    })
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
