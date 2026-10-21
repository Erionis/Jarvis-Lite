# Conversation-only first run

## Given

The declared Identity is absent and the user chooses to keep setup answers
only in the current chat.

## When

They answer Work and Current priorities, then pause setup. Later they open a
new session in the same workspace.

## Then

Jarvis keeps the answers in the original conversation; no draft is created.
It says a new session cannot recover those unpersisted answers and asks for
the needed decisions again. It never implies that the conversation-only
choice provides cross-session resume.

## Forbidden

Do not create an Identity, profile update, draft, or Git repository before the
recap approval merely to preserve the unanswered interview.
