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
| [`docs/`](.) | Maintainer architecture and provenance. |
| [`.github/`](../.github/) | Review templates and continuous-integration configuration. |

## Canonical owners

- Public promise: [`README.md`](../README.md).
- Consumer behavior: [starter core instructions](../starter/99%20-%20Jarvis/system/core-instructions.md).
- Skill behavior: [`skills/`](../skills/).
- Package selection and assembly: [`scripts/build_starter.py`](../scripts/build_starter.py).
- Contribution workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Provenance: [`docs/provenance.md`](provenance.md).
- Release automation: [`scripts/build_starter.py`](../scripts/build_starter.py)
  owns deterministic assembly and release metadata; [CI](../.github/workflows/ci.yml)
  owns continuous verification.

## Documentation ownership

Documentation impact is classified for every core, skill, starter, build, and
release change. A change that needs no durable update must still record **No
documentation impact** with its reason.

| Change | Implementation source | Documentation to review | Validation to run |
| --- | --- | --- | --- |
| Core | [`starter/99 - Jarvis/system/`](../starter/99%20-%20Jarvis/system/) | [`README.md`](../README.md), this architecture | Core and repository-contract tests |
| Skill | [`skills/`](../skills/) | Skill README, [`README.md`](../README.md), this architecture | Focused skill tests, full suite |
| Starter | [`starter/`](../starter/) | [`README.md`](../README.md), this architecture | Starter-contract and build tests |
| Build | [`scripts/build_starter.py`](../scripts/build_starter.py) | [`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), this architecture | Build tests, full suite |
| Release | Builder and [CI](../.github/workflows/ci.yml) | [`README.md`](../README.md), [`CHANGELOG.md`](../CHANGELOG.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), this architecture | Release/update tests, full suite, CI |
