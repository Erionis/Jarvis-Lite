# Architecture

Jarvis Lite has three layers: repository source is the maintainers' editable
implementation; [`starter/`](../starter/) is the editable consumer skeleton;
and a generated release is the portable output assembled from them. Generated
runtime mirrors and release output are never edited by hand—change their
source, then rebuild.

## Source areas

| Area | Responsibility |
| --- | --- |
| [`starter/`](../starter/) | Consumer skeleton and runtime adapter source. |
| [`skills/`](../skills/) | Canonical reusable skill implementations. |
| [`scripts/`](../scripts/) | Deterministic package assembly. |
| [`tests/`](../tests/) | Executable public and package contracts. |
| [`docs/`](.) | Public user journeys, maintainer architecture, and provenance. |
| [`.github/`](../.github/) | Review templates and continuous-integration configuration. |

## Canonical owners

- Public promise and audience routes: [`README.md`](../README.md).
- Acquisition and first run: [`docs/getting-started.md`](getting-started.md).
- Daily user lifecycle: [`docs/daily-use.md`](daily-use.md).
- Updates and capability adoption: [`docs/updates.md`](updates.md).
- Consumer behavior: [starter core instructions](../starter/99%20-%20Jarvis/system/core-instructions.md).
- Skill behavior: [`skills/`](../skills/).
- Package selection and assembly: [`scripts/build_starter.py`](../scripts/build_starter.py).
- Contribution workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Provenance: [`docs/provenance.md`](provenance.md).
- Release automation: [`scripts/build_starter.py`](../scripts/build_starter.py)
  owns deterministic assembly and release metadata; [CI](../.github/workflows/ci.yml)
  owns continuous verification.

## Public documentation map

| Reader need | Canonical document | Boundary |
| --- | --- | --- |
| Decide whether Lite fits | [`README.md`](../README.md) | Short promise, limits, current availability, and routes only. |
| Install and complete first run | [`docs/getting-started.md`](getting-started.md) | Acquisition, staged tree, onboarding, and first trial. |
| Work with Lite each day | [`docs/daily-use.md`](daily-use.md) | Start, work, memory, close, handoff, and diagnostics. |
| Update Lite or adopt selected capabilities | [`docs/updates.md`](updates.md) | User choices and outcomes; skill files retain executable mechanics. |
| Change or review the repository | This architecture and [`AGENTS.md`](../AGENTS.md) | Source boundaries, ownership, and maintainer navigation. |

## Documentation ownership

Documentation impact is classified for every core, skill, starter, build, and
release change. A change that needs no durable update must still record **No
documentation impact** with its reason.

| Change | Implementation source | Documentation to review | Validation to run |
| --- | --- | --- | --- |
| Core | [`starter/99 - Jarvis/system/`](../starter/99%20-%20Jarvis/system/) | [`README.md`](../README.md), [daily use](daily-use.md), this architecture | Core and repository-contract tests |
| Skill | [`skills/`](../skills/) | Skill README, the affected public journey, [`README.md`](../README.md), this architecture | Focused skill tests, full suite |
| Starter or first run | [`starter/`](../starter/) and [`skills/first-run/`](../skills/first-run/) | [getting started](getting-started.md), [`README.md`](../README.md), this architecture | Starter-contract, first-run, and build tests |
| Build | [`scripts/build_starter.py`](../scripts/build_starter.py) | [`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), this architecture | Build tests, full suite |
| Update or adoption | [`skills/jarvis-update/`](../skills/jarvis-update/) and [`skills/adopt-capability/`](../skills/adopt-capability/) | [updates](updates.md), [`README.md`](../README.md), this architecture | Update tests, full suite |
| Release | Builder and [CI](../.github/workflows/ci.yml) | [`README.md`](../README.md), [getting started](getting-started.md), [`CHANGELOG.md`](../CHANGELOG.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), this architecture | Release/update tests, full suite, CI |
