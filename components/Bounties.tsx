"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "wagmi";
import { useAccountData, useAttempts, useBounties, useContractWrite } from "@/hooks/useWikiSeed";
import { ago, gen, NATIVE, revUrl, short, STATUS_LABEL, timeLeft, wikiHost } from "@/lib/format";
import { EXPLORER, type Bounty } from "@/lib/genlayer";
import { gsap, reduceMotion } from "@/lib/gsap";
import { getLenis, Reveal } from "./Motion";
import { useUI } from "./ui-context";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status status--${status}`}>
      <i />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function BountyCard({ b, onClick }: { b: Pick<Bounty, "wiki" | "language" | "topic" | "status" | "reward" | "min_words" | "min_refs" | "deadline"> & { id?: string }; onClick?: () => void }) {
  return (
    <button className="card" onClick={onClick} data-cursor="Open" type="button">
      <div className="card__top">
        <span className="wiki-chip">
          <b>{b.wiki || "—"}</b>
          <span>{NATIVE[b.wiki] ?? b.language}</span>
        </span>
        <StatusBadge status={b.status} />
      </div>
      <div>
        <div className="card__topic">{b.topic || "Your topic will appear here"}</div>
        <div className="card__lang eyebrow muted">{b.language || "Language"}</div>
      </div>
      <div className="card__foot">
        <div className="reward">
          {gen(b.reward)}
          <small>GEN</small>
        </div>
        <div className="card__meta muted">
          ≥ {b.min_words} words · ≥ {b.min_refs} refs
          <br />
          {b.status === "OPEN" ? timeLeft(b.deadline) : " "}
        </div>
      </div>
    </button>
  );
}

const FILTERS = [
  ["ALL", "All"],
  ["OPEN", "Open"],
  ["APPROVED", "Surviving"],
  ["PAID", "Harvested"],
  ["CLOSED", "Closed"],
] as const;

export function BountyBoard() {
  const { data, isLoading, error } = useBounties();
  const { openBounty } = useUI();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("ALL");
  const grid = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const all = data ?? [];
    if (filter === "ALL") return all;
    if (filter === "CLOSED") return all.filter((b) => b.status === "EXPIRED" || b.status === "CANCELLED");
    return all.filter((b) => b.status === filter);
  }, [data, filter]);

  const count = (f: string) =>
    (data ?? []).filter((b) =>
      f === "ALL" ? true : f === "CLOSED" ? b.status === "EXPIRED" || b.status === "CANCELLED" : b.status === f,
    ).length;

  useEffect(() => {
    if (!grid.current || reduceMotion() || !list.length) return;
    const ctx = gsap.context(() => {
      gsap.from(grid.current!.children, {
        y: 60,
        opacity: 0,
        duration: 1.1,
        ease: "bloom",
        stagger: 0.07,
        scrollTrigger: { trigger: grid.current, start: "top 85%" },
      });
    });
    return () => ctx.revert();
  }, [list.length, filter]);

  return (
    <section className="section board" id="bounties">
      <div className="section-head">
        <div>
          <div className="chapter-label eyebrow">03 — The field</div>
          <Reveal as="h2" className="section-head__title display">
            Open bounties
          </Reveal>
        </div>
        <p className="section-head__aside">
          Every card is GEN locked in an Intelligent Contract on Studionet, waiting for one article to exist.
        </p>
      </div>

      <div className="filters">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`pill ${filter === k ? "is-active" : ""}`} onClick={() => setFilter(k)}>
            {label}
            <b>{count(k)}</b>
          </button>
        ))}
      </div>

      {error ? (
        <p className="empty">Could not reach GenLayer Studionet. Retrying…</p>
      ) : isLoading ? (
        <div className="grid">
          {[0, 1, 2].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="empty">Nothing here yet. Seed the first one below.</p>
      ) : (
        <div className="grid" ref={grid}>
          {list.map((b) => (
            <BountyCard key={b.id} b={b} onClick={() => openBounty(b.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────── drawer ───────── */

function Bar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  return (
    <div className="bar">
      <span>{label}</span>
      <span className="bar__track">
        <span className="bar__fill" style={{ width: `${value * 10}%`, background: invert ? "var(--ember)" : undefined }} />
      </span>
      <b>{value}/10</b>
    </div>
  );
}

function parseRevid(v: string): number | null {
  const s = v.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/[?&](?:oldid|diff)=(\d+)/);
  return m ? Number(m[1]) : null;
}

export function BountyDrawer() {
  const { bountyId, openBounty, setAccountOpen, setWalletOpen } = useUI();
  const { data } = useBounties();
  const { data: attempts } = useAttempts(bountyId);
  const { address } = useConnection();
  const { account } = useAccountData();
  const write = useContractWrite();
  const [rev, setRev] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastB, setLastB] = useState<Bounty | null>(null);

  const b = data?.find((x) => x.id === bountyId) ?? null;
  useEffect(() => {
    if (b) setLastB(b);
  }, [b]);
  useEffect(() => {
    if (bountyId) getLenis()?.stop();
    else getLenis()?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openBounty(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bountyId, openBounty]);

  const view = b ?? lastB;
  const now = Math.floor(Date.now() / 1000);
  const readyAt = view ? view.approved_at + view.survival_hours * 3600 : 0;
  const isSponsor = !!address && view?.sponsor.toLowerCase() === address.toLowerCase();
  const linked = account.data?.wiki_user;
  const revid = parseRevid(rev);

  const run = async (label: string, fn: string, args: unknown[]) => {
    setBusy(true);
    await write(label, fn, args);
    setBusy(false);
  };

  return (
    <>
      <div className={`scrim ${bountyId ? "is-open" : ""}`} onClick={() => openBounty(null)} />
      <aside className={`drawer ${bountyId ? "is-open" : ""}`} aria-hidden={!bountyId} data-lenis-prevent>
        {view && (
          <>
            <div className="drawer__head">
              <span className="eyebrow">
                Bounty N°{view.id} · {view.wiki}.wikipedia
              </span>
              <button className="close" onClick={() => openBounty(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="drawer__body">
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                  <StatusBadge status={view.status} />
                  <span className="eyebrow muted">
                    {view.language} · {NATIVE[view.wiki] ?? view.wiki}
                  </span>
                </div>
                <h3 className="d-title">{view.topic}</h3>
                {view.brief && (
                  <p className="serif italic" style={{ fontSize: 20, marginTop: 12, opacity: 0.75 }}>
                    “{view.brief}”
                  </p>
                )}
              </div>

              <div className="kv">
                <div>
                  <span className="eyebrow muted">Reward</span>
                  <b>{gen(view.reward)} GEN</b>
                </div>
                <div>
                  <span className="eyebrow muted">Min words</span>
                  <b>{view.min_words}</b>
                </div>
                <div>
                  <span className="eyebrow muted">Min refs</span>
                  <b>{view.min_refs}</b>
                </div>
                <div>
                  <span className="eyebrow muted">Survival</span>
                  <b>{view.survival_hours}h</b>
                </div>
                <div>
                  <span className="eyebrow muted">Deadline</span>
                  <b>{timeLeft(view.deadline)}</b>
                </div>
                <div>
                  <span className="eyebrow muted">Sponsor</span>
                  <b style={{ fontSize: 18 }}>{short(view.sponsor)}</b>
                </div>
              </div>

              {/* ── actions ── */}
              {view.status === "OPEN" && now <= view.deadline && (
                <div className="box box--ink">
                  <span className="eyebrow">Claim this bounty</span>
                  {!address ? (
                    <>
                      <p className="note">Connect a wallet to claim this bounty.</p>
                      <button className="btn btn--sand btn--sm" onClick={() => setWalletOpen(true)}>
                        Connect wallet
                      </button>
                    </>
                  ) : !linked ? (
                    <>
                      <p className="note">
                        First link your Wikipedia account to this wallet. Validators check your User page to prove it is you.
                      </p>
                      <button className="btn btn--sand btn--sm" onClick={() => setAccountOpen(true)}>
                        Link Wikipedia account
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="note">
                        Write the article on{" "}
                        <a className="link-u" href={wikiHost(view.wiki)} target="_blank" rel="noreferrer" style={{ color: "var(--sand)" }}>
                          {view.wiki}.wikipedia.org
                        </a>{" "}
                        as <b style={{ color: "var(--cream)" }}>{linked}</b>, then paste the revision permalink (or its oldid). Validators
                        will fetch it, count, and judge it with their own LLMs — this takes about a minute.
                      </p>
                      <input
                        className="input"
                        placeholder="https://…/w/index.php?oldid=123456"
                        value={rev}
                        onChange={(e) => setRev(e.target.value)}
                      />
                      <button
                        className="btn btn--sand btn--block"
                        disabled={!revid || busy}
                        onClick={() => run("Submitting claim", "submit_claim", [view.id, revid])}
                        data-magnetic
                      >
                        {busy ? "Validators are reading…" : "Submit for judgement"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {view.status === "APPROVED" && (
                <div className="box box--ink">
                  <span className="eyebrow">Survival window</span>
                  <p className="serif" style={{ fontSize: 22, lineHeight: 1.3 }}>
                    <a className="link-u" href={revUrl(view.wiki, view.claim_revid)} target="_blank" rel="noreferrer">
                      {view.claim_title}
                    </a>{" "}
                    by {view.claim_user} was approved. {now < readyAt ? `Finalizable ${timeLeft(readyAt).replace(" left", "")} from now.` : "It can be finalized now."}
                  </p>
                  <button className="btn btn--sand btn--block" disabled={now < readyAt || busy} onClick={() => run("Finalizing bounty", "finalize", [view.id])}>
                    {busy ? "Checking Wikipedia…" : "Finalize & release reward"}
                  </button>
                  <p className="note">Anyone can finalize. Validators check the article still exists and kept at least 60% of its words.</p>
                </div>
              )}

              {view.status === "PAID" && (
                <div className="box">
                  <span className="eyebrow">Harvested</span>
                  <p className="serif" style={{ fontSize: 22, lineHeight: 1.3 }}>
                    {gen(view.reward)} GEN released to {view.claim_user} ({short(view.claimant)}) for{" "}
                    <a className="link-u" href={revUrl(view.wiki, view.claim_revid)} target="_blank" rel="noreferrer">
                      {view.claim_title}
                    </a>
                    .
                  </p>
                </div>
              )}

              {view.status === "OPEN" && (isSponsor || now > view.deadline) && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {isSponsor && (
                    <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => run("Cancelling bounty", "cancel_bounty", [view.id])}>
                      Cancel &amp; refund
                    </button>
                  )}
                  {now > view.deadline && (
                    <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => run("Expiring bounty", "expire_bounty", [view.id])}>
                      Expire &amp; refund sponsor
                    </button>
                  )}
                </div>
              )}

              {(view.status === "APPROVED" || view.status === "PAID") && (
                <div className="box">
                  <span className="eyebrow">Validator verdict</span>
                  {view.summary && <p className="serif" style={{ fontSize: 19 }}>{view.summary}</p>}
                  <div className="bars">
                    <Bar label="Language" value={view.scores.language} />
                    <Bar label="Topic fit" value={view.scores.topic} />
                    <Bar label="Sources" value={view.scores.sources} />
                    <Bar label="MT risk" value={view.scores.mt_risk} invert />
                  </div>
                  <p className="note" style={{ color: "rgba(44,40,36,.6)" }}>
                    {view.claim_words} words · {view.claim_refs} references · revision {view.claim_revid}
                  </p>
                </div>
              )}

              <div>
                <div className="eyebrow" style={{ marginBottom: 16 }}>
                  On-chain history
                </div>
                <div className="timeline">
                  {(attempts ?? []).map((a, i) => (
                    <div className="tl" key={i}>
                      <span className={`tl__dot ${a.passed ? "ok" : "ko"}`}>{a.passed ? "✓" : "✕"}</span>
                      <div>
                        <div className="tl__head">
                          <span>
                            {a.kind === "claim" ? "Claim" : "Finalize"} · {a.user}
                            {a.title ? ` · ${a.title}` : ""}
                          </span>
                          <span className="muted">{ago(a.at)}</span>
                        </div>
                        <div className="tl__body">{a.reason}</div>
                        <div className="eyebrow muted" style={{ marginTop: 6 }}>
                          {a.stage} · {a.words} words · {a.refs} refs
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="tl">
                    <span className="tl__dot">•</span>
                    <div>
                      <div className="tl__head">
                        <span>Seeded by {short(view.sponsor)}</span>
                        <span className="muted">{ago(view.created_at)}</span>
                      </div>
                      <div className="tl__body">
                        {gen(view.reward)} GEN locked ·{" "}
                        <a className="link-u" href={`${EXPLORER}/address/${view.sponsor}`} target="_blank" rel="noreferrer">
                          explorer
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
