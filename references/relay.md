# Relay: a planning agent talks to the user through the main session

Used by `to-spec` with the `spec-writer` agent, and `to-tickets` with the `ticket-writer` agent. The agent runs on its own model in the background and can't reach the user. The skill in the main session, the **relay**, starts it, shows the user exactly what the agent sends, and returns the user's answers word for word.

All the thinking is the agent's: which questions to ask, the follow-ups, the recommendations, what goes into the files. The relay only carries messages.

## The agent's side

End **every** message with exactly one relay block: a fenced code block with the language `relay` holding one JSON object. Nothing comes after it.

````
```relay
{
  "say": "Markdown shown to the user before anything else (optional)",
  "questions": [
    {
      "header": "Limit",
      "question": "Q1/2: How many favorites can a user have? ...",
      "options": [
        { "label": "50 (Recommended)", "description": "One sentence on the trade-off." },
        { "label": "No limit", "description": "..." }
      ],
      "multiSelect": false
    }
  ]
}
```
````

- **`say`** (optional): only what the user must read: what a review question needs (a path, a link), the answer to their question. Keep it short, and never recap their answers.
- Then exactly **one** of:
  - **`questions`**: one grilling round, in the AskUserQuestion format: `header` (at most 12 characters), `question` (self-contained, numbered `Q<n>/<total>:`), 2–4 `options` with `label`, `description` and an optional `preview`, the recommended one first with ` (Recommended)` at the end of its label, and `multiSelect`. The questions of one round must not depend on each other. The user can always answer with their own text instead ("Other").
  - **`request`**: `{ "skill": "<name>", "args": "<arguments>", "why": "<one line>" }`: something only the main session can do, such as running an interactive skill. Then wait for its result.
  - **`done`**: `{ ... }` with the fields your skill names. Finished.
  - **`stopped`**: `{ "reason": "...", "next": "<what should happen now>" }`. You can't continue.

The JSON must be valid: escape quotes, backslashes and line breaks inside strings. You never have AskUserQuestion, never assume an answer, and never go on before the relay replies.

## The relay's side

1. **Start** the agent with the Agent tool, in the background, with the prompt the calling skill gives. Keep its id: every later message goes to **this same agent** with SendMessage. Never start a second one for the same run.
2. **On each agent message**, take the last ```` ```relay ```` block and parse it. If there's none, or the JSON is invalid, send "Your last message has no valid relay block. Send it again, ending with exactly one." After two failures in a row, stop and show the agent's last message to the user.
3. **`say`:** show it word for word.
4. **`questions`:** ask each one with AskUserQuestion, one question per call, in the given order, exactly as given: same header, question, labels, descriptions, previews and multiSelect. Never add, drop, merge, reorder, reword or answer a question. Then send all answers in one message:

   ```
   RELAY ANSWERS
   Q1 [Limit]: 50 (Recommended)
   Q2 [Sort]: Other: "<the user's own text, word for word>"
      notes: "<notes the user added, if any>"
   ```

   A dismissed question is `Q3 [Header]: dismissed`. If an answer is a question or a wish to discuss, keep asking the rest of the round: the agent answers in its next `say` and asks again.
5. **`request`:** run it only if the calling skill allows that skill. Call the Skill tool with the given skill and args, then send `RELAY RESULT <skill>: <how it ended (done or stopped), the commit hash, the files it changed, its last message>`. A request for anything else: send `RELAY RESULT <skill>: not allowed here`.
6. **`done` or `stopped`:** the relay ends, and the calling skill goes on with the block's fields.
7. **The user writes in chat** while the relay runs (not as an answer to a question): send it to the agent word for word as `RELAY USER MESSAGE: "<text>"`, then continue with the agent's reply.

The relay never decides anything for the user or the agent, never edits the files the agent works on, and leaves the main checkout alone while the agent runs: the agent works in it.
