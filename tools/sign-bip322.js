#!/usr/bin/env node
/**
 * BIP-322 Simple Signer for T-FI (P2WPKH / bc1q)
 * Usage: node tools/sign-bip322.js "<message>" "<mnemonic>"
 * Output: JSON { address, signature, message }
 */
const BASE = '/root/.npm/_npx/2232c00bb1f81919/node_modules';
const bip39 = require(BASE + '/@scure/bip39');
const { HDKey } = require(BASE + '/@scure/bip32');
const btc = require(BASE + '/@scure/btc-signer');
const { hashSha256Sync } = require(BASE + '/@stacks/encryption');
const { secp256k1 } = require(BASE + '/@noble/curves/secp256k1.js');

const [,, message, mnemonic] = process.argv;
if (!message || !mnemonic) {
  console.error('Usage: node sign-bip322.js "<message>" "<mnemonic>"');
  process.exit(1);
}

const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = HDKey.fromMasterSeed(seed);
const child = root.derive("m/84'/0'/0'/0/0");
const privKey = child.privateKey;
const pubKey = secp256k1.getPublicKey(privKey, true);

const p2wpkhAddr = btc.p2wpkh(pubKey, btc.NETWORK);

function concatBytes(...arrays) {
  const totalLen = arrays.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const arr of arrays) { out.set(arr, off); off += arr.length; }
  return out;
}

function bip322TaggedHash(msg) {
  const tagBytes = new TextEncoder().encode('BIP0322-signed-message');
  const tagHash = hashSha256Sync(tagBytes);
  const msgBytes = new TextEncoder().encode(msg);
  return hashSha256Sync(concatBytes(tagHash, tagHash, msgBytes));
}

const { RawTx, RawWitness, Transaction, SigHash } = btc;

const scriptPubKey = p2wpkhAddr.script;
const msgHash = bip322TaggedHash(message);
const scriptSig = concatBytes(new Uint8Array([0x00, 0x20]), msgHash);
const rawTx = RawTx.encode({
  version: 0,
  inputs: [{ txid: new Uint8Array(32), index: 0xffffffff, finalScriptSig: scriptSig, sequence: 0 }],
  outputs: [{ amount: 0n, script: scriptPubKey }],
  lockTime: 0,
});
const h1 = hashSha256Sync(rawTx);
const toSpendTxid = hashSha256Sync(h1).reverse();

const toSignTx = new Transaction({ version: 0, lockTime: 0, allowUnknownOutputs: true });
toSignTx.addInput({
  txid: toSpendTxid, index: 0,
  witnessUtxo: { script: scriptPubKey, amount: 0n },
  sighashType: SigHash.ALL,
  sequence: 0,
});
toSignTx.addOutput({ script: new Uint8Array([0x6a]), amount: 0n });

toSignTx.sign(privKey);
toSignTx.finalize();

const inp = toSignTx.getInput(0);
const witnessBytes = RawWitness.encode(inp.finalScriptWitness);
const signature = Buffer.from(witnessBytes).toString('base64');

console.log(JSON.stringify({ address: p2wpkhAddr.address, signature, message }));
