# Repository maintainer guide

This file guides maintainers and coding agents working on this repository. It
is not packaged for consumers: the build copies the thin consumer adapter at
[`starter/AGENTS.md`](starter/AGENTS.md), whose behavior is defined by the
[starter core instructions](starter/99%20-%20Jarvis/system/core-instructions.md).

## Orient yourself

- Start with the [public promise](README.md), the [contribution workflow](CONTRIBUTING.md),
  the [architecture](docs/architecture.md), and [provenance](docs/provenance.md).
- Treat [`skills/`](skills/) as the skill source, [`scripts/build_starter.py`](scripts/build_starter.py)
  as the package builder, and [`tests/`](tests/) as executable repository
  contracts.
- Use [CI](.github/workflows/ci.yml) and the [pull-request template](.github/pull_request_template.md)
  to prepare review evidence.

## Change flow

Follow the full process in [CONTRIBUTING.md](CONTRIBUTING.md): issue, short-lived
branch, focused test, full validation, public-only review, pull request, then
squash merge. Keep this guide as navigation and do not duplicate that workflow.

Every core, skill, starter, build, or release change must classify its
documentation impact. When no durable document needs revision, record **No
documentation impact** and explain why; otherwise update the canonical owner.
