# Existing Jarvis semantic adoption scenario

This is an executable human contract for a three-path adoption evaluation. Run
each path from the same fixture snapshot and compare the recorded tree and
digests at its terminal state.

## Fixture

The consumer capability map declares `Identity` at `identity/SOUL.md` and
`Durable memory` at `state/MEMORY.md`. Its same-purpose memory skill lives at
`local-skills/remember/SKILL.md`; it curates the declared Durable memory role
and contains the named local extension `Weekly signal digest`. The single
established provenance authority is `CHANGELOG.md`.

The selected Jarvis Lite release is immutable and verifiable. Its memory
capability has the same purpose, trigger, authoritative role, mutation scope,
and approval boundary as the consumer skill, plus one compatible safety rule
that the local skill does not yet contain.

Before every path, record before and after tree and digest evidence with an
equivalent local command such as:

```sh
find existing-jarvis -type f -exec shasum -a 256 {} + | LC_ALL=C sort -k 2
```

The starting tree is:

```text
existing-jarvis/
├── PROFILE.md
├── CHANGELOG.md
├── identity/
│   └── SOUL.md
├── state/
│   └── MEMORY.md
└── local-skills/
    └── remember/
        └── SKILL.md
```

The semantic inventory must show that the consumer behavior is matched
semantically and classified `adapt`, not `add`, even though source and consumer
skill paths and names differ. It must name `Weekly signal digest` as a local
extension to preserve and `CHANGELOG.md` as the intended provenance target.

## Terminal state: no selection

Present the classified inventory and stop because the user does not select a
candidate. The terminal result is zero filesystem changes. The after tree and
every file digest exactly match the fixture baseline; there is no provenance
entry and no Git mutation.

## Terminal state: selection only

The user explicitly selects the memory capability. Display the exact proposed
patch to `local-skills/remember/SKILL.md` and the exact provenance entry for
`CHANGELOG.md`, including the immutable source release. Stop without applying
it because selection alone is not exact patch approval.

The terminal result is again zero filesystem changes. The after tree and every
file digest match the fixture baseline; there is no provenance entry and no Git
mutation.

## Terminal state: approved patch

Start from the fixture baseline. The user selects the memory capability. Show
the exact two-file patch, preservation decisions, and provenance entry. Apply
it only after a separate explicit approval of that displayed patch.

The existing skill is patched in place only after capability selection and
exact patch approval. Do not create a Lite-path duplicate. Re-read both changed
files and verify that the approved patch and provenance entry are the only
changes.

The after tree is identical to the starting tree. Digests for
`local-skills/remember/SKILL.md` and `CHANGELOG.md` change exactly as previewed;
all other digests remain equal to baseline. Identity, Durable memory contents,
capability paths, and the `Weekly signal digest` local extension remain
unchanged. Git state is not mutated by the workflow.
