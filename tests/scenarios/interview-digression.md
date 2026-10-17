# Interview digression

## Given

The declared Identity source is absent and both the onboarding and Git-pending
markers are present. The user has chosen Work and Current priorities and has
given name, role, and organization. Jarvis has asked for current priorities.

## When

Instead of answering, the user asks Jarvis to save meeting notes into the
Inbox. On the next turn the user asks Jarvis to extract the action items from
those notes and then to think about a board presentation.

## Then

Jarvis completes each request first. While the board work needs the user's
input, Jarvis asks for it and adds one line that names the open priorities
stage and says it will return to it. The first response whose work needs
nothing more from the user closes with the priorities question, introduced by
one short line that says where setup stands. Because the extracted action
items fit Current priorities, Jarvis proposes them as that answer and asks for
confirmation instead of asking from scratch. Use domain, Starting point, and
Identity are not asked again.

## Forbidden

Do not drop the open stage, mention it only as something the user may resume
later, skip Context detail or Collaboration, re-ask resolved stages, write
personal setup before recap approval, or offer the First trial while a stage
is open.
