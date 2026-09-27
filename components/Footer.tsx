"use client";

import { useEffect, useRef } from "react";
import { CONTRACT_ADDRESS, EXPLORER } from "@/lib/genlayer";
import { short } from "@/lib/format";
import { gsap, reduceMotion } from "@/lib/gsap";

export function Footer() {
  const word = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!word.current || reduceMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(word.current!.children, {
        yPercent: 100,
        ease: "seed",
        duration: 1.4,
        stagger: 0.05,
        scrollTrigger: { trigger: word.current, start: "top 95%" },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <footer className="footer">
      <div className="footer__top">
        <p className="footer__cta">
          Every language deserves an encyclopedia. <span className="italic" style={{ color: "var(--sand)" }}>Seed one article at a time.</span>
        </p>
        <div className="footer__col">
          <span className="eyebrow muted">Contract</span>
          <a className="link-u" href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(CONTRACT_ADDRESS)} ↗
          </a>
          <a className="link-u" href="https://studio.genlayer.com" target="_blank" rel="noreferrer">
            GenLayer Studio ↗
          </a>
          <a className="link-u" href={EXPLORER} target="_blank" rel="noreferrer">
            Studionet explorer ↗
          </a>
        </div>
        <div className="footer__col">
          <span className="eyebrow muted">Learn</span>
          <a className="link-u" href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            GenLayer docs ↗
          </a>
          <a className="link-u" href="https://meta.wikimedia.org/wiki/List_of_Wikipedias" target="_blank" rel="noreferrer">
            List of Wikipedias ↗
          </a>
          <a className="link-u" href="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/Paid_contributions_amendment" target="_blank" rel="noreferrer">
            Paid-editing disclosure ↗
          </a>
        </div>
      </div>
      <div className="footer__word" ref={word} style={{ overflow: "hidden" }} aria-hidden>
        {"WIKISEED".split("").map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
      <div className="footer__bottom eyebrow muted">
        <span>Built on GenLayer Studionet · Intelligent Contracts</span>
        <span>Not affiliated with the Wikimedia Foundation</span>
      </div>
    </footer>
  );
}
