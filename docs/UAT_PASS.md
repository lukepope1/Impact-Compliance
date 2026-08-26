# UAT pass — live functional walkthrough

Not a re-check against the original backlog/wireframe documents — those were chat
uploads at the start of this build and aren't accessible from this environment anymore
(see the note below). This is a live walkthrough of every portal's golden path against
the running app (server on :4100, a temporary client instance on :5174), verified via a
mix of browser interaction, direct API calls, and reading responses/console/network —
not a claim of pixel-parity with the original wireframes.

## What was tested and the result

**Impact portal** — logged in as `compliance@impactmarketplace.com`:
- C-01 Deal Portfolio — lists MILL-2025 correctly
- I-02 Deal Setup — profile, parties, CDE participations all render and the onboarding
  checklist reflects real state
- I-03 Requirement Builder — draft form, published requirement list, due rule display
- Deadlines — all 30 generated instances render, overdue highlighting and status
  computation correct (cross-checked against the raw API response)
- Documents & Evidence — upload form, version history, correct `pending` scan status
  with no ClamAV configured (fail-closed, as documented)
- I-01 Review Queue — correctly lists only the one `submitted` instance
- I-02 Requirement Review — decision buttons present; approved a real submission live,
  confirmed via API that the instance transitioned to `impact_approved`
- Issues, Audit Log — both render correctly; audit log shows real history from this and
  prior sessions with correct actor/action/object attribution
- Community Benefits Report — profile, jobs, benefits, tenants, service outcomes all
  render; **currency and count formatting confirmed correct** ($26,750,000 / 65 FTE),
  matching the earlier explicit formatting requirement
- Multi-CDE Shared Snapshot — golden record values, per-CDE approval table
- AMIS Readiness & Export — correctly blocked export while a field was missing, then
  generated a real CSV export live after filling the missing field via the deal PATCH
  route (also exercised the new `requireRoleOnDealOrg` fix on that route)

**QALICB portal** — logged in as `jane.doe@millenniumholdings.example`:
- Q-01 Dashboard — task list, overdue/returned counts correct
- Q-03 Requirement Detail & Upload — evidence panel, comment thread; "Review & Submit"
  correctly disabled with no draft/no attached evidence yet (an intentional gate, not a
  bug — a draft is only created on first upload)
- Community Benefits Report — write access confirmed working (same screen, QALICB-scoped)

**CDE portal** — logged in as `reviewer@enterprisecde.example` (a `cde_reviewer`, not
`cde_admin` — deliberately the lower-privilege seeded account, to test role gating):
- C-01 Portfolio Dashboard — only the CDE's own participating deal shown
- C-03 Review Queue — correctly empty (nothing at `impact_approved` yet at that point)
- Documents — correctly shows only `deal_shared` documents (CDE-private/QALICB-only
  documents correctly excluded)
- Multi-CDE Shared Snapshot — approved the snapshot live as this CDE; participant table
  updated to `approved` for Enterprise Financial CDE, `pending` still for HRV Sub-CDE 62
  — confirms the `requireRoleOnDealOrg("cde_admin", "cde_reviewer")` fix on the approve
  route works end-to-end from the actual UI, not just a curl test
- AMIS export generation correctly **rejected** for this `cde_reviewer` account
  (confirmed via direct API: 403) — the export route is gated to `cde_admin` plus
  deal-participation, and this account isn't `cde_admin`

**Cross-portal flow** — approved a submission as Impact, then confirmed live (via the
authenticated session) that the requirement instance's status flipped to
`impact_approved`, which is exactly the status the CDE review queue filters on —
closing the loop the review pipeline is built around.

## Rate limiting caught in the act

Partway through, further login attempts started returning `429 Too Many Requests` — the
rate limiter added during the security review pass (10 attempts / 15 min, IP-keyed)
correctly triggered from this session's own repeated test logins across three accounts.
Not a bug; direct confirmation the limiter works as designed under real traffic, not just
a synthetic test.

## A tooling issue, not an app issue

Partway through, the Browser pane stopped compositing frames on the viewer's end
(`screenshot` began failing with "the Browser pane is not displayed"), which meant
synthetic clicks stopped landing on the page — confirmed by contrast: earlier clicks in
this same session worked correctly (demo-account login, snapshot approval, CSV
generation, in-app navigation), and later clicks silently did nothing even though direct
`fetch()` calls to the same endpoints from the page's own JS context succeeded
immediately. Where clicks stopped working, the remaining checks were completed via
direct API calls hitting the identical server route and via reading the resulting state
back — functionally equivalent verification, just not literally screenshot-driven for
every step. This is flagged here for transparency, not glossed over.

## Bugs found

**None.** Every screen rendered correctly, every gated action was correctly gated
(including a live 403 against an under-privileged account), every recent fix (the
security review's `requireRoleOnDealOrg` middleware, the currency/number formatting
pass, the deadline sweep) held up under real interactive use, not just the isolated
curl/unit-style checks each was verified with at the time. One thing that looked like a
bug on first read — the Deadlines and Audit Log pages briefly showing "0 total" /
empty — turned out to be this session reading the page before its `useEffect` fetch had
resolved, not an actual defect; re-reading a beat later showed the real data.

## What this pass does not cover

- Pixel/layout fidelity against the original wireframe images (not accessible here)
- Exact wording/field-set match against the original backlog's acceptance criteria (same
  reason)
- Mobile/responsive layout, browser compatibility beyond this session's Chromium-based
  pane
- Load/concurrency testing
- The AWS/ClamAV/production-SMTP integrations — already separately documented in
  PHASED_PLAN.md as "reviewed, not proven live" where credentials aren't available here
