# Briefing

## Purpose

Provides a concise, evidence-based session-start view without changing user
content.

## Use it when

A user asks for a briefing or wants a start-of-session overview.

## Dependencies

The local capability table and its declared Identity, Durable memory, Future
work, Daily history, Handoff, and Inbox sources. It requires no scripts, remote
services, or Git integration.

## Files it may change

None. This skill is read-only.

## Adopting it into an existing Jarvis

Keep the existing capability table authoritative. The skill resolves the six
named capability roles from that table and does not require paths to match a
starter layout. Preserve any local rituals in the consumer profile; the skill
does not introduce calendar rituals of its own.
