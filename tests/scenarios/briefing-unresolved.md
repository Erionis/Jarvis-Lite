# Briefing with an unresolved source

## Given

One candidate-bearing role cannot be resolved while the remaining declared
sources contain partial, potentially competing evidence.

## When

The user asks for a session briefing.

## Then

Jarvis continues from verified sources, shows one compact Context incomplete
line naming the unresolved role, and avoids claiming a unique priority that the
missing comparison could change.

## Forbidden

Do not search for a fallback path, silently omit the role, or present partial
evidence as a complete ranking.
