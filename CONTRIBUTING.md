# Contributing to Jarvis-Lite

Jarvis-Lite is a public, harness-agnostic starting point for a personal AI
collaborator. Contributions should make it easier to start, understand, adapt,
or safely evolve Jarvis.

For maintainer navigation and ownership boundaries, read [AGENTS.md](AGENTS.md)
and the [architecture overview](docs/architecture.md).

This file is the canonical contribution workflow. Issue and pull-request
templates collect its evidence; they do not define another process.

## Public repository boundary

Contributions contain only public material. Never include credentials, private
identities, customer content, internal hosts, private repository paths, private
Git history, or details copied from a personal Jarvis installation.

Identify third-party material and confirm its compatible license before review.
Behavioral inspiration is acceptable; copying private files or history is not.

## Workflow

```text
Issue -> branch -> pull request -> verification -> squash merge
```

Open an issue before non-trivial work, including new skills, structural
changes, multi-session work, safety changes, packaging, and release behavior.
One issue owns one independently reviewable outcome.

All changes reach `main` through a pull request. No external approval is
required while the project has one maintainer, but the author still performs
final review and records evidence.

## Branches and commits

Create a short-lived branch from current `main`. Prefer names such as
`feat/save-session-git`, `fix/diary-contract`, or `docs/installation-flow`.
Agent runtimes may add a short namespace, such as
`codex/contribution-workflow`, when their environment requires it.

Use Conventional Commits for commits and pull-request titles:

```text
feat(scope): concise description
fix(scope): concise description
docs(scope): concise description
test(scope): concise description
refactor(scope): concise description
chore(scope): concise description
```

Keep unrelated work out of the branch. Delete the branch after merge.

## Pull requests

Link the owning issue with `Closes #N`, `Fixes #N`, or `Resolves #N`.

Every pull request states what changed and why, exact verification, failures
and unverified work, documentation impact, release impact, provenance, and the
public-content check.

A failed or unavailable check is not a pass. Keep the pull request open until
required CI succeeds.

## Validation

Run focused checks first, then:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
git diff --check main...HEAD
```

Record exact commands and results in the pull request.

## Building the starter

The repository keeps one canonical skill catalog under `skills/`. Build a
portable starter with physical runtime copies by running:

```bash
python3 scripts/build_starter.py --output dist
```

The command creates `dist/Jarvis-Lite/` and installs the selected skills into
both `.claude/skills/` and `.agents/skills/`. Do not edit those generated
mirrors directly. The builder rejects symlinks so normal ZIP extraction works
on Windows and macOS. It also writes the release-managed file manifest and the
initial `.jarvis-update/state.json`; source builds use the explicit
`unreleased` identity. The release builder owned by the release workflow passes
the stable semantic version and full source commit instead of editing those
files afterward.

## Cutting a release

Releases use stable semantic tags in the form `vMAJOR.MINOR.PATCH`. The tag is
the version authority and its commit must be contained in `main`.

Before creating a tag, build the two release assets locally from a clean current
`main`:

```bash
python3 scripts/build_release.py \
  --tag v0.1.0 \
  --source-commit "$(git rev-parse HEAD)" \
  --output dist/release
```

This creates exactly `Jarvis-Lite.zip` and `Jarvis-Lite.zip.sha256`. The builder
refuses to replace existing assets. Verify and clean-extract them with:

```bash
python3 scripts/verify_release.py \
  --archive dist/release/Jarvis-Lite.zip \
  --checksum dist/release/Jarvis-Lite.zip.sha256 \
  --expected-version 0.1.0 \
  --expected-commit "$(git rev-parse HEAD)" \
  --extract-to dist/clean-install
```

After local validation, create and push the exact tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The Release workflow reruns the complete test suite, proves deterministic ZIP
bytes, verifies clean extraction on GitHub-hosted macOS and Windows runners, and
creates one draft GitHub Release with the two assets. An existing Release for
the tag is a stop condition. Inspect and download-test the draft before using
GitHub's explicit **Publish release** action; no workflow publishes releases.

After publication, the stable user download URL is:

```text
https://github.com/Erionis/Jarvis-Lite/releases/latest/download/Jarvis-Lite.zip
```

## Documentation impact

Update durable documentation only when understanding or behavior changes.
Otherwise state `No documentation impact` and explain why. Prefer one canonical
document over parallel descriptions.

## Release impact

Classify each change as one of:

- none;
- user-visible behavior;
- package composition or installation;
- incompatible contract or migration.

Do not change release contents as a side effect of unrelated work.

## Skill naming

Names are lowercase and hyphenated. Natural user actions stay short, such as
`briefing`, `first-run`, and `save-session`. Capabilities that administer
Jarvis use selective namespacing, such as `jarvis-memory` and `jarvis-doctor`.
External tools preserve established names. Folder and frontmatter names match;
cross-runtime aliases are not part of the contract.

## Before merging

- Confirm issue and pull-request scope still match.
- Review the complete diff.
- Run and record required validation.
- Confirm documentation and release impact.
- Confirm provenance and public-only content.
- Squash merge only after CI passes.
