"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { short } from "@/lib/format";
import { SeedIcon } from "./Motion";
import { useUI } from "./ui-context";

export function Avatar({ address, className }: { address: string; className?: string }) {
  const h = parseInt(address.slice(2, 8), 16);
  const a = `hsl(${h % 360} 30% 55%)`;
  const b = `hsl(${(h >> 3) % 360} 35% 32%)`;
  return <span className={className} style={{ background: `conic-gradient(from ${h % 360}deg, ${a}, ${b}, ${a})` }} />;
}

export function Header() {
  const { address, isConnected } = useConnection();
  const { setWalletOpen, setAccountOpen } = useUI();
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 200 && y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`header ${hidden ? "is-hidden" : ""}`}>
        <a href="#top" className="logo" data-cursor="Top">
          <SeedIcon />
          WikiSeed
        </a>
        <nav className="nav">
          <a href="#why" className="link-u">Why</a>
          <a href="#how" className="link-u">How it works</a>
          <a href="#bounties" className="link-u">Bounties</a>
          <a href="#seed" className="link-u">Seed one</a>
        </nav>
        <span style={{ width: 260 }} aria-hidden />
      </header>
      <div className={`header-actions ${hidden ? "is-hidden" : ""}`}>
        <span className="net-pill" title="GenLayer Studionet · chain 61999">
          <i className="dot" />
          <span className="net-label">Studionet</span>
        </span>
        {mounted && isConnected && address ? (
          <button className="acct-chip" onClick={() => setAccountOpen(true)} data-magnetic>
            {short(address)}
            <Avatar address={address} className="avatar" />
          </button>
        ) : (
          <button className="btn btn--light btn--sm" onClick={() => setWalletOpen(true)} data-magnetic>
            Connect wallet
          </button>
        )}
      </div>
    </>
  );
}
