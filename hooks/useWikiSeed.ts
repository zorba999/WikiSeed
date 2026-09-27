"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EIP1193Provider } from "viem";
import { useConnection, useSwitchChain } from "wagmi";
import { api, sendWrite, studioChain, getBalance } from "@/lib/genlayer";
import { useUI } from "@/components/ui-context";

export function useBounties() {
  return useQuery({ queryKey: ["bounties"], queryFn: api.bounties, refetchInterval: 20_000 });
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 20_000 });
}

export function useAttempts(id: string | null) {
  return useQuery({ queryKey: ["attempts", id], queryFn: () => api.attempts(id!), enabled: !!id });
}

export function useAccountData() {
  const { address } = useConnection();
  const account = useQuery({ queryKey: ["account", address], queryFn: () => api.account(address!), enabled: !!address });
  const balance = useQuery({ queryKey: ["balance", address], queryFn: () => getBalance(address!), enabled: !!address, refetchInterval: 15_000 });
  return { address, account, balance };
}

/** Wallet-signed contract writes with toast tracking + cache refresh. */
export function useContractWrite() {
  const { address, connector, chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { setWalletOpen, pushToast, updateToast } = useUI();
  const qc = useQueryClient();

  return useCallback(
    async (label: string, functionName: string, args: unknown[], value: bigint = 0n) => {
      if (!address || !connector) {
        setWalletOpen(true);
        return null;
      }
      const toast = pushToast({ title: label, detail: "Confirm in your wallet…", state: "pending" });
      try {
        if (chainId !== studioChain.id) await switchChainAsync({ chainId: studioChain.id });
        const provider = (await connector.getProvider()) as EIP1193Provider;
        const out = await sendWrite(address, provider, functionName, args, value, (hash) =>
          updateToast(toast, { hash, detail: "Validators are reaching consensus…" }),
        );
        if (out.ok) updateToast(toast, { state: "success", detail: "Accepted by GenLayer consensus", hash: out.hash });
        else updateToast(toast, { state: "error", detail: cleanError(out.error), hash: out.hash });
        await qc.invalidateQueries();
        return out;
      } catch (e) {
        updateToast(toast, { state: "error", detail: cleanError(e instanceof Error ? e.message : String(e)) });
        return null;
      }
    },
    [address, connector, chainId, switchChainAsync, setWalletOpen, pushToast, updateToast, qc],
  );
}

function cleanError(msg?: string) {
  if (!msg) return "Transaction failed";
  if (/user (rejected|denied)/i.test(msg)) return "Request rejected in wallet";
  return msg.replace(/^"|"$/g, "").slice(0, 220);
}
