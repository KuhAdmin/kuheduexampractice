# Content Promotion Playbook (Local → Production)

Operational guide for `npm run promote:content`, the tool that pushes locally
reviewed/approved pipeline content (chapters, concepts, assessment items,
memory-hook images/video) from your local Postgres to production, without
running the generation pipeline against the production server.

There are two interchangeable ways to run it:
- **Node CLI**: `npm run promote:content` (§2–3 below). The primary, most
  exercised path.
- **SQL stored procedure**: `promote_content_to_production(...)`, runnable
  straight from pgAdmin's Query Tool with no Node/terminal access — see §8.
  Same algorithm, same safety properties, verified against the same test
  scenarios as the CLI (idempotent rerun, real student data survival, array/
  jsonb column fidelity).

For the technical design (table order, FK handling, why it's shaped this
way), see the plan history / `server/scripts/lib/generationTree.js` and
`promoteContent.js` header comments. This doc is the "how do I actually run
it" reference.

---

## 1. One-time setup

1. **`pg_dump` reachable.** The script shells out to `pg_dump` for a
   pre-promotion backup. Confirm it works standalone:
   ```
   pg_dump --version
   ```
   If that works in your shell but the script still fails with
   `spawn pg_dump ENOENT`, don't fight PATH — set `PG_DUMP_PATH` in `.env`
   to the full executable path instead (Node's `execFile` has known PATH
   resolution edge cases on Windows independent of what your shell sees):
   ```
   PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
   In Powershell::
   PS c>$env:Path += ";C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
   ```
   (adjust the version number to match your install; find it via
   `Get-ChildItem "C:\Program Files\PostgreSQL"`). Defaults to plain
   `pg_dump` (relies on PATH) if unset.

   A missing/misconfigured `pg_dump` fails safely — the backup step runs
   *before* any write transaction opens, so nothing is written to
   production if this step fails.

2. **`PRODUCTION_DATABASE_URL`** in `server/.env` (or workspace-root `.env`):
   ```
   PRODUCTION_DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
   ```
   Required for **both** `--dry-run` and `--confirm` — dry-run reads from
   production too (read-only) to check whether business-key resolution
   (chapters, documents) will succeed.
   - **Check whether your GUI client (e.g. pgAdmin4) uses an SSH tunnel for
     the production connection before assuming direct access works** — a
     server being "registered" in pgAdmin does NOT mean it's a direct TCP
     connection. Right-click the production server → Properties → **SSH
     Tunnel** tab. If "Use SSH tunneling" is on, direct connections to
     that host on the Postgres port will time out (not error immediately —
     the TCP handshake just hangs, since the port typically isn't exposed
     publicly at all on a self-managed VM).
   - If SSH tunneling is on, open an equivalent tunnel yourself before
     running the script, using the exact Tunnel host/port/username from
     that same tab, and leave it running in its own terminal:
     ```
     ssh -N -L 5433:localhost:5432 kuhedu@187.77.187.218
     ```
     Then point `PRODUCTION_DATABASE_URL` at `localhost:<local-port>`
     instead of the VM's public IP — same database credentials, just routed
     through the tunnel. (`localhost:5432` in the `-L` flag is what the SSH
     server forwards to *from inside the VM*, i.e. Postgres on that same
     box listening on localhost — confirm this matches pgAdmin's
     Connection tab "Host" value, usually `localhost`/`127.0.0.1`, if it
     differs adjust accordingly.)
   - Only if the SSH Tunnel tab shows tunneling **off** is a direct
     `<host>:<port>` connection actually in play — in that case use the
     Connection tab's host/port/database as-is.

3. **`DATABASE_URL`** (your normal local dev DB) must already point at the
   Postgres instance where you ran the pipeline and did your review.

4. **Watch out for identically-named databases on different servers.**
   It's common to have a local and a production database both literally
   named the same thing (e.g. both called `kuhedu_practice`), distinguished
   only by which server/host they live under — exactly the situation if
   your GUI client shows the same database name nested under two different
   server entries. It's easy to copy-paste the wrong host into `DATABASE_URL`
   or `PRODUCTION_DATABASE_URL` in that setup. The script refuses to run if
   the two env vars resolve to the same host+port+database (even with
   different credentials), but double-check the host in each connection
   string yourself before your first promotion too — the automated check is
   a backstop, not a substitute for reading what you typed.

---

## 2. Standard workflow

### Step 1 — Generate and fix content locally
Run the pipeline (Admin Workbench) against your **local** database as
usual. Iterate on errors locally — no redeployment needed to retry a layer.

