-- Stage 11b: a whole study programme at once (`parse-document` kind `study_program`).
alter type ai_task add value if not exists 'parse_study_program';
