# Personal improvements and scoped adoption recovery

Use this reference after verifying the immutable source. In a Lite update,
finish and report the release-managed update first, then evaluate optional
personal improvements, including when the installed release is already current.
In repository adoption, inspect this reference and its neighboring catalog at
the same resolved source commit. Neither route requires installing a new skill.

## Discover and contextualize

Read [personal-improvements.md](personal-improvements.md) from the selected
source. Compare each candidate with the consumer's actual authoritative
instructions, current core behavior, dependencies and local preferences.
Resolve roles through the consumer's own declarations, whatever their layout;
never infer that an arbitrary `soul.md` is authoritative.

Read the single existing decision/provenance record when one exists. Use an
existing changelog or adoption record; do not start a parallel ledger. If none
exists, propose an exact local path and minimal entry as part of the preview.
For a Lite consumer a possible new path is `.jarvis-update/personal-decisions.md`;
it is optional consumer metadata, outside the release-managed state file.

Classify each candidate as:

- **Already present:** the behavior is effective anywhere authoritative. Skip
  the patch and make no source-adoption claim.
- **Useful and compatible:** show a short proposal in the user's language,
  adapted to their style, paths and working agreements.
- **Conflicting or unavailable:** name the preference, authority or dependency
  that prevents adoption; leave that candidate pending without blocking others.
- **Previously declined:** skip the unchanged candidate ID unless the user
  explicitly reopens it. A newer release label alone does not reopen a choice.

An accepted ID is not proof that its behavior still exists: re-read the current
source. If the user later removed or changed it, honor that local change and
do not silently reinstate it. Explain the discrepancy only when relevant to
the current request. Existing equivalent behavior and current local preferences
take precedence over suggestions derived from a template.

## Choose the authorized writer

For each destination, identify its current authorized writer:

1. If the consumer uses `jarvis-memory` for Identity or Durable memory, delegate
   the exact candidate to that skill with its own preview/approval rules.
2. If another local workflow owns curation, follow it instead.
3. If no dedicated curator exists and local rules permit direct edits, the
   adoption agent may apply the smallest explicitly approved patch itself.

An installed but unavailable required curator, a rule reserving writes to a
missing curator, an ambiguous destination or a direct-write prohibition blocks
that mutation. Show the useful suggestion without bypassing the local rule.
Do not install a curator as an implicit dependency. If the target is managed
by another core, apply the consumer's ownership rules; this workflow does not
authorize an edit to that core or invent an override mechanism.

## Preview and decisions

Offer at most five useful candidates together. Each preview contains the
candidate ID, immutable source commit and release label, benefit, authoritative
destination, authorized writer, exact before/after text, local choices to
preserve, proposed record entry, and scoped recovery location.

Choices are **Apply**, **Edit**, **Skip for now**, and **Decline and remember**.
Selection of a capability is not approval of its exact patch. Core update
approval never approves a personal-file change. Wait for explicit approval of
the displayed personal patch, record entry and recovery scope; comply with
any stronger local confirmations. The curator's exact-patch approval can cover
this same displayed scope; do not add another identical approval round.

Skip or refusal means no filesystem writes. **Decline and remember** approves
only the displayed decision-record patch and its recovery, never a personal
content patch. If the user declines recording too, do not persist the choice
or promise to remember it across chats. Pending personal proposals do not
invalidate a completed core update or completed functional adoption.

Record only the ID, accepted/declined decision, immutable source and concise
destination/reason needed to avoid repetition. Use the established record's
format. Do not duplicate the user's Soul or personal facts in the log. A
successful capability adoption's record belongs in the same approved scope.

## Prepare recovery, apply, verify

For a personal patch or functional adoption, use
`scripts/adoption_recovery.py` alongside this reference. It uses the Python 3
standard library and changes no personal content during preparation. An
equivalent existing local mechanism may be used if it proves the same scoped
preconditions, original copies and result. If neither is available, present
the proposal but stop before mutation; do not install dependencies silently.

