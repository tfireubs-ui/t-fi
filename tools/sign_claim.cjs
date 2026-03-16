const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const fs = require('fs');
const path = require('path');

const bip32 = BIP32Factory(ecc);

// Load mnemonic from env or .env file
let mnemonic = process.env.BTC_MNEMONIC || process.env.MNEMONIC || "";
if (!mnemonic) {
  try {
    const envPath = path.join(process.env.HOME || "/home/claude-user", ".env");
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^BTC_MNEMONIC=(.+)$/m) || envContent.match(/^MNEMONIC=(.+)$/m);
    if (match) mnemonic = match[1].trim();
  } catch (e) { /* ignore */ }
}

const message = process.env.SIGN_MSG;
if (!mnemonic) { console.error("BTC_MNEMONIC not found"); process.exit(1); }
if (!message) { console.error("SIGN_MSG not set"); process.exit(1); }

const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = bip32.fromSeed(seed);
const child = root.derivePath("m/84'/0'/0'/0/0");
const { address } = bitcoin.payments.p2wpkh({ pubkey: child.publicKey });

const sig = bitcoinMessage.sign(message, child.privateKey, true, { segwitType: 'p2wpkh' });
console.log(JSON.stringify({ sig: sig.toString('base64'), address, message }));