### Step 2 — Review and approve locally
Use the existing admin review UI to approve/reject layers. Promotion's
"approved" predicate exactly mirrors what that UI shows you
(`is_selected = TRUE AND approval_status <> 'rejected' AND` the pipeline run
`status = 'completed'`) — if you can see it as approved in the review UI,
it's eligible for promotion.

### Step 3 — Dry run
From `server/`:
```
npm run promote:content -- --dry-run
```
This prints, **without touching production**:
- How many assessment units / layer versions / sections / documents would
  be promoted.
- Per `source_document`: whether it already exists in prod or is new.
- Per `source_section`: whether its chapter resolves against production's
  `mst_chapter` table. **A `MISSING` result here means promotion will fail
  on that section** — the chapter/book/level/exam-goal combination doesn't
  exist in production yet. Fix the master-data seed in production (or the
  section's `fk_mst_chapter_id` locally) before proceeding.
- Any assessment units being **skipped** (see §4 below) with the reason.

Read the whole output before moving on. This step is safe to run as often
as you like.

### Step 4 — Promote
```
npm run promote:content -- --confirm
```
- Prints a summary and pauses 3 seconds (Ctrl+C to abort) before writing.
- Takes a `pg_dump` snapshot of every in-scope table into
  `server/runtime/promotion-backups/<timestamp>/` first — prints a line per
  table as it completes, so you can tell it's progressing rather than stuck.
- Does everything in **one transaction** — a failure partway through rolls
  back completely, production is left untouched.
- **If `PRODUCTION_DATABASE_URL` goes through an SSH tunnel, expect this to
  be genuinely slow, not hung.** Every row is its own individually-awaited
  round trip (no batching) — a full first-time promotion can take 15–20+
  minutes over a tunnel with real per-request latency, even though the same
  data promotes in a few seconds between two local databases. The script
  prints a timestamped progress line per table (`[12.3s] [24/51]
  layer6_assessment_item: 274 row(s) (1840ms)`) through the whole run — as
  long as that keeps advancing, it's working. It only looks identical to a
  hang if you aren't watching the output; it does not fail silently.
- On success, writes a summary to
  `server/runtime/promotion-logs/<timestamp>.json` and prints the log path.

### Step 5 — Verify in production
Spot-check a couple of the promoted chapters/sections/assessment items in
the production app (or via the admin UI pointed at production, if you have
one). Confirm:
- The content renders correctly.
- The student "what's new" feed shows an entry for the newly-promoted
  section(s) (this is generated fresh at promotion time, not copied from
  local, so it should be dated *now*, not when you originally ran the
  pipeline).

---

## 3. Fixing a production error without a redeploy

This is the "quick-fix locally, push the fix" loop the tool exists for:

1. Reproduce/fix the issue **locally** — rerun the affected pipeline layer
   for that assessment unit, or edit content via the admin UI.
2. Re-approve it locally (this creates a new `generation_id` for that
   layer, marked `is_selected = TRUE`).
3. Promote just that unit:
   ```
   npm run promote:content -- --confirm --assessment-unit=<assessment_unit_id>
   ```
   This retires the old (superseded) generation in production and installs
   the new one, leaving every other assessment unit untouched. Faster and
   lower-risk than a full sweep when you only fixed one thing.
4. Verify, as in Step 5 above.

You can also `--dry-run --assessment-unit=<id>` first if you want to
preview just that one unit.

---

## 4. What gets promoted (and what's deliberately skipped)

| Promoted | Not promoted (and why) |
|---|---|
| `source_document`, `source_section` (+ OCR/image/parse artifacts) | `question_bank_item`, `practice_set`, `practice_set_item` — these self-heal per environment via existing lazy-materialization logic; copying them would just create stale duplicates |
| All layer 1–7 content tables (concepts, structures, assessment items, hints, etc.) | `layer_input_contract`/`_output_contract`, `assessment_pipeline_run`(+`_layer`) — local pipeline-execution bookkeeping, never read by anything student-facing |
| `layer_run` — **not** just bookkeeping despite being pipeline-execution metadata; see §9, it's required for flashcards/diagrams/section-overview text to resolve at all | `audit_event` — no stable identity, not reviewable content |
| `assessment_unit` (upserted **in place** — never deleted, see §6) | |
| `memory_hook_media` (images **and** video — this is the media promotion, no separate asset step needed) | `content_update_event` rows aren't copied — the tool emits a **fresh** one per promoted section, timestamped at promotion time, so local iteration doesn't spam the student feed with backdated entries |

**A unit is skipped** if its layer‑1 pipeline run isn't `status = 'completed'`
locally (layer 1 has no separate approval step — it's implicitly approved
once its run finishes; see `moderationService.js`). The dry-run output lists
skipped units by name.

---

## 5. Rollback

There's no automated undo command by design — the pre-promotion `pg_dump`
snapshot is the safety net:

1. Find the relevant backup: `server/runtime/promotion-backups/<timestamp>/`
   (one `.sql` file per table, `--data-only`).
2. Restore the affected table(s) against production:
   ```
   psql <PRODUCTION_DATABASE_URL> -f server/runtime/promotion-backups/<timestamp>/<table>.sql
   ```
   Restore tables in the same dependency order the promotion used (parents
   before children) if restoring more than one.
3. If you only need to restore *some* rows, use the same file as a
   reference and hand-write a targeted `DELETE`/`INSERT` — the dump is
   plain SQL, so this is straightforward.

Test that a backup actually restores cleanly against a scratch database
occasionally — an untested backup is not a real safety net.

---

## 6. Why some behaviors look unusual (read before debugging)

- **`assessment_unit` is never deleted, only updated in place.** A real
  production DB has student data (`student_mastery`, etc.) that
  `ON DELETE CASCADE`s off `assessment_unit`. Deleting-and-reinserting it
  (even with the same business key) would silently destroy that data. If
  you're tracing promotion code and wondering why `assessment_unit` gets
  special-cased everywhere, this is why.
- **One `generation_id` can cover many assessment units.** A single
  layer‑1 pipeline run typically extracts every concept/unit from one
  section at once, all sharing that generation's id. Promotion batches by
  the whole run, not per-unit, for this reason.
- **Re-running promotion with nothing changed locally is a safe no-op**
  (verified: row counts, ids, existing student data, and the
  `content_update_event` count all stay identical — an idempotent rerun
  does not spam the student "what's new" feed with duplicate entries). If a
  promotion is interrupted or you're unsure whether it landed, it's safe to
  just run it again.
- **The "retire a superseded generation" path** (re-promoting a unit that
  was already live, where the fix replaces old content) is exercised by
  the code but wasn't validated against a full "already-promoted-once,
  now-fixed-and-repromoted" scenario end-to-end before first use. Watch
  the output the first few times you use `--assessment-unit` for a
  previously-promoted unit.

---

## 7. Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Refusing to run: pass --dry-run ... or --confirm ...` | Ran the script with neither flag | Add `--dry-run` or `--confirm` |
| `Refusing to run: DATABASE_URL and PRODUCTION_DATABASE_URL resolve to the same host+port+database` | Both env vars point at the same server+database (see §1.4) — a copy-paste mistake, not a real "promote local into itself" scenario | Fix whichever env var has the wrong host/port |
| `PRODUCTION_DATABASE_URL is not set` | Missing env var | Add it to `.env` (see §1) |
| `pg_dump backup failed ... spawn pg_dump ENOENT` even though `pg_dump --version` works fine standalone in your shell | Node's `execFile` (no shell) has Windows-specific PATH resolution edge cases distinct from your interactive shell's PATH | Set `PG_DUMP_PATH` in `.env` to the full `pg_dump.exe` path — see §1.1, don't waste time re-fighting PATH |
| Dry-run shows `chapter resolves to prod mst_chapter.id=MISSING` | Chapter/book/level/exam-goal combination doesn't exist in production's master data | Seed the missing `mst_chapter`/`mst_book` row in production, or fix the local section's chapter link |
| `source_document id=... has no document_code` / `source_section id=... has no section_code` | Content was created without a stable business key | Set `document_code`/`section_code` on the local row before promoting — promotion refuses to guess |
| `Cannot promote <table>.<col> -> <table>.id = ...: no production id recorded` | A generation-tree table references something outside the resolved set (rare; would indicate a schema change this tool hasn't been updated for) | Stop and investigate — do not retry blindly; this is a correctness guard, not a transient error |
| Promotion rolls back with a Postgres FK/constraint error | Something in the transaction hit a constraint | Nothing was written (single transaction) — safe to fix the root cause and retry |
| `Connection terminated due to connection timeout` / `Connection terminated unexpectedly` when connecting to production (local read succeeds first — the dry-run report prints fine, then it fails) | The TCP handshake to `PRODUCTION_DATABASE_URL`'s host never completes — almost always means the production Postgres port isn't directly reachable (self-managed VM with Postgres bound to localhost, only SSH exposed) even if a GUI client shows it "connected" | Check whether your GUI client uses an SSH tunnel for that connection (see §1.2) — if so, open the same tunnel yourself and point `PRODUCTION_DATABASE_URL` at `localhost:<forwarded-port>` |
| `password authentication failed for user "<x>"` (code `28P01`) once the connection itself succeeds (past any tunnel/timeout issue) | Wrong username and/or password in `PRODUCTION_DATABASE_URL`. Don't assume the role is `postgres` — self-managed setups often use a dedicated non-superuser role (check pgAdmin's Connection tab, not the SSH Tunnel tab) | Fix the username/password in the URL; percent-encode any special characters in the password (`@`→`%40`, `#`→`%23`, etc.) or the connection string won't parse as intended |

---

## 8. SQL stored procedure (pgAdmin, no Node required)

`server/scripts/sql/promote_content.sql` is a full SQL/`dblink` port of the
same algorithm, for running straight from pgAdmin's Query Tool (or `psql`)
without a terminal/Node setup. It runs **from your local database**, opening
an outbound connection to production — this works with outbound-only
network access (laptop → prod); production never needs to reach back to
your machine.

**Install (once, against your LOCAL database):**
```sql
\i server/scripts/sql/promote_content.sql
```
or open the file in pgAdmin's Query Tool (connected to your **local**
server) and execute it. It creates the `dblink` extension and a set of
`_promo_*` helper functions plus the main entry point,
`promote_content_to_production`.

