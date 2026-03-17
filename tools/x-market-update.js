#!/usr/bin/env node
/**
 * T-FI Daily Stacks Market Update
 *
 * Fetches market data from Tenero API and posts a daily market update tweet.
 * Skips if already posted today.
 *
 * Usage: cd /root && node tools/x-market-update.js [--dry-run]
 * State: daemon/x-state.json (shares file, uses last_market_tweet_date field)
 * Log:   memory/tweet-log.md
 */

const { TwitterApi } = require("twitter-api-v2");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const TENERO_BASE = "https://api.tenero.io";
const X_STATE_PATH = path.join(__dirname, "../daemon/x-state.json");
const TWEET_LOG = path.join(__dirname, "../memory/tweet-log.md");
const DRY_RUN = process.argv.includes("--dry-run");

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.data);
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on("error", reject);
  });
}

function fmt(n, prefix = "$") {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(0)}`;
}

function loadState() {
  if (!fs.existsSync(X_STATE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(X_STATE_PATH, "utf8")); }
  catch { return {}; }
}

function saveState(state) {
  fs.writeFileSync(X_STATE_PATH, JSON.stringify(state, null, 2));
}

function logTweet(text, tweetId) {
  const ts = new Date().toISOString();
  const preview = text.replace(/\n/g, " ").slice(0, 80);
  const entry = `- [${ts}] [market-update] https://x.com/TFIBTCAGENT/status/${tweetId} — ${preview}\n`;
  if (!fs.existsSync(TWEET_LOG)) fs.writeFileSync(TWEET_LOG, "# Tweet Log\n\n");
  fs.appendFileSync(TWEET_LOG, entry);
}

// ── Tweet builder ─────────────────────────────────────────────────────────────

function buildTweet(stats, tokens) {
  const today = stats.period; // "2026-03-14"
  const [, mm, dd] = today.split("-");
  const dateLabel = `${parseInt(mm)}/${parseInt(dd)}`;

  const vol = fmt(stats.volume_usd);
  const traders = stats.unique_traders;
  const netflow = stats.netflow_usd;
  const flowSign = netflow >= 0 ? "+" : "";
  const flow = `${flowSign}${fmt(netflow)}`;

  // Top 3 by 24h price change %
  const topGainers = tokens
    .filter((t) => t.price && t.price.price_change_1d_pct != null)
    .sort((a, b) => b.price.price_change_1d_pct - a.price.price_change_1d_pct)
    .slice(0, 3)
    .map((t) => `$${t.symbol} +${t.price.price_change_1d_pct.toFixed(1)}%`)
    .join(" | ");

  // Top 3 by 24h $ volume
  const topVolume = tokens
    .sort((a, b) => b.metrics.volume_1d_usd - a.metrics.volume_1d_usd)
    .slice(0, 3)
    .map((t) => `$${t.symbol} ${fmt(t.metrics.volume_1d_usd)}`)
    .join(" | ");

  const tweet = [
    `📊 Stacks market [${dateLabel}]`,
    `Vol: ${vol} | Traders: ${traders} | Flow: ${flow}`,
    ``,
    `📈 Top gainers: ${topGainers}`,
    `💰 Top volume: ${topVolume}`,
    ``,
    `Data: tenero.io | #Stacks #Bitcoin`,
  ].join("\n");

  return tweet;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);

  if (!DRY_RUN && state.last_market_tweet_date === today) {
    console.log(JSON.stringify({ skipped: true, reason: "already_posted_today", date: today }));
    return;
  }

  // Fetch data in parallel
  const [statsArr, tokens] = await Promise.all([
    fetchJson(`${TENERO_BASE}/v1/stacks/market/stats`),
    fetchJson(`${TENERO_BASE}/v1/stacks/market/top_gainers?limit=50`),
  ]);

  // Use latest stats period
  const stats = statsArr[statsArr.length - 1];

  const tweet = buildTweet(stats, tokens);

  if (tweet.length > 280) {
    throw new Error(`Tweet too long: ${tweet.length} chars`);
  }

  if (DRY_RUN) {
    console.log("[DRY RUN] Would post:\n\n" + tweet + `\n\n(${tweet.length} chars)`);
    return;
  }

  const client = new TwitterApi({
    appKey: env.X_API_KEY,
    appSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_TOKEN_SECRET,
  });

  const result = await client.readWrite.v2.tweet(tweet);
  const tweetId = result.data.id;

  logTweet(tweet, tweetId);

  state.last_market_tweet_date = today;
  saveState(state);

  console.log(JSON.stringify({ success: true, tweetId, chars: tweet.length, text: tweet }));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
