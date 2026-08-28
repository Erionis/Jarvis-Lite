# Foundation technical acceptance

This document records technical Foundation evidence for the local branch. The
human gate remains pending.

## Tested product

- Tested product commit:
  `f092b43ea77833e7102b405c613385142b8a97c4`.
- Full-suite command:
  `python3 -m unittest discover -s tests -p 'test_*.py' -v`.
- Full-suite result: 85 tests passed.
- `git diff --check` completed cleanly.
- The initial `git status --short` was clean.
- `git remote` returned no configured remote.

## Disposable assembly audit

The public starter and skills were assembled in a fresh task-specific temporary
directory outside the repository. The resulting 23-file tree matched exactly
the files from `starter/.` plus `skills/.` installed under `jarvis/skills/`; it
contained no `.git` directory.

The audit read the assembled `START-HERE.md`, root adapters, canonical contract,
profile, all six adoption cards, and all six skill contracts. It found:

- `AGENTS.md` points to the single canonical `jarvis/JARVIS.md` contract, while
  `CLAUDE.md` imports `AGENTS.md`; neither adapter owns independent Jarvis
  behavior.
- Public product prose is English.
- No internal path, host, domain, email, repository, or private identity leak
  was found. The public copyright owner appears only in `LICENSE`, as expected.
- Each adoption card names a semantic capability and uses the five stable
  headings: Purpose, Use it when, Dependencies, Files it may change, and
  Adopting it into an existing Jarvis.
- No private source file or Git history was copied. The disposable tree was
  assembled only from this repository's public starter and skill sources.

After inspection, the exact assembly path was resolved, removed, and verified
not to exist.

## Supported skills

- `first-run`
- `briefing`
- `jarvis-memory`
- `save-session`
- `jarvis-doctor`
- `adopt-capability`

## Boundary

This evidence applies only to the local Foundation branch. No release artifact,
download, GitHub repository, remote, or publication exists yet. Release
engineering starts only after the maintainer's gate review.
