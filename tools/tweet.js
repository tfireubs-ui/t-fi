#!/usr/bin/env node
/**
 * T-FI Tweet Tool
 * Usage: node tools/tweet.js "your tweet text"
 *        node tools/tweet.js --file /path/to/tweet.txt
 *        node tools/tweet.js --type milestone --data '{"cycle":10}'
 *
 * Reads credentials from .env in project root.
 * Logs all tweets to memory/tweet-log.md.
 */

const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");

// Load .env from project root
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

const client = new TwitterApi({
  appKey: env.X_API_KEY,
  appSecret: env.X_API_SECRET,
  accessToken: env.X_ACCESS_TOKEN,
  accessSecret: env.X_ACCESS_TOKEN_SECRET,
});

const TWEET_LOG = path.join(__dirname, "../memory/tweet-log.md");

function logTweet(text, tweetId) {
  const timestamp = new Date().toISOString();
  const entry = `- [${timestamp}] https://x.com/${env.X_HANDLE || "TFIBTCAGENT"}/status/${tweetId} — ${text.replace(/\n/g, " ").slice(0, 80)}\n`;
  if (!fs.existsSync(TWEET_LOG)) {
    fs.writeFileSync(TWEET_LOG, "# Tweet Log\n\n");
  }
  fs.appendFileSync(TWEET_LOG, entry);
}

// Tweet templates for loop integration
const TEMPLATES = {
  heartbeat: (data) =>
    `⚡ T-FI online — cycle ${data.cycle}, ${data.checkIns} check-ins\nBalance: ${data.sbtc} sats sBTC | Mode: ${data.mode}\n#AIBTC #Bitcoin`,

  milestone: (data) =>
    `🎯 Milestone: ${data.text}\n— T-FI (@TFIBTCAGENT) | Cycle ${data.cycle}\n#AIBTC #Bitcoin`,

  contribution: (data) =>
    `🔧 Filed ${data.type} on ${data.repo}: ${data.title}\n${data.url}\n#AIBTC #OpenSource`,

  inbox_message: (data) =>
    `📬 Message from ${data.from} on the AIBTC network: "${data.preview}"\n#AIBTC`,

  level_up: (data) =>
    `🚀 T-FI reached Level ${data.level} (${data.levelName}) on @aibtcdev!\n${data.reward}\n#AIBTC #Bitcoin`,

  genesis_claim: (data) =>
    `${data.claimCode} — Claiming my AIBTC agent: Secret Dome 🤖 @aibtcdev #AIBTC`,

  daily_summary: (data) =>
    `📊 T-FI daily summary (${data.date})\n• Cycles: ${data.cycles}\n• Messages: ${data.messages}\n• Contributions: ${data.contributions}\n• sBTC: ${data.sbtc} sats\n#AIBTC`,
};

async function tweet(text) {
  const rwClient = client.readWrite;
  const result = await rwClient.v2.tweet(text);
  const tweetId = result.data.id;
  logTweet(text, tweetId);
  return tweetId;
}

async function main() {
  const args = process.argv.slice(2);

  let text = null;

  if (args[0] === "--file") {
    text = fs.readFileSync(args[1], "utf8").trim();
  } else if (args[0] === "--type") {
    const type = args[1];
    const data = JSON.parse(args[2] || "{}");
    if (!TEMPLATES[type]) {
      console.error(`Unknown template type: ${type}`);
      console.error(`Available: ${Object.keys(TEMPLATES).join(", ")}`);
      process.exit(1);
    }
    text = TEMPLATES[type](data);
  } else if (args[0] === "--list-templates") {
    console.log("Available tweet templates:");
    Object.entries(TEMPLATES).forEach(([name, fn]) => {
      console.log(`  ${name}: ${fn({}).slice(0, 60)}...`);
    });
    process.exit(0);
  } else if (args.length > 0) {
    text = args.join(" ");
  } else {
    console.error("Usage: node tools/tweet.js <text>");
    console.error("       node tools/tweet.js --type <template> '<json-data>'");
    console.error("       node tools/tweet.js --list-templates");
    process.exit(1);
  }

  if (text.length > 280) {
    console.error(`Tweet too long: ${text.length} chars (max 280)`);
    process.exit(1);
  }

  try {
    const tweetId = await tweet(text);
    console.log(JSON.stringify({ success: true, tweetId, text }));
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
}

main();
