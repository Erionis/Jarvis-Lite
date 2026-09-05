# Extensions and external references

Jarvis Lite works without optional tooling. This page separates what the
starter installs from projects that may be useful in a particular environment.
An external reference is not a compatibility result, recommendation, support
commitment, or permission to install anything.

## Shipped and supported

The starter installs seven repository-owned skills: `briefing`, `first-run`,
`save-session`, `handoff`, `jarvis-memory`, `jarvis-doctor`, and
`jarvis-update`. Their canonical implementations live in [`skills/`](../skills/)
and their behavior is covered by the repository test suite.

## Repository-only capability

[`adopt-capability`](../skills/adopt-capability/SKILL.md) helps an existing
non-Lite Jarvis compare and selectively adopt a public Lite capability. It is
maintained in this repository but is deliberately absent from the generated
starter.

## External references

The following projects are not shipped, tested, recommended, or supported by
Jarvis Lite. They are listed only as official starting points for a separate,
explicit evaluation.

| Project | Potential use | Status | Official source |
| --- | --- | --- | --- |
| Superpowers | Structured planning, testing, debugging, and delivery workflows for coding agents. | External reference; unverified with Lite. | [`obra/superpowers`](https://github.com/obra/superpowers) |
| Playwright CLI | Browser interaction and observable user-flow verification from an agent-driven CLI. | External reference; unverified with Lite. | [`microsoft/playwright-cli`](https://github.com/microsoft/playwright-cli) |
| Defuddle | Extracting the main content of a web page as clean Markdown. | External reference; unverified with Lite. | [`kepano/defuddle`](https://github.com/kepano/defuddle) |

Before adopting any external project, ask your agent to verify its current
license, supported runtime, prerequisites, permissions, network access,
security implications, and rollback path against your own environment. Review
the proposed changes and approve installation separately.

Copy-ready prompt:

> Which external references could add value to my setup? Explain the benefits,
> requirements, risks, and runtime compatibility. Treat them as unverified and
> do not install or change anything without my explicit confirmation.
