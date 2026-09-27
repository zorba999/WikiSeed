"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { studioChain } from "@/lib/genlayer";
import { UIProvider } from "@/components/ui-context";

// Wallet adapter: every EIP-6963 browser wallet (MetaMask, Rabby, Coinbase,
// OKX, Brave, Phantom EVM…) is discovered automatically, plus a generic
// injected fallback for older extensions.
const wagmiConfig = createConfig({
  chains: [studioChain],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  transports: { [studioChain.id]: http() },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 10_000 } } }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UIProvider>{children}</UIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
