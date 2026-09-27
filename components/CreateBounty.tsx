"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccountData, useContractWrite } from "@/hooks/useWikiSeed";
import { gen, NATIVE } from "@/lib/format";
import { BountyCard } from "./Bounties";
import { Reveal } from "./Motion";

const WIKIS: [string, string][] = [
  ["fo", "Faroese"],
  ["wo", "Wolof"],
  ["qu", "Quechua"],
  ["zgh", "Standard Moroccan Tamazight"],
  ["kab", "Kabyle"],
  ["gd", "Scottish Gaelic"],
  ["gn", "Guarani"],
  ["mi", "Māori"],
  ["se", "Northern Sami"],
  ["ln", "Lingala"],
  ["test", "English (test wiki)"],
];

const SURVIVAL = [
  [0, "None · demo"],
  [24, "24 h"],
  [72, "3 days"],
  [168, "7 days"],
  [336, "14 days"],
] as const;

export function CreateBounty() {
  const write = useContractWrite();
  const { balance } = useAccountData();
  const [wiki, setWiki] = useState("fo");
  const [customWiki, setCustomWiki] = useState("");
  const [language, setLanguage] = useState("Faroese");
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [minWords, setMinWords] = useState(600);
  const [minRefs, setMinRefs] = useState(3);
  const [survival, setSurvival] = useState(72);
  const [days, setDays] = useState(30);
  const [reward, setReward] = useState("5");
  const [busy, setBusy] = useState(false);

  const code = (wiki === "other" ? customWiki : wiki).trim().toLowerCase();
  let rewardWei = 0n;
  try {
    rewardWei = parseEther(reward || "0");
  } catch {}
  const valid = /^[a-z][a-z0-9-]{1,19}$/.test(code) && language.trim() && topic.trim().length >= 3 && rewardWei > 0n;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const out = await write("Seeding bounty", "create_bounty", [code, language.trim(), topic.trim(), brief.trim(), minWords, minRefs, survival, days, 0], rewardWei);
    setBusy(false);
    if (out?.ok) {
      setTopic("");
      setBrief("");
      document.querySelector("#bounties")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="section create" id="seed">
      <div className="section-head">
        <div>
          <div className="chapter-label eyebrow">04 — Seed</div>
          <Reveal as="h2" className="section-head__title display">
            Plant a bounty
          </Reveal>
        </div>
        <p className="section-head__aside" style={{ color: "rgba(239,232,220,.72)" }}>
          Describe the article the world is missing. Your GEN stays in the contract until validators approve a real one — or you
          cancel.
        </p>
      </div>

      <div className="create__grid">
        <div className="form">
          <div className="field field--full">
            <label className="eyebrow">
              Wikipedia <span className="muted">{code ? `${code}.wikipedia.org` : ""}</span>
            </label>
            <div className="segmented">
              {WIKIS.map(([c, name]) => (
                <button
                  key={c}
                  type="button"
                  className={`seg ${wiki === c ? "is-active" : ""}`}
                  onClick={() => {
                    setWiki(c);
                    setLanguage(name.replace(" (test wiki)", ""));
                  }}
                  title={name}
                >
                  {c} {NATIVE[c] && c !== "test" ? <span style={{ opacity: 0.6 }}>· {NATIVE[c]}</span> : null}
                </button>
              ))}
              <button type="button" className={`seg ${wiki === "other" ? "is-active" : ""}`} onClick={() => setWiki("other")}>
                other…
              </button>
            </div>
            {wiki === "other" && (
              <input className="input" placeholder="wiki code, e.g. haw, kl, bo" value={customWiki} onChange={(e) => setCustomWiki(e.target.value)} />
            )}
          </div>

          <div className="field">
            <label className="eyebrow">Language</label>
            <input className="input" value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={60} />
          </div>
          <div className="field">
            <label className="eyebrow">
              Reward <span className="muted">{balance.data !== undefined ? `balance ${gen(balance.data)} GEN` : ""}</span>
            </label>
            <input className="input" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>

          <div className="field field--full">
            <label className="eyebrow">Topic</label>
            <input
              className="input"
              placeholder="e.g. The history of the Tórshavn harbour"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="field field--full">
            <label className="eyebrow">
              Brief for writers &amp; validators <span className="muted">optional</span>
            </label>
            <textarea className="input" placeholder="What must the article cover? Tone? Script?" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={600} />
          </div>

          <div className="field">
            <label className="eyebrow">Minimum words</label>
            <span className="range-val">{minWords}</span>
            <input className="range" type="range" min={100} max={3000} step={50} value={minWords} onChange={(e) => setMinWords(+e.target.value)} />
          </div>
          <div className="field">
            <label className="eyebrow">Minimum references</label>
            <span className="range-val">{minRefs}</span>
            <input className="range" type="range" min={0} max={20} value={minRefs} onChange={(e) => setMinRefs(+e.target.value)} />
          </div>

          <div className="field">
            <label className="eyebrow">Survival window</label>
            <div className="segmented">
              {SURVIVAL.map(([h, l]) => (
                <button key={h} type="button" className={`seg ${survival === h ? "is-active" : ""}`} onClick={() => setSurvival(h)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="eyebrow">Open for</label>
            <span className="range-val">{days} days</span>
            <input className="range" type="range" min={1} max={120} value={days} onChange={(e) => setDays(+e.target.value)} />
          </div>

          <div className="field field--full" style={{ marginTop: 10 }}>
            <button className="btn btn--sand btn--block" disabled={!valid || busy} onClick={submit} data-magnetic data-cursor="Seed">
              {busy ? "Waiting for consensus…" : `Seed ${reward || 0} GEN`} <span className="arrow">→</span>
            </button>
            <p className="note">
              Studionet GEN is free — top up from the faucet in your account panel. Validators will judge claims with the exact
              criteria above.
            </p>
          </div>
        </div>

        <div className="preview">
          <span className="eyebrow muted">Live preview</span>
          <BountyCard
            b={{
              wiki: code,
              language,
              topic,
              status: "OPEN",
              reward: rewardWei.toString(),
              min_words: minWords,
              min_refs: minRefs,
              deadline: Math.floor(Date.now() / 1000) + days * 86400,
            }}
          />
        </div>
      </div>
    </section>
  );
}
