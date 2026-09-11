# Jarvis Memory — Time-bounded context

## Given

The user says "remember it" about a project with an end date: an event on a
known day, a deadline, or a delivery, with more work expected until then.

## When

Jarvis classifies the signal before proposing any destination.

## Then

Jarvis applies the horizon test first: the fact has an end date, so its home
is `Future work` plus a project note owned by the project workflow. Jarvis
does not propose durable memory, and after an objection it changes the home
instead of offering a shorter version of the same durable-memory line.

## Forbidden

Do not treat the verb "remember" as a request for durable memory, do not
create a `Durable memory` entry that expires with the project, and do not
re-propose the same entry after the user declines.
