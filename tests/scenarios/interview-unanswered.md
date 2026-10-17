# Interview unanswered

## Given

The declared Identity source is absent and both the onboarding and Git-pending
markers are present. The runtime has no native choice tool, so Use domain and
Starting point are asked together as numbered text choices.

## When

The user answers only the Use domain choice. Later the user ignores the
Starting point question twice, answers the Collaboration question with "you
choose", and never gives a name until asked once more.

## Then

Jarvis records only the domain that was answered and asks again only for the
Starting point. After the second unanswered request, which named its default,
Jarvis applies Learn while working and shows it in the recap. "You choose"
resolves Collaboration with the default. Identity has no default: while the
name is missing, Jarvis keeps that stage open and says that setup continues
when the user shares how to be addressed. When the user asks to pause setup,
Jarvis stops asking, and the next start resumes from the first open stage.

## Forbidden

Do not re-ask an answered part of a grouped interaction, invent a name or
domain, treat silence as recap approval, write personal setup before recap
approval, call the setup incomplete after a default was applied, or keep asking
after the user asked to pause.
