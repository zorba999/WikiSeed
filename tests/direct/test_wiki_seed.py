import json

import pytest
from gltest.direct.loader import create_address

CONTRACT = "contracts/wiki_seed.py"
GEN = 10**18

ARTICLE = (
    "'''Havnin í Tórshavn''' er ein av elstu havnunum í Føroyum. "
    + "Havnin hevur verið miðdepil fyri handil og fiskiskap í øldir. " * 60
    + "<ref>{{cite web|url=https://www.visittorshavn.fo|title=Visit Tórshavn}}</ref>"
    + "<ref>{{cite book|title=Føroya søga|publisher=Føroya Skúlabókagrunnur}}</ref>"
    + "<ref name=\"a\">Tórshavnar kommuna, 2019</ref> <ref name=\"a\" />"
    + "\n[[Bólkur:Tórshavn]]"
)

GOOD_LLM = json.dumps(
    {
        "language_ok": True,
        "language_score": 8,
        "topic_match": True,
        "topic_score": 9,
        "machine_translation_risk": 2,
        "sources_score": 7,
        "summary": "History of the port of Tórshavn.",
        "reason": "Fluent Faroese, on topic, reasonable sources.",
    }
)


def body(obj) -> dict:
    return {"status": 200, "body": json.dumps(obj)}


def mock_user_page(vm, user, wallet_hex):
    vm.mock_web(
        r"meta\.wikimedia\.org/w/api\.php.*titles=User",
        body({"query": {"pages": [{"title": f"User:{user}", "revisions": [{"user": user, "slots": {"main": {"content": f"Hi! WikiSeed wallet: {wallet_hex}"}}}]}]}}),
    )


def mock_article(vm, creator="Alice Writer", content=ARTICLE, created="2030-01-02T00:00:00Z"):
    vm.mock_web(
        r"fo\.wikipedia\.org/w/api\.php.*revids=",
        body({"query": {"pages": [{"pageid": 42, "ns": 0, "title": "Havnin í Tórshavn", "revisions": [{"revid": 777, "user": creator, "timestamp": created, "slots": {"main": {"content": content}}}]}]}}),
    )
    vm.mock_web(
        r"fo\.wikipedia\.org/w/api\.php.*rvdir=newer",
        body({"query": {"pages": [{"pageid": 42, "revisions": [{"user": creator, "timestamp": created}]}]}}),
    )


def mock_current(vm, content=ARTICLE, missing=False):
    page = {"pageid": 42, "missing": True} if missing else {"pageid": 42, "ns": 0, "title": "Havnin í Tórshavn", "revisions": [{"revid": 800, "slots": {"main": {"content": content}}}]}
    vm.mock_web(r"fo\.wikipedia\.org/w/api\.php.*rvprop=ids%7Ccontent", body({"query": {"pages": [page]}}))


@pytest.fixture
def setup(direct_vm, direct_deploy):
    direct_vm.warp("2030-01-01T00:00:00Z")
    sponsor, alice = create_address("sponsor"), create_address("alice")
    c = direct_deploy(CONTRACT)
    direct_vm.sender = sponsor
    direct_vm.value = 5 * GEN
    bid = c.create_bounty("fo", "Faroese", "History of the port of Tórshavn", "", 300, 2, 24, 30, 0)
    direct_vm.value = 0
    return c, sponsor, alice, bid


def link(vm, c, who, user="Alice Writer"):
    vm.sender = who
    mock_user_page(vm, user, "0x" + who.hex())
    return c.link_wiki_account(user.replace(" ", "_"))


def test_create_bounty(setup):
    c, sponsor, _, bid = setup
    b = c.get_bounty(bid)
    assert b["status"] == "OPEN" and b["reward"] == str(5 * GEN) and b["wiki"] == "fo"
    assert c.get_stats()["total_locked"] == str(5 * GEN)


