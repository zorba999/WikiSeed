# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
WikiSeed — bounties for Wikipedia articles in under-served languages.

Sponsors lock GEN on a topic + language. A contributor links their Wikipedia
account to their wallet, writes the article, and claims with a revision id.
Validators read Wikipedia directly (MediaWiki API), recompute the objective
facts (authorship, words, references) and independently ask their own LLM to
judge language, topic fit, machine-translation quality and sources. After a
survival window the article is checked again, and only then is the reward
released (pull payment via `withdraw`).
"""

import datetime
import json
import re
import urllib.parse
from dataclasses import dataclass

from genlayer import *


USER_AGENT = "WikiSeed/1.0 (GenLayer intelligent contract; bounties for small-language Wikipedias)"
WIKI_CODE_RE = re.compile(r"^[a-z][a-z0-9-]{1,19}$")
# Where a contributor may publish the wallet address on their user page.
LINK_HOSTS = ["meta.wikimedia.org", "test.wikipedia.org", "en.wikipedia.org"]
MAX_LLM_CHARS = 9000
SURVIVAL_RATIO = 0.6  # at finalize, the article must keep >= 60% of claimed words


# ─────────────────────────── storage types ───────────────────────────


@allow_storage
@dataclass
class Bounty:
    id: u64
    sponsor: Address
    wiki: str
    language: str
    topic: str
    brief: str
    min_words: u32
    min_refs: u32
    survival_hours: u32
    created_at: u64
    not_before: u64
    deadline: u64
    reward: u256
    status: str  # OPEN | APPROVED | PAID | EXPIRED | CANCELLED
    claimant: Address
    claim_user: str
    claim_title: str
    claim_pageid: u64
    claim_revid: u64
    claim_words: u32
    claim_refs: u32
    approved_at: u64
    closed_at: u64
    score_language: u8
    score_topic: u8
    score_mt_risk: u8
    score_sources: u8
    summary: str
    verdict: str
    attempts: u32


@allow_storage
@dataclass
class Attempt:
    bounty_id: u64
    kind: str  # claim | finalize
    actor: Address
    user: str
    title: str
    revid: u64
    at: u64
    passed: bool
    stage: str  # facts | llm | survival
    reason: str
    words: u32
    refs: u32


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


# ─────────────────────────── pure helpers ───────────────────────────


def _now() -> int:
    try:
        raw = gl.message_raw["datetime"]
        return int(datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp())
    except Exception:
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())


def _parse_ts(ts: str) -> int:
    return int(datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp())


def _normalize_user(name: str) -> str:
    name = re.sub(r"[\s_]+", " ", name.strip())
    if name.lower().startswith("user:"):
        name = name[5:].strip()
    if not name:
        return ""
    return name[0].upper() + name[1:]


def _wiki_host(wiki: str) -> str:
    return f"{wiki}.wikipedia.org"


def _http_get_json(url: str) -> dict:
    try:
        res = gl.nondet.web.get(url, headers={"User-Agent": USER_AGENT})
    except TypeError:
        res = gl.nondet.web.get(url)
    status = getattr(res, "status", None)
    if status is None:
        status = getattr(res, "status_code", 200)
    if status >= 500:
        raise gl.vm.UserError(f"Wikipedia unavailable ({status})")
    if status >= 400:
        raise gl.vm.UserError(f"Wikipedia request rejected ({status})")
    body = res.body.decode("utf-8") if res.body else "{}"
    return json.loads(body)


def _api(host: str, params: dict) -> dict:
    base = {"action": "query", "format": "json", "formatversion": "2"}
    base.update(params)
    return _http_get_json(f"https://{host}/w/api.php?" + urllib.parse.urlencode(base))


def _strip_nested(text: str, pattern: str) -> str:
    rx = re.compile(pattern)
    for _ in range(25):
        new = rx.sub(" ", text)
        if new == text:
            break
        text = new
    return text


def wikitext_to_text(src: str) -> str:
    t = re.sub(r"<!--[\s\S]*?-->", " ", src)
    t = re.sub(r"<ref\b[^>]*/>", " ", t, flags=re.I)
    t = re.sub(r"<ref\b[^>]*>[\s\S]*?</ref>", " ", t, flags=re.I)
    t = re.sub(r"<(gallery|math|syntaxhighlight|score|timeline)\b[\s\S]*?</\1>", " ", t, flags=re.I)
    t = _strip_nested(t, r"\{\{[^{}]*\}\}")
    t = _strip_nested(t, r"\{\|[^{}]*?\|\}")
    # File / Category / interwiki style links: [[Ns:...]]
    t = _strip_nested(t, r"\[\[[^\[\]|]*:[^\[\]]*\]\]")
    t = re.sub(r"\[\[[^\[\]|]*\|([^\[\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[\[([^\[\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://[^\s\]]+\s*([^\]]*)\]", r"\1", t)
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"^=+\s*(.*?)\s*=+\s*$", r"\1", t, flags=re.M)
    t = re.sub(r"^[*#:;]+", " ", t, flags=re.M)
    t = re.sub(r"__[A-Z]+__", " ", t)
    return re.sub(r"\s+", " ", t).strip()


_CJK_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿가-힯]")
_WORD_RE = re.compile(r"[^\W\d_]+(?:['’\-][^\W\d_]+)*")


def count_words(text: str) -> int:
    cjk = len(_CJK_RE.findall(text))
    words = len(_WORD_RE.findall(_CJK_RE.sub(" ", text)))
    return words + cjk // 2


def extract_refs(src: str) -> list:
    refs = []
    for m in re.finditer(r"<ref\b([^>]*)>([\s\S]*?)</ref>", src, flags=re.I):
        if m.group(1).rstrip().endswith("/"):
            continue
        refs.append(m.group(2).strip())
    for m in re.finditer(r"\{\{\s*(sfn|harvnb|sfnp)\b[^{}]*\}\}", src, flags=re.I):
        refs.append(m.group(0))
    return refs


def derive_pass(llm: dict, min_refs: int, slack: int = 0) -> bool:
    """Approval rule. `slack` widens (+) or tightens (-) the score thresholds so
    validators with a different LLM can tolerate borderline disagreements."""
    return (
        bool(llm.get("language_ok"))
        and bool(llm.get("topic_match"))
        and int(llm.get("language_score", 0)) >= 6 - slack
        and int(llm.get("topic_score", 0)) >= 6 - slack
        and int(llm.get("machine_translation_risk", 10)) <= 6 + slack
        and (min_refs == 0 or int(llm.get("sources_score", 0)) >= 4 - slack)
    )


def _clamp10(v) -> int:
    try:
        return max(0, min(10, int(round(float(str(v).strip())))))
    except (TypeError, ValueError):
        return 0


def _as_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("true", "yes", "1")


def _clean_llm(raw) -> dict:
    if isinstance(raw, str):
        first, last = raw.find("{"), raw.rfind("}")
        if first == -1 or last == -1:
            raise gl.vm.UserError("LLM returned no JSON")
        raw = json.loads(raw[first : last + 1])
    if not isinstance(raw, dict):
        raise gl.vm.UserError("LLM returned non-object")
    return {
        "language_ok": _as_bool(raw.get("language_ok")),
        "language_score": _clamp10(raw.get("language_score")),
        "topic_match": _as_bool(raw.get("topic_match")),
        "topic_score": _clamp10(raw.get("topic_score")),
        "machine_translation_risk": _clamp10(raw.get("machine_translation_risk", 10)),
        "sources_score": _clamp10(raw.get("sources_score")),
        "summary": str(raw.get("summary", ""))[:280],
        "reason": str(raw.get("reason", ""))[:400],
    }


# ─────────────────────────── contract ───────────────────────────


class WikiSeed(gl.Contract):
    bounties: TreeMap[str, Bounty]
    attempts: DynArray[Attempt]
    next_id: u64
    links: TreeMap[Address, str]
    owners: TreeMap[str, Address]
    claimable: TreeMap[Address, u256]
    total_locked: u256
    total_paid: u256

    def __init__(self):
        self.next_id = 1

    # ── accounts ──

    @gl.public.write
    def link_wiki_account(self, username: str) -> str:
        user = _normalize_user(username)
        if not user or len(user) > 85 or re.search(r"[#<>\[\]|{}/]", user):
            raise gl.vm.UserError("Invalid Wikipedia username")
        key = user.lower()
        sender = gl.message.sender_address
        if key in self.owners and self.owners[key] != sender:
            raise gl.vm.UserError("Username already linked to another wallet")
        wallet = sender.as_hex.lower()

        def find_proof() -> str:
            for host in LINK_HOSTS:
                data = _api(
                    host,
                    {
                        "prop": "revisions",
                        "titles": f"User:{user}",
                        "rvprop": "user|content",
                        "rvslots": "main",
                    },
                )
                pages = data.get("query", {}).get("pages", [])
                if not pages or pages[0].get("missing"):
                    continue
                rev = (pages[0].get("revisions") or [{}])[0]
                content = rev.get("slots", {}).get("main", {}).get("content", "")
                if _normalize_user(rev.get("user", "")) == user and wallet in content.lower():
                    return host
            return ""

        host = gl.eq_principle.strict_eq(find_proof)
        if not host:
            raise gl.vm.UserError(
                "Proof not found: add your wallet address to your User page "
                "(meta.wikimedia.org, test.wikipedia.org or en.wikipedia.org) and save it yourself"
            )
        old = self.links.get(sender, "")
        if old and old.lower() != key and old.lower() in self.owners:
            del self.owners[old.lower()]
        self.links[sender] = user
        self.owners[key] = sender
        return host

    # ── bounties ──

    @gl.public.write.payable
    def create_bounty(
        self,
        wiki: str,
        language: str,
        topic: str,
        brief: str,
        min_words: int,
        min_refs: int,
        survival_hours: int,
        duration_days: int,
        not_before: int,
    ) -> str:
        reward = gl.message.value
        if reward == u256(0):
            raise gl.vm.UserError("Attach GEN as the reward")
        wiki = wiki.strip().lower()
        if not WIKI_CODE_RE.match(wiki):
            raise gl.vm.UserError("Invalid wiki code (e.g. fo, wo, qu, zgh, test)")
        language, topic, brief = language.strip(), topic.strip(), brief.strip()
        if not (1 <= len(language) <= 60) or not (3 <= len(topic) <= 160) or len(brief) > 600:
            raise gl.vm.UserError("Language/topic/brief length out of range")
        if not (50 <= min_words <= 20000) or not (0 <= min_refs <= 100):
            raise gl.vm.UserError("min_words must be 50..20000, min_refs 0..100")
        if not (0 <= survival_hours <= 2160) or not (1 <= duration_days <= 365):
            raise gl.vm.UserError("survival 0..2160h, duration 1..365 days")
        now = _now()
        if not_before <= 0:
            not_before = now
        if not_before > now:
            raise gl.vm.UserError("not_before cannot be in the future")

        bid = int(self.next_id)
        self.next_id = bid + 1
        self.bounties[str(bid)] = Bounty(
            id=bid,
            sponsor=gl.message.sender_address,
            wiki=wiki,
            language=language,
            topic=topic,
            brief=brief,
            min_words=min_words,
            min_refs=min_refs,
            survival_hours=survival_hours,
            created_at=now,
            not_before=not_before,
            deadline=now + duration_days * 86400,
            reward=reward,
            status="OPEN",
            claimant=Address(b"\x00" * 20),
            claim_user="",
            claim_title="",
            claim_pageid=0,
            claim_revid=0,
            claim_words=0,
            claim_refs=0,
            approved_at=0,
            closed_at=0,
            score_language=0,
            score_topic=0,
            score_mt_risk=0,
            score_sources=0,
            summary="",
            verdict="",
            attempts=0,
        )
        self.total_locked += reward
        return str(bid)

    def _get(self, bounty_id: str) -> Bounty:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("Unknown bounty")
        return self.bounties[bounty_id]

    def _log(self, b: Bounty, kind: str, user: str, title: str, revid: int, passed: bool, stage: str, reason: str, words: int, refs: int) -> None:
        b.attempts += 1
        self.attempts.append(
            Attempt(
                bounty_id=b.id,
                kind=kind,
                actor=gl.message.sender_address,
                user=user,
                title=title,
                revid=revid,
                at=_now(),
                passed=passed,
                stage=stage,
                reason=reason[:400],
                words=words,
                refs=refs,
            )
        )

    @gl.public.write
    def submit_claim(self, bounty_id: str, revid: int) -> dict:
        b = self._get(bounty_id)
        now = _now()
        if b.status != "OPEN":
            raise gl.vm.UserError(f"Bounty is {b.status}")
        if now > b.deadline:
            raise gl.vm.UserError("Bounty deadline passed")
        sender = gl.message.sender_address
        user = self.links.get(sender, "")
        if not user:
            raise gl.vm.UserError("Link your Wikipedia account first")
        if revid <= 0:
            raise gl.vm.UserError("Invalid revision id")

        host = _wiki_host(b.wiki)
        language, topic, brief = b.language, b.topic, b.brief
        min_words, min_refs, not_before = int(b.min_words), int(b.min_refs), int(b.not_before)

        def fetch_article():
            data = _api(
                host,
                {"prop": "revisions|info", "revids": str(revid), "rvprop": "ids|user|timestamp|content", "rvslots": "main"},
            )
            pages = data.get("query", {}).get("pages", [])
            if not pages or pages[0].get("missing") or not pages[0].get("revisions"):
                return {"found": False}, ""
            page = pages[0]
            rev = page["revisions"][0]
            content = rev.get("slots", {}).get("main", {}).get("content", "")
            first = _api(
                host,
                {"prop": "revisions", "pageids": str(page["pageid"]), "rvdir": "newer", "rvlimit": "1", "rvprop": "user|timestamp"},
            )
            frev = first["query"]["pages"][0]["revisions"][0]
            text = wikitext_to_text(content)
            refs = extract_refs(content)
            facts = {
                "found": True,
                "title": page.get("title", ""),
                "pageid": int(page["pageid"]),
                "ns": int(page.get("ns", -1)),
                "redirect": bool(page.get("redirect", False)) or content.lstrip().upper().startswith("#REDIRECT"),
                "creator": _normalize_user(frev.get("user", "")),
                "created_ts": frev.get("timestamp", ""),
                "words": count_words(text),
                "refs": len(refs),
            }
            ref_digest = "\n".join(f"- {wikitext_to_text(r)[:160] or r[:160]}" for r in refs[:20])
            return facts, text[:MAX_LLM_CHARS] + "\n\nREFERENCES:\n" + ref_digest

        def check_facts(f: dict) -> str:
            if not f.get("found"):
                return "Revision not found on " + host
            if f["ns"] != 0:
                return "Revision is not in the article namespace"
            if f["redirect"]:
                return "Page is a redirect"
            if f["creator"] != user:
                return f"Article was created by {f['creator']}, not {user}"
            if _parse_ts(f["created_ts"]) < not_before:
                return "Article was created before this bounty accepted submissions"
            if f["words"] < min_words:
                return f"Only {f['words']} words (needs {min_words})"
            if f["refs"] < min_refs:
                return f"Only {f['refs']} references (needs {min_refs})"
            return ""

        def build_prompt(material: str) -> str:
            return f"""You are a strict reviewer for a Wikipedia bounty program in under-served languages.