**Usage (also run against LOCAL — the function lives there and reaches out
to prod via the connection string you pass it):**
```sql
-- Dry run, everything
SELECT promote_content_to_production(
  'host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>',
  NULL, TRUE
);

-- Promote everything currently approved locally
SELECT promote_content_to_production(
  'host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>',
  NULL, FALSE
);

-- One assessment unit (fix-and-repromote loop)
SELECT promote_content_to_production(
  'host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>',
  'BIO-AU-1-001', FALSE
);
```
The first argument is a standard libpq connection string (space-separated
`key=value` pairs, not a `postgresql://` URL). Output comes through
`RAISE NOTICE` — watch pgAdmin's **Messages** tab (or `psql`'s stdout).

**What it does NOT give you that the Node CLI does:**
- No `pg_dump` pre-promotion backup — take one yourself first if you want
  that safety net (`pg_dump --data-only` against production, same as §1.1).
- No `server/runtime/promotion-logs/` audit trail — the `RAISE NOTICE`
  output is your only record of what a given run did, so keep the
  Messages/output pane open and copy it somewhere if you need a paper
  trail.
- Slower — it processes rows one at a time over individual `dblink` calls
  rather than the CLI's batched queries. Fine for normal promotion sizes;
  noticeably slower on a very large first-time sweep.