The helper accepts only regular-file additions and edits. Symlinks, hardlinks,
Git internals and paths outside the consumer are rejected. It does not apply
or semantically merge the patch. The local authorized writer remains responsible.

1. Prepare proposed file contents and a plan outside the consumer. Include all
   approved content and decision/provenance paths. Capture hashes of the exact
   reviewed originals and proposed contents. Show the exact patch and recovery
   path before approval.
2. After approval, run `prepare --consumer ... --plan ... --approved`. This
   rechecks every original and proposed hash, then saves original bytes in the
   displayed `.jarvis-adoption/recovery/<operation-id>/` directory. No recovery
   directory is created if the reviewed preconditions already changed.
3. Immediately before editing, run `inspect`. Proceed only when every path is
   unchanged from the approved baseline (a no-op path may already match both).
   Re-read each destination before its patch. On a change, stop and replan;
   never merge during application without a new preview.
4. The authorized writer applies only the approved patch. Write its adoption
   record after the content succeeds. Stop on the first failure.
5. Run `verify`. Success requires every content and record file to match the
   proposed bytes. Also check the behavior's dependencies and affected links;
   hashes prove the patch, not that an agent will follow its meaning.
6. Report applied/skipped/blocked/partial, the source and scoped recovery path.
   Remove external proposal scratch after verification; retain recovery until
   the user approves its cleanup. Recovery may contain private original bytes:
   keep it local, out of commits/public artifacts, and follow existing backup
   rules. Each recovery directory ignores its own files with a local
   `.gitignore`; the consumer's root ignore file and Git configuration are
   unchanged. Do not force-add recovery files to Git.

Run `python3 scripts/adoption_recovery.py --help` for subcommands. A plan has
this shape (compute real hashes; angle-bracket values below are placeholders):

```json
{
  "source": {"label": "v0.5.0", "commit": "<full resolved 40-character commit>"},
  "capabilities": ["soul-proactive-help-v1"],
  "record_path": "CHANGELOG.md",
  "recovery": ".jarvis-adoption/recovery/<unique-operation-id>",
  "changes": [
    {
      "path": "profile/character.md",
      "before_sha256": "<reviewed original SHA-256, or null for a new file>",
      "after_file": "/absolute/external-staging/character-after.md",
      "after_sha256": "<reviewed proposed SHA-256>"
    },
    {
      "path": "CHANGELOG.md",
      "before_sha256": "<reviewed record SHA-256>",
      "after_file": "/absolute/external-staging/changelog-after.md",
      "after_sha256": "<reviewed proposed record SHA-256>"
    }
  ]
}
```

These example consumer paths are not fallback destinations. The resolved
source commit is recorded evidence, not a substitute for verifying the source
artifact or checkout before executing its helper.

## Interruption and rollback

`inspect --consumer ... --recovery ...` is read-only and derives each file's
state from actual hashes: unchanged, applied, or diverged. A mixed result is
partial; it is never reported as completed. There is no automatic continuation.
After interruption, inspect existing recovery before creating another one.
If every file is applied, verify and report completion without applying twice.
Otherwise show the observed state and propose a newly reviewed remaining patch
or a scoped rollback. A new chat or recovered record does not itself convey
approval to write.

After explicit approval of the displayed restore scope, use `rollback
--consumer ... --recovery ... --approved`. Local personal-file protections
still apply. All originals and current file hashes are checked before any
restore; a newer edit or corrupt backup blocks the operation. Restore only
recorded original bytes and remove only new files created by the approved
patch. Empty directories and recovery evidence are retained. A filesystem
failure during rollback is reported as partial and requires reinspection.

Work serially in the affected files: this helper does not lock concurrent
writers or promise recovery after disk loss. Lite's existing release update
recovery remains separate. If a later personal adoption touched a file also
covered by an earlier recovery, that earlier rollback must stop on the newer
content rather than erase it.