BOUNTY
- Required language: {language}
- Required topic: {topic}
- Sponsor brief: {brief or "(none)"}

ARTICLE (plain text extracted from wikitext, may be truncated)
<<<
{material}
>>>

Evaluate ONLY the article above and reply with a JSON object with exactly these keys:
- "language_ok": true if the article body is written in {language} (proper nouns and citations in other languages are fine)
- "language_score": integer 0-10, fluency and correctness of the {language} text
- "topic_match": true if the article is substantially about "{topic}"
- "topic_score": integer 0-10, how well it covers the topic and the sponsor brief
- "machine_translation_risk": integer 0-10, 10 = obviously raw/poor machine translation (calques, broken grammar, untranslated fragments)
- "sources_score": integer 0-10, relevance and reliability of the listed references (0 if none)
- "summary": one sentence in English describing the article
- "reason": at most two sentences in English justifying the scores
"""

        def leader_fn():
            facts, material = fetch_article()
            reason = check_facts(facts)
            if reason:
                return {"facts": facts, "passed": False, "stage": "facts", "reason": reason, "llm": {}}
            llm = _clean_llm(gl.nondet.exec_prompt(build_prompt(material), response_format="json"))
            ok = derive_pass(llm, min_refs)
            return {"facts": facts, "passed": ok, "stage": "llm", "reason": llm["reason"], "llm": llm}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            lead = leader_result.calldata
            mine = leader_fn()
            if lead.get("facts") != mine["facts"] or lead.get("stage") != mine["stage"]:
                return False
            if mine["stage"] == "llm" and derive_pass(lead.get("llm", {}), min_refs) != lead.get("passed"):
                return False  # leader's verdict must follow from its own scores
            if mine["stage"] == "facts":
                return lead.get("passed") == mine["passed"]
            # LLM stage: accept the leader's verdict unless our own review clearly
            # contradicts it (outside a one-point tolerance band).
            if lead.get("passed"):
                return derive_pass(mine["llm"], min_refs, slack=1)
            return not derive_pass(mine["llm"], min_refs, slack=-1)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        facts, llm = result["facts"], result.get("llm") or {}
        passed = bool(result["passed"])
        words, refs = int(facts.get("words", 0)), int(facts.get("refs", 0))
        self._log(b, "claim", user, facts.get("title", ""), revid, passed, result["stage"], result["reason"], words, refs)

        if passed:
            b.status = "APPROVED"
            b.claimant = sender
            b.claim_user = user
            b.claim_title = facts["title"]
            b.claim_pageid = facts["pageid"]
            b.claim_revid = revid
            b.claim_words = words
            b.claim_refs = refs
            b.approved_at = now
            b.score_language = llm.get("language_score", 0)
            b.score_topic = llm.get("topic_score", 0)
            b.score_mt_risk = llm.get("machine_translation_risk", 0)
            b.score_sources = llm.get("sources_score", 0)
            b.summary = llm.get("summary", "")
            b.verdict = result["reason"]
        return {"passed": passed, "stage": result["stage"], "reason": result["reason"], "words": words, "refs": refs}

    @gl.public.write
    def finalize(self, bounty_id: str) -> dict:
        b = self._get(bounty_id)
        if b.status != "APPROVED":
            raise gl.vm.UserError(f"Bounty is {b.status}")
        now = _now()
        ready_at = int(b.approved_at) + int(b.survival_hours) * 3600
        if now < ready_at:
            raise gl.vm.UserError(f"Survival window open for {ready_at - now} more seconds")

        host = _wiki_host(b.wiki)
        pageid, claimed = int(b.claim_pageid), int(b.claim_words)

        def leader_fn():
            data = _api(host, {"prop": "revisions|info", "pageids": str(pageid), "rvprop": "ids|content", "rvslots": "main"})
            pages = data.get("query", {}).get("pages", [])
            if not pages or pages[0].get("missing") or not pages[0].get("revisions"):
                return {"alive": False, "words": 0, "reason": "Article was deleted"}
            page = pages[0]
            content = page["revisions"][0].get("slots", {}).get("main", {}).get("content", "")
            if page.get("ns") != 0 or page.get("redirect") or content.lstrip().upper().startswith("#REDIRECT"):
                return {"alive": False, "words": 0, "reason": "Article was moved out or turned into a redirect"}
            words = count_words(wikitext_to_text(content))
            if words < claimed * SURVIVAL_RATIO:
                return {"alive": False, "words": words, "reason": f"Article shrank to {words} words (claimed {claimed})"}
            return {"alive": True, "words": words, "reason": "Article survived the review window"}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            return leader_result.calldata.get("alive") == leader_fn()["alive"]

        res = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        alive = bool(res["alive"])
        self._log(b, "finalize", b.claim_user, b.claim_title, int(b.claim_revid), alive, "survival", res["reason"], int(res["words"]), int(b.claim_refs))

        if alive:
            b.status = "PAID"
            b.closed_at = now
            self.claimable[b.claimant] = self.claimable.get(b.claimant, u256(0)) + b.reward
            self.total_locked -= b.reward
            self.total_paid += b.reward
        else:
            b.status = "OPEN"
            b.claimant = Address(b"\x00" * 20)
            b.claim_user = ""
            b.claim_title = ""
            b.claim_pageid = 0
            b.claim_revid = 0
            b.claim_words = 0
            b.claim_refs = 0
            b.approved_at = 0
            b.summary = ""
            b.verdict = res["reason"]
        return {"alive": alive, "reason": res["reason"], "words": int(res["words"])}

    @gl.public.write
    def cancel_bounty(self, bounty_id: str) -> None:
        b = self._get(bounty_id)
        if b.sponsor != gl.message.sender_address:
            raise gl.vm.UserError("Only the sponsor can cancel")
        if b.status != "OPEN":
            raise gl.vm.UserError(f"Bounty is {b.status}")
        self._refund(b, "CANCELLED")

    @gl.public.write
    def expire_bounty(self, bounty_id: str) -> None:
        b = self._get(bounty_id)
        if b.status != "OPEN":
            raise gl.vm.UserError(f"Bounty is {b.status}")
        if _now() <= b.deadline:
            raise gl.vm.UserError("Deadline not reached")
        self._refund(b, "EXPIRED")

    def _refund(self, b: Bounty, status: str) -> None:
        b.status = status
        b.closed_at = _now()
        self.claimable[b.sponsor] = self.claimable.get(b.sponsor, u256(0)) + b.reward
        self.total_locked -= b.reward

    @gl.public.write
    def withdraw(self) -> str:
        sender = gl.message.sender_address
        amount = self.claimable.get(sender, u256(0))
        if amount == u256(0):
            raise gl.vm.UserError("Nothing to withdraw")
        self.claimable[sender] = u256(0)
        _Recipient(sender).emit_transfer(value=amount)
        return str(amount)

    # ── views ──

    def _bounty_view(self, b: Bounty) -> dict:
        return {
            "id": str(b.id),
            "sponsor": b.sponsor.as_hex,
            "wiki": b.wiki,
            "language": b.language,
            "topic": b.topic,
            "brief": b.brief,
            "min_words": int(b.min_words),
            "min_refs": int(b.min_refs),
            "survival_hours": int(b.survival_hours),
            "created_at": int(b.created_at),
            "not_before": int(b.not_before),
            "deadline": int(b.deadline),
            "reward": str(b.reward),
            "status": b.status,
            "claimant": b.claimant.as_hex if b.claim_user else "",
            "claim_user": b.claim_user,
            "claim_title": b.claim_title,
            "claim_revid": int(b.claim_revid),
            "claim_words": int(b.claim_words),
            "claim_refs": int(b.claim_refs),
            "approved_at": int(b.approved_at),
            "closed_at": int(b.closed_at),
            "scores": {
                "language": int(b.score_language),
                "topic": int(b.score_topic),
                "mt_risk": int(b.score_mt_risk),
                "sources": int(b.score_sources),
            },
            "summary": b.summary,
            "verdict": b.verdict,
            "attempts": int(b.attempts),
        }

    @gl.public.view
    def get_bounties(self) -> list:
        return [self._bounty_view(self.bounties[str(i)]) for i in range(int(self.next_id) - 1, 0, -1) if str(i) in self.bounties]

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> dict:
        return self._bounty_view(self._get(bounty_id))

    @gl.public.view
    def get_attempts(self, bounty_id: str) -> list:
        out = []
        for a in self.attempts:
            if str(a.bounty_id) == bounty_id:
                out.append(
                    {
                        "kind": a.kind,
                        "actor": a.actor.as_hex,
                        "user": a.user,
                        "title": a.title,
                        "revid": int(a.revid),
                        "at": int(a.at),
                        "passed": a.passed,
                        "stage": a.stage,
                        "reason": a.reason,
                        "words": int(a.words),
                        "refs": int(a.refs),
                    }
                )
        return out[::-1]

    @gl.public.view
    def get_account(self, address: str) -> dict:
        addr = Address(address)
        return {"wiki_user": self.links.get(addr, ""), "claimable": str(self.claimable.get(addr, u256(0)))}

    @gl.public.view
    def get_stats(self) -> dict:
        counts = {"OPEN": 0, "APPROVED": 0, "PAID": 0, "EXPIRED": 0, "CANCELLED": 0}
        wikis = {}
        for k in self.bounties:
            b = self.bounties[k]
            counts[b.status] = counts.get(b.status, 0) + 1
            wikis[b.wiki] = wikis.get(b.wiki, 0) + 1
        return {
            "bounties": int(self.next_id) - 1,
            "by_status": counts,
            "wikis": len(wikis),
            "contributors": len(self.links),
            "total_locked": str(self.total_locked),
            "total_paid": str(self.total_paid),
        }
