// Seeds a few real bounties on the deployed contract (Studionet) for the demo.
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
loadEnv({ path: ".env.local" });

const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const client = createClient({ chain: studionet, account: createAccount(process.env.DEPLOYER_PRIVATE_KEY) });
const GEN = 10n ** 18n;

// [wiki, language, topic, brief, minWords, minRefs, survivalHours, durationDays, rewardGEN]
const seeds = [
  ["fo", "Faroese", "Grindadráp: history and regulation of the pilot whale hunt", "Neutral tone. Cover history, law, and the international debate.", 800, 5, 72, 60, 5n],
  ["wo", "Wolof", "Thieboudienne (ceebu jën), Senegal's national dish", "Origins in Saint-Louis, ingredients, UNESCO 2021 inscription.", 600, 4, 72, 45, 4n],
  ["qu", "Quechua", "Qhapaq Ñan — the Inca road system", "Routes, engineering, and its UNESCO World Heritage status.", 700, 5, 72, 60, 6n],
  ["zgh", "Standard Moroccan Tamazight", "Ahidous, the collective dance of the Middle Atlas", "Write in Tifinagh. Music, poetry (izlan), and social role.", 500, 3, 48, 45, 5n],
  ["gd", "Scottish Gaelic", "The Lewis chessmen", "Discovery on Uig beach in 1831, craftsmanship, where they are held today.", 600, 4, 72, 30, 3n],
  ["test", "English", "WikiSeed demo: any short article you create on test.wikipedia.org", "Demo bounty for trying the full flow end-to-end.", 120, 1, 0, 30, 1n],
];

for (const [wiki, lang, topic, brief, w, r, s, d, reward] of seeds) {
  const hash = await client.writeContract({ address, functionName: "create_bounty", args: [wiki, lang, topic, brief, w, r, s, d, 0], value: reward * GEN });
  const rc = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 120, interval: 4000 });
  console.log(wiki.padEnd(5), rc.consensus_data.leader_receipt[0].execution_result, topic);
}
console.log(JSON.stringify(await client.readContract({ address, functionName: "get_stats", args: [] })));
