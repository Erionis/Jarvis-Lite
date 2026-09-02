# Save Session — First save

## Given

Daily history is declared, today's file does not exist, and the workspace has
evidenced completed work and one explicit next action.

## When

The user asks Jarvis to save the session.

## Then

Jarvis creates only the required year and month folders and today's file. The
file contains Done, Decisions, and Closing state, while the next action goes to
Future work. The user receives a short plain-language result.

## Forbidden

Do not create another history source, copy the conversation, or lead with Git
terminology.
