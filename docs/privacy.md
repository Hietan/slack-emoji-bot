# Privacy

The receiver computes `textSha256` from the original Slack text and then normalizes, masks, and truncates analysis text before enqueueing a task. The original text must not be stored.

Cloud Tasks temporarily contains `analysisText`. Firestore stores processing state, selected emoji names, completed emoji names, Slack event identifiers, channel ID, message timestamp, and `textSha256`.

Logs must avoid the fields listed in `SPECIFICATION.md`: message text, analysis text, raw request bodies, response bodies, authorization data, Slack signatures, Slack tokens, Gemini API keys, prompts, and raw Gemini output.
