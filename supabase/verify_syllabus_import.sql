-- Read-only pre-import and post-import checks for the approved AKU-EB datasets.
-- This file never changes data.

BEGIN TRANSACTION READ ONLY;

-- PRE-IMPORT: inspect the live table columns rather than relying on a checked-in snapshot.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_identity
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('subjects', 'slos')
ORDER BY table_name, ordinal_position;

-- PRE-IMPORT: confirm live unique and foreign-key constraints.
SELECT
  c.conrelid::regclass AS table_name,
  c.contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
WHERE c.connamespace = 'public'::regnamespace
  AND c.conrelid IN ('public.subjects'::regclass, 'public.slos'::regclass)
ORDER BY table_name, constraint_type, definition;

-- PRE-IMPORT: counts and presence of the eight expected subject/grade pairs.
WITH expected(name, grade, grade_number, subject_slug) AS (
  VALUES
    ('Computer Science', 'XI', 11, 'computer-science'),
    ('Computer Science', 'XII', 12, 'computer-science'),
    ('Mathematics', 'XI', 11, 'mathematics'),
    ('Mathematics', 'XII', 12, 'mathematics'),
    ('Physics', 'XI', 11, 'physics'),
    ('Physics', 'XII', 12, 'physics'),
    ('Statistics', 'XI', 11, 'statistics'),
    ('Statistics', 'XII', 12, 'statistics')
)
SELECT
  e.name AS subject,
  e.grade AS grade_label,
  e.grade_number,
  e.subject_slug,
  s.id AS subject_id,
  s.board,
  count(l.id) AS slo_count
FROM expected AS e
LEFT JOIN public.subjects AS s
  ON s.name = e.name
 AND s.grade = e.grade
 AND s.board = 'AKU-EB'
LEFT JOIN public.slos AS l
  ON l.subject_id = s.id
GROUP BY e.name, e.grade, e.grade_number, e.subject_slug, s.id, s.board
ORDER BY e.name, e.grade;

-- PRE-IMPORT: current global total; expected to be 103 before the first import.
SELECT count(*) AS total_slos_before_import
FROM public.slos;

-- PRE-IMPORT: existing duplicate keys must return no rows.
SELECT subject_id, slo_code, count(*) AS copies
FROM public.slos
GROUP BY subject_id, slo_code
HAVING count(*) > 1
ORDER BY subject_id, slo_code;

-- POST-IMPORT: all eight counts must match the approved total and sum to 1,253.
WITH expected(name, grade, grade_number, subject_slug, approved_count) AS (
  VALUES
    ('Computer Science', 'XI', 11, 'computer-science', 130),
    ('Computer Science', 'XII', 12, 'computer-science', 103),
    ('Mathematics', 'XI', 11, 'mathematics', 177),
    ('Mathematics', 'XII', 12, 'mathematics', 204),
    ('Physics', 'XI', 11, 'physics', 185),
    ('Physics', 'XII', 12, 'physics', 213),
    ('Statistics', 'XI', 11, 'statistics', 123),
    ('Statistics', 'XII', 12, 'statistics', 118)
)
SELECT
  e.name AS subject,
  e.grade AS grade_label,
  s.id AS subject_id,
  s.board,
  count(l.id) AS slo_count,
  e.approved_count,
  count(l.id) = e.approved_count AS count_matches
FROM expected AS e
LEFT JOIN public.subjects AS s
  ON s.name = e.name
 AND s.grade = e.grade
 AND s.board = 'AKU-EB'
LEFT JOIN public.slos AS l
  ON l.subject_id = s.id
GROUP BY e.name, e.grade, s.id, s.board, e.approved_count
ORDER BY e.name, e.grade;

-- POST-IMPORT: must return 1,253.
SELECT count(*) AS total_slos_after_import
FROM public.slos;

-- POST-IMPORT: must return no rows.
SELECT subject_id, slo_code, count(*) AS copies
FROM public.slos
GROUP BY subject_id, slo_code
HAVING count(*) > 1
ORDER BY subject_id, slo_code;

COMMIT;
