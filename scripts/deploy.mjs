// Deploys contracts/wiki_seed.py to GenLayer Studionet and writes the address
// to .env.local (NEXT_PUBLIC_CONTRACT_ADDRESS) for the frontend.
//
//   DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy.mjs
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");

const account = createAccount(pk);
const client = createClient({ chain: studionet, account });
const code = new Uint8Array(readFileSync(resolve("contracts/wiki_seed.py")));

console.log(`Deployer ${account.address} → ${studionet.name} (${studionet.id})`);
const hash = await client.deployContract({ code, args: [] });
console.log(`tx ${hash} — waiting for consensus…`);

const receipt = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 120, interval: 5000 });
const address = receipt?.data?.contract_address ?? receipt?.txDataDecoded?.contractAddress ?? receipt?.recipient;
const result = receipt?.consensus_data?.leader_receipt?.[0]?.execution_result;
if (!address || (result && result !== "SUCCESS")) {
  console.error(JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(0, 4000));
  throw new Error("Deployment failed");
}

console.log(`\n✔ WikiSeed deployed at ${address}`);
console.log(`  Explorer: https://explorer-studio.genlayer.com/address/${address}`);

const envPath = resolve(".env.local");
const prev = existsSync(envPath) ? readFileSync(envPath, "utf8").replace(/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*\n?/m, "") : "";
writeFileSync(envPath, `${prev}NEXT_PUBLIC_CONTRACT_ADDRESS=${address}\n`);
console.log("  Saved to .env.local");
