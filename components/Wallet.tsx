"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { useAccountData, useContractWrite } from "@/hooks/useWikiSeed";
import { gen, short } from "@/lib/format";
import { EXPLORER, fundFromFaucet, studioChain } from "@/lib/genlayer";
import { Avatar } from "./Header";
import { getLenis } from "./Motion";
import { useUI } from "./ui-context";

/* ───────── wallet adapter modal ───────── */

export function WalletModal() {
  const { walletOpen, setWalletOpen, pushToast } = useUI();
  const connectors = useConnectors();
  const { connectAsync, isPending } = useConnect();
  const { isConnected } = useConnection();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) setWalletOpen(false);
  }, [isConnected, setWalletOpen]);

  // Prefer EIP-6963 announced wallets; keep the generic injected one only as fallback.
  const announced = connectors.filter((c) => c.id !== "injected");
  const hasInjected = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum;
  const list = announced.length ? announced : hasInjected ? connectors : [];

  const connect = async (id: string) => {
    const c = connectors.find((x) => x.uid === id);
    if (!c) return;
    setPending(id);
    try {
      await connectAsync({ connector: c, chainId: studioChain.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushToast({ title: "Wallet connection failed", detail: msg.slice(0, 200), state: "error" });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className={`scrim ${walletOpen ? "is-open" : ""}`} onClick={() => setWalletOpen(false)} />
      <div className={`modal ${walletOpen ? "is-open" : ""}`} role="dialog" aria-modal aria-hidden={!walletOpen}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow muted">Connect</div>
            <div className="d-title" style={{ fontSize: 34 }}>
              Choose a wallet
            </div>
          </div>
          <button className="close" onClick={() => setWalletOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="wallets">
          {list.length === 0 && (
            <p className="serif" style={{ fontSize: 19 }}>
              No browser wallet found. Install{" "}
              <a className="link-u" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                MetaMask
              </a>{" "}
              or{" "}
              <a className="link-u" href="https://rabby.io" target="_blank" rel="noreferrer">
                Rabby
              </a>
              , then reload.
            </p>
          )}
          {list.map((c) => (
            <button key={c.uid} className="wallet-btn" onClick={() => connect(c.uid)} disabled={isPending}>
              {c.icon ? <img src={c.icon} alt="" /> : <span className="wicon">◈</span>}
              {c.id === "injected" ? "Browser wallet" : c.name}
              <span className="arrow">{pending === c.uid ? "…" : "→"}</span>
            </button>
          ))}
        </div>
        <p className="note" style={{ color: "rgba(44,40,36,.6)", marginTop: 18 }}>
          WikiSeed runs on GenLayer Studionet (chain {studioChain.id}). Your wallet will be asked to add and switch to it. Test GEN is
          free from the faucet.
        </p>
      </div>
    </>
  );
}

/* ───────── account panel: identity, faucet, withdraw ───────── */

export function AccountPanel() {
  const { accountOpen, setAccountOpen, pushToast } = useUI();
  const { address, connector } = useConnection();
  const { disconnect } = useDisconnect();
  const { account, balance } = useAccountData();
  const write = useContractWrite();
  const qc = useQueryClient();
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (accountOpen) getLenis()?.stop();
    else getLenis()?.start();
  }, [accountOpen]);

  if (!address) return null;
  const linked = account.data?.wiki_user;
  const claimable = BigInt(account.data?.claimable ?? "0");
  const cleanUser = user.trim().replace(/^User:/i, "").replace(/ /g, "_");

  const faucet = async () => {
    setBusy("faucet");
    try {
      await fundFromFaucet(address, 25);
      pushToast({ title: "Faucet", detail: "25 test GEN sent to your wallet", state: "success" });
      await qc.invalidateQueries({ queryKey: ["balance"] });
    } catch (e) {
      pushToast({ title: "Faucet failed", detail: e instanceof Error ? e.message : String(e), state: "error" });
    }
    setBusy(null);
  };

  const run = async (key: string, label: string, fn: string, args: unknown[]) => {
    setBusy(key);
    await write(label, fn, args);
    setBusy(null);
  };

  return (
    <>
      <div className={`scrim ${accountOpen ? "is-open" : ""}`} onClick={() => setAccountOpen(false)} />
      <aside className={`drawer drawer--dark ${accountOpen ? "is-open" : ""}`} aria-hidden={!accountOpen} data-lenis-prevent>
        <div className="drawer__head">
          <span className="eyebrow">Your seed pouch</span>
          <button className="close" onClick={() => setAccountOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="drawer__body">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar address={address} className="avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="d-title" style={{ fontSize: 30 }}>
                {short(address)}
              </div>
              <div className="eyebrow muted">
                {connector?.name ?? "Wallet"} ·{" "}
                <a className="link-u" href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer">
                  explorer
                </a>
              </div>
            </div>
          </div>

          <div className="kv" style={{ borderColor: "var(--line-l)" }}>
            <div style={{ borderColor: "var(--line-l)" }}>
              <span className="eyebrow muted">Balance</span>
              <b>{balance.data !== undefined ? gen(balance.data) : "…"} GEN</b>
            </div>
            <div style={{ borderColor: "var(--line-l)" }}>
              <span className="eyebrow muted">Claimable</span>
              <b>{gen(claimable)} GEN</b>
            </div>
            <div style={{ borderColor: "var(--line-l)" }}>
              <span className="eyebrow muted">Wikipedia</span>
              <b style={{ fontSize: 18 }}>{linked || "—"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn--light btn--sm" onClick={faucet} disabled={busy === "faucet"}>
              {busy === "faucet" ? "Dripping…" : "💧 Faucet +25 GEN"}
            </button>
            <button className="btn btn--sand btn--sm" onClick={() => run("withdraw", "Withdrawing rewards", "withdraw", [])} disabled={claimable === 0n || !!busy}>
              {busy === "withdraw" ? "Withdrawing…" : `Withdraw ${gen(claimable)} GEN`}
            </button>
          </div>

          <div className="box box--ink" style={{ border: "1px solid var(--line-l)" }}>
            <span className="eyebrow">Wikipedia identity</span>
            {linked ? (
              <div className="linked">
                <span style={{ fontSize: 20 }}>✓</span>
                <div>
                  <div className="serif" style={{ fontSize: 22 }}>
                    {linked}
                  </div>
                  <div className="note">Linked on-chain to this wallet. You can now claim bounties.</div>
                </div>
              </div>
            ) : (
              <p className="note">Prove you own a Wikipedia account so the contract knows which articles are yours.</p>
            )}
            <div className="steps">
              <div className="step">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Copy your wallet address</div>
                  <div className="copy-row">
                    <code>{address.toLowerCase()}</code>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        navigator.clipboard.writeText(address.toLowerCase());
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="step">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Paste it on your User page and save</div>
                  <input className="input" placeholder="Your Wikipedia username" value={user} onChange={(e) => setUser(e.target.value)} />
                  <div className="note" style={{ marginTop: 8 }}>
                    Edit it on{" "}
                    {["meta.wikimedia.org", "test.wikipedia.org", "en.wikipedia.org"].map((h, i) => (
                      <span key={h}>
                        {i > 0 && " · "}
                        <a
                          className="link-u"
                          style={{ color: "var(--sand)" }}
                          target="_blank"
                          rel="noreferrer"
                          href={`https://${h}/w/index.php?title=User:${encodeURIComponent(cleanUser || "YourName")}&action=edit`}
                        >
                          {h}
                        </a>
                      </span>
                    ))}
                    . The latest revision must be saved by you. Paid-editing disclosure is recommended by Wikimedia&apos;s Terms of Use.
                  </div>
                </div>
              </div>
              <div className="step">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>Let validators verify it</div>
                  <button
                    className="btn btn--sand btn--sm"
                    disabled={!cleanUser || !!busy}
                    onClick={() => run("link", "Linking Wikipedia account", "link_wiki_account", [cleanUser.replace(/_/g, " ")])}
                  >
                    {busy === "link" ? "Validators are checking…" : linked ? "Re-link account" : "Verify & link"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button className="btn btn--ghost btn--sm" onClick={() => (disconnect(), setAccountOpen(false))}>
            Disconnect
          </button>
        </div>
      </aside>
    </>
  );
}

/* ───────── toasts ───────── */

export function Toasts() {
  const { toasts, dismissToast } = useUI();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.state === "pending" ? (
            <span className="spinner" />
          ) : (
            <span className="toast__icon" style={{ background: t.state === "success" ? "var(--moss)" : "var(--ember)" }}>
              {t.state === "success" ? "✓" : "!"}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="toast__title">{t.title}</div>
            {t.detail && <div className="toast__detail">{t.detail}</div>}
            {t.hash && (
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="link-u">
                View transaction ↗
              </a>
            )}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" style={{ opacity: 0.6 }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
