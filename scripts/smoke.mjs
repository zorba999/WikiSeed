// Smoke test against the deployed contract on Studionet.
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
loadEnv({ path: ".env.local" });

const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const account = createAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createClient({ chain: studionet, account });
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const read = (fn, args = []) => client.readContract({ address, functionName: fn, args });

async function write(fn, args = [], value = 0n) {
  const hash = await client.writeContract({ address, functionName: fn, args, value });
  const r = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 120, interval: 4000 });
  const lr = r?.consensus_data?.leader_receipt?.[0];
  console.log(`${fn}: ${lr?.execution_result} ${j(lr?.result ?? "").slice(0, 300)} ${lr?.genvm_result ? j(lr.genvm_result).slice(0, 300) : ""}`);
  return r;
}

const step = process.argv[2] ?? "all";
console.log("stats", j(await read("get_stats")));
if (step === "all" || step === "create") await write("create_bounty", ["test", "English", "Smoke test topic", "", 100, 0, 0, 7, 0], 10n ** 18n);
if (step === "all" || step === "link") await write("link_wiki_account", ["Jimbo Wales"]);
if (step === "all" || step === "cancel") {
  const list = await read("get_bounties");
  const open = list.find((b) => b.status === "OPEN" && b.sponsor.toLowerCase() === account.address.toLowerCase());
  if (open) await write("cancel_bounty", [open.id]);
  console.log("account", j(await read("get_account", [account.address])));
  await write("withdraw");
  console.log("account after", j(await read("get_account", [account.address])));
}
console.log("bounties", j(await read("get_bounties")).slice(0, 600));
