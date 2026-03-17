const bip39 = require("bip39");
const { BIP32Factory } = require("bip32");
const ecc = require("tiny-secp256k1");
const bitcoinMessage = require("bitcoinjs-message");
const fs = require("fs");
const path = require("path");

const bip32 = BIP32Factory(ecc);

// Load mnemonic from BTC_MNEMONIC env or .env file
let MNEMONIC = process.env.BTC_MNEMONIC || process.env.MNEMONIC || "";
if (!MNEMONIC) {
  try {
    const envPath = path.join(process.env.HOME || "/home/claude-user", ".env");
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^BTC_MNEMONIC=(.+)$/m) || envContent.match(/^MNEMONIC=(.+)$/m);
    if (match) MNEMONIC = match[1].trim();
  } catch (e) { /* ignore */ }
}

async function main() {
  if (!MNEMONIC) { console.error("BTC_MNEMONIC not found"); process.exit(1); }
  if (!bip39.validateMnemonic(MNEMONIC)) { console.error("BTC_MNEMONIC is invalid (bad BIP-39 mnemonic)"); process.exit(1); }
  const seed = await bip39.mnemonicToSeed(MNEMONIC);
  const root = bip32.fromSeed(seed);
  const btcChild = root.derivePath("m/84'/0'/0'/0/0");
  const btcPrivKey = btcChild.privateKey;

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const message = `AIBTC Check-In | ${timestamp}`;

  const sig = bitcoinMessage.sign(message, btcPrivKey, true, { segwitType: "p2wpkh" });
  console.log(JSON.stringify({ signature: sig.toString("base64"), timestamp, btcAddress: "bc1qq9vpsra2cjmuvlx623ltsnw04cfxl2xevuahw3" }));
}

main().catch(e => { console.error(e.message); process.exit(1); });
