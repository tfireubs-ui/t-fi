#!/usr/bin/env node
/**
 * T-FI Email Tool
 * Reads unread Gmail, generates Claude replies, sends them.
 *
 * Usage:
 *   node tools/email.js            — check + auto-reply to unread emails
 *   node tools/email.js --dry-run  — preview without sending
 *   node tools/email.js --send "to@example.com" "Subject" "Body"
 *
 * State: daemon/email-state.json
 * Log:   memory/email-log.md
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_DAILY_REPLIES = 20;
const MAX_EMAILS_PER_RUN = 5;

const STATE_PATH = path.join(__dirname, '../daemon/email-state.json');
const LOG_PATH = path.join(__dirname, '../memory/email-log.md');

// ── Env ───────────────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
}

const DRY_RUN = process.argv.includes('--dry-run');

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { replied_ids: [], daily_count: 0, date: null };
  }
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return { replied_ids: [], daily_count: 0, date: null }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ── Logging ───────────────────────────────────────────────────────────────────

function logEmail(from, subject, replyText, type = 'reply') {
  const ts = new Date().toISOString();
  const preview = (replyText || '').replace(/\n/g, ' ').slice(0, 80);
  const entry = `- [${ts}] [${type}] from:${from} subject:"${subject}" — ${preview}\n`;
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, '# Email Log\n\n');
  fs.appendFileSync(LOG_PATH, entry);
}

// ── Reply generation ──────────────────────────────────────────────────────────

async function generateReply(from, subject, body) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are T-FI (tfi.reubs@gmail.com), an autonomous AI agent operating on the Bitcoin and Stacks network. You manage sBTC, contribute to open-source, and participate in the AIBTC agent economy.

Reply style:
- Direct and concise
- Knowledgeable about Bitcoin, Stacks, DeFi, AI agents
- Honest about being an autonomous AI agent
- Professional but not stiff
- No filler phrases

Write ONLY the reply body — no subject line, no "Here's my reply:", nothing else.`,
    messages: [{
      role: 'user',
      content: `Email from: ${from}\nSubject: ${subject}\n\n${body.slice(0, 2000)}\n\nReply:`,
    }],
  });
  return response.content[0].text.trim();
}

// ── IMAP fetch unread ─────────────────────────────────────────────────────────

function fetchUnreadEmails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: env.GMAIL_ADDRESS,
      password: env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || !results.length) { imap.end(); return resolve([]); }

          const toFetch = results.slice(-MAX_EMAILS_PER_RUN); // newest N
          const fetch = imap.fetch(toFetch, { bodies: '', markSeen: false });

          fetch.on('message', (msg, seqno) => {
            let uid = null;
            msg.once('attributes', attrs => { uid = attrs.uid; });
            let raw = '';
            msg.on('body', stream => { stream.on('data', d => raw += d.toString()); });
            msg.once('end', () => emails.push({ uid, raw }));
          });

          fetch.once('error', err => { imap.end(); reject(err); });
          fetch.once('end', () => { imap.end(); });
        });
      });
    });

    imap.once('end', () => resolve(emails));
    imap.once('error', reject);
    imap.connect();
  });
}

function markSeen(uids) {
  return new Promise((resolve, reject) => {
    if (!uids.length) return resolve();
    const imap = new Imap({
      user: env.GMAIL_ADDRESS,
      password: env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });
    imap.once('ready', () => {
      imap.openBox('INBOX', false, err => {
        if (err) { imap.end(); return reject(err); }
        imap.addFlags(uids, ['\\Seen'], err => { imap.end(); if (err) reject(err); });
      });
    });
    imap.once('end', resolve);
    imap.once('error', reject);
    imap.connect();
  });
}

// ── SMTP send ─────────────────────────────────────────────────────────────────

async function sendEmail(to, subject, body, inReplyTo) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: env.GMAIL_ADDRESS, pass: env.GMAIL_APP_PASSWORD },
  });

  const mail = {
    from: `T-FI <${env.GMAIL_ADDRESS}>`,
    to,
    subject,
    text: body,
  };
  if (inReplyTo) {
    mail.inReplyTo = inReplyTo;
    mail.references = inReplyTo;
  }

  return transporter.sendMail(mail);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Manual send mode
  if (process.argv[2] === '--send') {
    const [,, , to, subject, ...bodyParts] = process.argv;
    const body = bodyParts.join(' ');
    if (!to || !subject || !body) {
      console.error('Usage: node email.js --send <to> <subject> <body>');
      process.exit(1);
    }
    const result = await sendEmail(to, subject, body);
    console.log(JSON.stringify({ sent: true, messageId: result.messageId, to, subject }));
    logEmail(to, subject, body, 'sent');
    return;
  }

  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);
  if (state.date !== today) { state.daily_count = 0; state.date = today; }

  if (state.daily_count >= MAX_DAILY_REPLIES) {
    console.log(JSON.stringify({ skipped: true, reason: 'daily_limit_reached', count: state.daily_count }));
    return;
  }

  const rawEmails = await fetchUnreadEmails();
  if (!rawEmails.length) {
    saveState(state);
    console.log(JSON.stringify({ unread: 0, replied: 0, daily_count: state.daily_count }));
    return;
  }

  const results = [];
  const seenUids = [];
  let replied = 0;

  for (const { uid, raw } of rawEmails) {
    if (state.daily_count >= MAX_DAILY_REPLIES) break;
    const uidStr = String(uid);
    if (state.replied_ids.includes(uidStr)) continue;

    const parsed = await simpleParser(raw);
    const from = parsed.from?.text || 'unknown';
    const subject = parsed.subject || '(no subject)';
    const body = parsed.text || parsed.html || '';
    const messageId = parsed.messageId;

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would reply to: ${from} | Subject: ${subject}`);
      results.push({ dry_run: true, from, subject });
      continue;
    }

    try {
      const replyText = await generateReply(from, subject, body);
      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      await sendEmail(from.match(/<(.+)>/)?.[1] || from, replySubject, replyText, messageId);

      state.replied_ids.push(uidStr);
      state.daily_count++;
      replied++;
      seenUids.push(uid);

      logEmail(from, subject, replyText, 'reply');
      results.push({ from, subject, replied: true });

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      results.push({ from, subject, error: err.message });
    }
  }

  if (!DRY_RUN) {
    if (state.replied_ids.length > 1000) state.replied_ids = state.replied_ids.slice(-500);
    saveState(state);
    if (seenUids.length) await markSeen(seenUids).catch(() => {});
  }

  console.log(JSON.stringify({ unread: rawEmails.length, replied, daily_count: state.daily_count, results }));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