Both implementations were built to mirror each other exactly and were
verified against the same test scenarios (idempotent rerun with real
student data present, `text[]`/`jsonb` column fidelity, row counts matching
row-for-row against the same dataset). If you ever notice them disagree on
what gets promoted, that's a bug — not an expected difference.

---

## 9. Incident: flashcards/diagrams silently empty after promotion (fixed)

**What happened:** `layer_run` was originally excluded from promotion as
"local-only pipeline-execution bookkeeping, never read by student-facing
code." That was wrong. `getLatestLayer1GenerationForSection()`
(`assessmentStudioContextAssembler.js`) — the *only* path flashcards,
diagrams, and section-overview text use to resolve which generation is
currently active for a section — reads `layer_run` directly. With it never
promoted, that lookup silently returned nothing in production, so those
three features showed empty even though their actual content
(`layer1_terminology`, `layer1_diagram`, `layer1_knowledge_contract`) had
promoted correctly. Concept-level practice/assessment questions were **not**
affected — that path resolves generations via `layer_generation_version`/
`assessment_unit.generation_id`, which were always promoted correctly.

**Fix:** `layer_run` is now promoted (both the CLI and the SQL stored
procedure), with `pipeline_job_id`/`parent_generation_id`/`created_by`
nulled out (those reference tables/identities that are still, deliberately,
out of scope — see the table in §4).

**If you promoted content before this fix:** just run promotion again
(`--confirm`, no special flag needed). The fix isn't gated behind "did
anything change" — a plain rerun backfills `layer_run` for every
currently-selected generation, including ones that were already promoted
and haven't changed since. This is exactly the idempotent-rerun-as-a-no-op
property described in §6, just doing real (additive) work this one time.

---

## Quick reference

```bash
cd server

# Preview only, no writes
npm run promote:content -- --dry-run

# Promote everything currently approved locally
npm run promote:content -- --confirm

# Preview / promote just one assessment unit (fix-and-repromote loop)
npm run promote:content -- --dry-run  --assessment-unit=<assessment_unit_id>
npm run promote:content -- --confirm --assessment-unit=<assessment_unit_id>
```
