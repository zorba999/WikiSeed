"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Toast = {
  id: number;
  title: string;
  detail?: string;
  state: "pending" | "success" | "error";
  hash?: string;
};

type UI = {
  walletOpen: boolean;
  setWalletOpen: (v: boolean) => void;
  accountOpen: boolean;
  setAccountOpen: (v: boolean) => void;
  bountyId: string | null;
  openBounty: (id: string | null) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => number;
  updateToast: (id: number, t: Partial<Toast>) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<UI | null>(null);
let seq = 1;

export function UIProvider({ children }: { children: ReactNode }) {
  const [walletOpen, setWalletOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bountyId, openBounty] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = seq++;
    setToasts((ts) => [...ts, { ...t, id }]);
    return id;
  }, []);
  const updateToast = useCallback(
    (id: number, patch: Partial<Toast>) => {
      setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (patch.state && patch.state !== "pending") setTimeout(() => dismissToast(id), 9000);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ walletOpen, setWalletOpen, accountOpen, setAccountOpen, bountyId, openBounty, toasts, pushToast, updateToast, dismissToast }),
    [walletOpen, accountOpen, bountyId, toasts, pushToast, updateToast, dismissToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI outside UIProvider");
  return v;
}
