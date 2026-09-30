import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { defineChain, type EIP1193Provider } from "viem";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x3465bF7Ae4381214538c717e9851046575CeaE9c") as `0x${string}`;

export const STUDIO_RPC = studionet.rpcUrls.default.http[0];
export const EXPLORER = "https://explorer-studio.genlayer.com";

/** Studionet as a wagmi/viem chain, so wallets can add & switch to it. */
export const studioChain = defineChain({
  id: studionet.id,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [STUDIO_RPC] } },
  blockExplorers: { default: { name: "GenLayer Explorer", url: EXPLORER } },
  testnet: true,
});

export type Scores = { language: number; topic: number; mt_risk: number; sources: number };

export type Bounty = {
  id: string;
  sponsor: string;
  wiki: string;
  language: string;
  topic: string;
  brief: string;
  min_words: number;
  min_refs: number;
  survival_hours: number;
  created_at: number;
  not_before: number;
  deadline: number;
  reward: string;
  status: "OPEN" | "APPROVED" | "PAID" | "EXPIRED" | "CANCELLED";
  claimant: string;
  claim_user: string;
  claim_title: string;
  claim_revid: number;
  claim_words: number;
  claim_refs: number;
  approved_at: number;
  closed_at: number;
  scores: Scores;
  summary: string;
  verdict: string;
  attempts: number;
};

export type Attempt = {
  kind: "claim" | "finalize";
  actor: string;
  user: string;
  title: string;
  revid: number;
  at: number;
  passed: boolean;
  stage: "facts" | "llm" | "survival";
  reason: string;
  words: number;
  refs: number;
};

export type Stats = {
  bounties: number;
  by_status: Record<string, number>;
  wikis: number;
  contributors: number;
  total_locked: string;
  total_paid: string;
};

export type Account = { wiki_user: string; claimable: string };

const readClient = createClient({ chain: studionet });

/** genlayer-js may hand back Maps for dicts; normalise to plain JSON objects. */
function plain<T>(v: unknown): T {
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    v.forEach((val, key) => (o[String(key)] = plain(val)));
    return o as T;
  }
  if (Array.isArray(v)) return v.map((x) => plain(x)) as T;
  if (typeof v === "bigint") return (Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()) as T;
  return v as T;
}

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const res = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never,
  });
  return plain<T>(res);
}

export const api = {
  bounties: () => read<Bounty[]>("get_bounties"),
  attempts: (id: string) => read<Attempt[]>("get_attempts", [id]),
  stats: () => read<Stats>("get_stats"),
  account: (addr: string) => read<Account>("get_account", [addr]),
};

export function writeClient(address: `0x${string}`, provider: EIP1193Provider) {
  return createClient({ chain: studionet, account: address, provider });
}

export type TxOutcome = {
  hash: string;
  ok: boolean;
  status: string;
  result: unknown;
  error?: string;
};

type LeaderReceipt = { execution_result?: string; result?: { status?: string; payload?: unknown } };

/** Sends a write through the user's wallet and waits for GenLayer consensus. */
export async function sendWrite(
  address: `0x${string}`,
  provider: EIP1193Provider,
  functionName: string,
  args: unknown[],
  value: bigint = 0n,
  onHash?: (hash: string) => void,
): Promise<TxOutcome> {
  const client = writeClient(address, provider);
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never,
    value,
  })) as string;
  onHash?.(hash);
  const receipt = (await client.waitForTransactionReceipt({
    hash: hash as never,
    status: "ACCEPTED" as never,
    retries: 150,
    interval: 4000,
  })) as unknown as { statusName?: string; consensus_data?: { leader_receipt?: LeaderReceipt[] } };

  const leader = receipt?.consensus_data?.leader_receipt?.[0];
  const payload = leader?.result?.payload;
  const ok = leader?.execution_result === "SUCCESS";
  // Successful results come back as a human-readable repr; the UI re-reads
  // contract views for structured data, so keep it as text.
  const result =
    payload && typeof payload === "object" && "readable" in payload ? (payload as { readable: string }).readable : payload;
  return {
    hash,
    ok,
    status: receipt?.statusName ?? "ACCEPTED",
    result,
    error: ok ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload ?? "Transaction failed"),
  };
}

/** Studio's built-in faucet (same RPC the 💧 button in Studio uses). */
export async function fundFromFaucet(address: string, gen = 20) {
  const res = await fetch(STUDIO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "sim_fundAccount",
      params: [address, gen * 1e18],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Faucet failed");
  return data.result as string;
}

export async function getBalance(address: string): Promise<bigint> {
  const res = await fetch(STUDIO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const data = await res.json();
  return BigInt(data.result ?? "0x0");
}