def test_create_requires_value(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("Attach GEN"):
        c.create_bounty("fo", "Faroese", "Topic here", "", 300, 2, 24, 30, 0)


def test_link_account(direct_vm, setup):
    c, _, alice, _ = setup
    assert link(direct_vm, c, alice) == "meta.wikimedia.org"
    assert c.get_account("0x" + alice.hex())["wiki_user"] == "Alice Writer"


def test_link_rejects_missing_proof(direct_vm, setup):
    c, _, alice, _ = setup
    direct_vm.sender = alice
    mock_user_page(direct_vm, "Alice Writer", "0xdeadbeef")
    direct_vm.mock_web(r"(test|en)\.wikipedia\.org", body({"query": {"pages": [{"missing": True}]}}))
    with direct_vm.expect_revert("Proof not found"):
        c.link_wiki_account("Alice Writer")


def test_full_flow_claim_finalize(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", GOOD_LLM)
    direct_vm.warp("2030-01-03T00:00:00Z")
    res = c.submit_claim(bid, 777)
    assert res["passed"] is True, res
    assert direct_vm.run_validator() is True
    b = c.get_bounty(bid)
    assert b["status"] == "APPROVED" and b["claim_user"] == "Alice Writer" and b["claim_refs"] == 3
    assert b["scores"]["language"] == 8

    with direct_vm.expect_revert("Survival window"):
        c.finalize(bid)

    direct_vm.warp("2030-01-04T01:00:00Z")
    mock_current(direct_vm)
    out = c.finalize(bid)
    assert out["alive"] is True
    assert c.get_bounty(bid)["status"] == "PAID"
    assert c.get_account("0x" + alice.hex())["claimable"] == str(5 * GEN)
    assert len(c.get_attempts(bid)) == 2


def test_validator_rejects_lying_leader(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", GOOD_LLM)
    direct_vm.warp("2030-01-03T00:00:00Z")
    res = c.submit_claim(bid, 777)
    assert res["passed"]
    fake = {"facts": {"found": True, "words": 99999}, "passed": True, "stage": "llm", "reason": "", "llm": {}}
    assert direct_vm.run_validator(leader_result=fake) is False


def test_claim_too_short_stays_open(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm, content="Stutt grein. <ref>x</ref><ref>y</ref>")
    direct_vm.warp("2030-01-03T00:00:00Z")
    res = c.submit_claim(bid, 777)
    assert res["passed"] is False and res["stage"] == "facts" and "words" in res["reason"]
    assert c.get_bounty(bid)["status"] == "OPEN"
    assert c.get_attempts(bid)[0]["passed"] is False


def test_claim_wrong_creator(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm, creator="Someone Else")
    direct_vm.warp("2030-01-03T00:00:00Z")
    res = c.submit_claim(bid, 777)
    assert res["passed"] is False and "created by" in res["reason"]


def test_claim_llm_rejects_machine_translation(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm)
    bad = json.loads(GOOD_LLM)
    bad["machine_translation_risk"] = 9
    direct_vm.mock_llm(r"Wikipedia bounty", json.dumps(bad))
    direct_vm.warp("2030-01-03T00:00:00Z")
    res = c.submit_claim(bid, 777)
    assert res["passed"] is False and res["stage"] == "llm"


def test_finalize_deleted_reopens(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", GOOD_LLM)
    direct_vm.warp("2030-01-03T00:00:00Z")
    c.submit_claim(bid, 777)
    direct_vm.warp("2030-01-05T00:00:00Z")
    mock_current(direct_vm, missing=True)
    assert c.finalize(bid)["alive"] is False
    assert c.get_bounty(bid)["status"] == "OPEN"


def test_claim_requires_link(direct_vm, setup):
    c, _, alice, bid = setup
    direct_vm.sender = alice
    with direct_vm.expect_revert("Link your Wikipedia"):
        c.submit_claim(bid, 777)


def test_cancel_and_expire(direct_vm, setup):
    c, sponsor, alice, bid = setup
    direct_vm.sender = alice
    with direct_vm.expect_revert("Only the sponsor"):
        c.cancel_bounty(bid)
    with direct_vm.expect_revert("Deadline not reached"):
        c.expire_bounty(bid)
    direct_vm.warp("2030-03-01T00:00:00Z")
    c.expire_bounty(bid)
    assert c.get_bounty(bid)["status"] == "EXPIRED"
    assert c.get_account("0x" + sponsor.hex())["claimable"] == str(5 * GEN)



def test_validator_tolerates_borderline_scores(direct_vm, setup):
    c, _, alice, bid = setup
    link(direct_vm, c, alice)
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", GOOD_LLM)
    direct_vm.warp("2030-01-03T00:00:00Z")
    assert c.submit_claim(bid, 777)["passed"]
    # validator's own LLM is slightly harsher (5/10) -> still within tolerance
    borderline = json.loads(GOOD_LLM)
    borderline["language_score"] = 5
    direct_vm.clear_mocks()
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", json.dumps(borderline))
    assert direct_vm.run_validator() is True
    # a clearly failing review (3/10) must reject the leader's approval
    borderline["language_score"] = 3
    direct_vm.clear_mocks()
    mock_article(direct_vm)
    direct_vm.mock_llm(r"Wikipedia bounty", json.dumps(borderline))
    assert direct_vm.run_validator() is False
