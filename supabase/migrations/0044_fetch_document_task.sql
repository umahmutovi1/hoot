-- find-academic-info `op: 'fetch'` downloads a link on the server. It is not an AI call, so it
-- does not use one of the 30 daily AI calls, but it has its own limit (40 a day) and is logged in
-- ai_runs like every other server-side job.
alter type ai_task add value if not exists 'fetch_document';
