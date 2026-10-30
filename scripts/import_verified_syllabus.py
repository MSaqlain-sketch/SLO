#!/usr/bin/env python3
"""Atomically import the seven approved AKU-EB syllabus JSON files."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

try:
    import psycopg
except ImportError as exc:
    raise SystemExit(
        'Missing optional dependency. Install it with: '
        'python -m pip install "psycopg[binary]>=3.2,<4"'
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
BOARD = "AKU-EB"
APPROVED = {
    ("Computer Science", "XI", 11, "computer-science"): (
        "grade_11_computer-science_slos.json",
        130,
    ),
    ("Mathematics", "XI", 11, "mathematics"): (
        "grade_11_mathematics_slos.json",
        177,
    ),
    ("Mathematics", "XII", 12, "mathematics"): (
        "grade_12_mathematics_slos.json",
        204,
    ),
    ("Physics", "XI", 11, "physics"): ("grade_11_physics_slos.json", 185),
    ("Physics", "XII", 12, "physics"): ("grade_12_physics_slos.json", 213),
    ("Statistics", "XI", 11, "statistics"): (
        "grade_11_statistics_slos.json",
        123,
    ),
    ("Statistics", "XII", 12, "statistics"): (
        "grade_12_statistics_slos.json",
        118,
    ),
}
PRESERVED_SUBJECT = ("Computer Science", "XII", 12, "computer-science")
PRESERVED_SLO_COUNT = 103
EXPECTED_TOTAL = PRESERVED_SLO_COUNT + sum(count for _, count in APPROVED.values())
REQUIRED_SUBJECT_COLUMNS = {"id", "name", "grade", "board"}
REQUIRED_SLO_COLUMNS = {
    "id",
    "subject_id",
    "chapter",
    "topic",
    "slo_code",
    "statement",
    "source_page",
    "created_at",
    "grade",
    "subject",
}
SLO_SNAPSHOT_COLUMNS = (
    "id",
    "subject_id",
    "chapter",
    "topic",
    "slo_code",
    "statement",
    "source_page",
    "created_at",
    "grade",
    "subject",
)
SLO_INSERT_COLUMNS = (
    "subject_id",
    "chapter",
    "topic",
    "slo_code",
    "statement",
    "source_page",
    "grade",
    "subject",
)


class ImportSafetyError(RuntimeError):
    pass


def load_approved_rows() -> dict[tuple[str, str, int, str], list[dict[str, Any]]]:
    loaded: dict[tuple[str, str, int, str], list[dict[str, Any]]] = {}
    for subject_key, (filename, expected_count) in APPROVED.items():
        path = ROOT / "data" / filename
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ImportSafetyError(f"Could not load {path}: {exc}") from exc

        if not isinstance(rows, list) or len(rows) != expected_count:
            actual = len(rows) if isinstance(rows, list) else "not a list"
            raise ImportSafetyError(
                f"{filename}: expected {expected_count} records, found {actual}"
            )

        codes: list[str] = []
        for index, row in enumerate(rows):
            code = row.get("slo_code")
            if not isinstance(code, str) or not re.fullmatch(r"\d+\.\d+\.\d+", code):
                raise ImportSafetyError(f"{filename}[{index}]: invalid SLO code")
            if row.get("grade") != subject_key[2]:
                raise ImportSafetyError(f"{filename}:{code}: grade does not match file")
            if row.get("chapter") != int(code.split(".", 1)[0]):
                raise ImportSafetyError(
                    f"{filename}:{code}: chapter does not match SLO code"
                )
            if not isinstance(row.get("topic"), str) or not code.startswith(
                f"{row['topic']}."
            ):
                raise ImportSafetyError(f"{filename}:{code}: invalid topic mapping")
            if not isinstance(row.get("statement"), str) or not row["statement"].strip():
                raise ImportSafetyError(f"{filename}:{code}: empty statement")
            if not isinstance(row.get("page"), int) or row["page"] < 1:
                raise ImportSafetyError(f"{filename}:{code}: invalid source page")
            if any(0xE000 <= ord(char) <= 0xF8FF for char in row["statement"]):
                raise ImportSafetyError(
                    f"{filename}:{code}: statement contains a private-use glyph"
                )
            if "\ufffd" in row["statement"]:
                raise ImportSafetyError(
                    f"{filename}:{code}: statement contains a replacement glyph"
                )
            codes.append(code)

        duplicates = sorted(code for code, count in Counter(codes).items() if count > 1)
        if duplicates:
            raise ImportSafetyError(
                f"{filename}: duplicate SLO codes: {', '.join(duplicates[:10])}"
            )
        loaded[subject_key] = rows
    return loaded


def ensure_schema(cursor: psycopg.Cursor[Any]) -> None:
    cursor.execute(
        """
        SELECT table_name, column_name, data_type, is_nullable, is_identity, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('subjects', 'slos')
        """
    )
    columns: dict[str, dict[str, tuple[str, str, str, str | None]]] = {
        "subjects": {},
        "slos": {},
    }
    for table, column, data_type, nullable, identity, default in cursor.fetchall():
        columns[table][column] = (data_type, nullable, identity, default)

    missing_subject = REQUIRED_SUBJECT_COLUMNS - columns["subjects"].keys()
    missing_slo = REQUIRED_SLO_COLUMNS - columns["slos"].keys()
    if missing_subject or missing_slo:
        raise ImportSafetyError(
            "Production schema is incompatible; "
            f"missing subjects columns={sorted(missing_subject)}, "
            f"missing slos columns={sorted(missing_slo)}"
        )

    if columns["subjects"]["grade"][0] != "text":
        raise ImportSafetyError("subjects.grade is not text as expected")
    if columns["slos"]["grade"][0] not in {"smallint", "integer", "bigint"}:
        raise ImportSafetyError("slos.grade is not an integer type")
    if columns["slos"]["chapter"][0] not in {"smallint", "integer", "bigint"}:
        raise ImportSafetyError("slos.chapter is not an integer type")
    if columns["slos"]["source_page"][0] not in {
        "smallint",
        "integer",
        "bigint",
    }:
        raise ImportSafetyError("slos.source_page is not an integer type")
    for table, name in (
        ("subjects", "name"),
        ("subjects", "board"),
        ("slos", "subject_id"),
        ("slos", "chapter"),
        ("slos", "topic"),
        ("slos", "slo_code"),
        ("slos", "statement"),
        ("slos", "source_page"),
        ("slos", "subject"),
    ):
        if columns[table][name][0] not in {
            "text",
            "character varying",
            "character",
            "integer",
            "smallint",
            "bigint",
        }:
            raise ImportSafetyError(
                f"public.{table}.{name} has unsupported type "
                f"{columns[table][name][0]}"
            )
    for table in ("subjects", "slos"):
        identity, default = columns[table]["id"][2:]
        if identity != "YES" and not default:
            raise ImportSafetyError(f"public.{table}.id has no generated default")
    for table, name in (
        ("subjects", "name"),
        ("subjects", "grade"),
        ("subjects", "board"),
        ("slos", "subject_id"),
        ("slos", "chapter"),
        ("slos", "topic"),
        ("slos", "slo_code"),
        ("slos", "statement"),
    ):
        if columns[table][name][1] != "NO":
            raise ImportSafetyError(f"public.{table}.{name} is nullable")

    cursor.execute(
        """
        SELECT c.conrelid::regclass::text, c.contype, pg_get_constraintdef(c.oid)
        FROM pg_constraint AS c
        WHERE c.connamespace = 'public'::regnamespace
          AND c.conrelid IN ('public.subjects'::regclass, 'public.slos'::regclass)
        """
    )
    constraints = {
        (
            table.split(".")[-1].strip('"'),
            kind,
            re.sub(r"\s+", "", definition.lower()),
        )
        for table, kind, definition in cursor.fetchall()
    }
    subjects_unique = ("subjects", "u", "unique(name,grade,board)") in constraints
    slos_unique = ("slos", "u", "unique(subject_id,slo_code)") in constraints
    subjects_primary = ("subjects", "p", "primarykey(id)") in constraints
    slos_primary = ("slos", "p", "primarykey(id)") in constraints
    slos_subject_fk = any(
        table == "slos"
        and kind == "f"
        and re.fullmatch(
            r"foreignkey\(subject_id\)references(?:public\.)?subjects\(id\)(?:onupdate\w+)?(?:ondelete\w+)?",
            definition,
        )
        for table, kind, definition in constraints
    )
    if not (
        subjects_unique
        and slos_unique
        and subjects_primary
        and slos_primary
        and slos_subject_fk
    ):
        raise ImportSafetyError(
            "Production schema is missing required unique/FK constraints "
            f"(subjects primary={subjects_primary}, subjects unique={subjects_unique}, "
            f"slos primary={slos_primary}, slos unique={slos_unique}, "
            f"subject foreign key={slos_subject_fk})"
        )


def subject_id_for(
    cursor: psycopg.Cursor[Any], name: str, grade_label: str
) -> int | None:
    cursor.execute(
        """
        SELECT id
        FROM public.subjects
        WHERE name = %s AND grade = %s AND board = %s
        """,
        (name, grade_label, BOARD),
    )
    rows = cursor.fetchall()
    if len(rows) > 1:
        raise ImportSafetyError(
            f"Multiple subjects exist for {name} {grade_label} {BOARD}"
        )
    return rows[0][0] if rows else None


def fetch_subject_slos(
    cursor: psycopg.Cursor[Any], subject_id: int
) -> dict[str, tuple[Any, ...]]:
    cursor.execute(
        """
        SELECT chapter, topic, slo_code, statement, source_page, grade, subject
        FROM public.slos
        WHERE subject_id = %s
        """,
        (subject_id,),
    )
    records: dict[str, tuple[Any, ...]] = {}
    for chapter, topic, code, statement, page, grade, subject in cursor.fetchall():
        if code in records:
            raise ImportSafetyError(f"Duplicate database SLO code {code}")
        records[code] = (chapter, topic, statement, page, grade, subject)
    return records


def source_record(row: dict[str, Any], subject_key: tuple[str, str, int, str]) -> tuple[Any, ...]:
    return (
        row["chapter"],
        row["topic"],
        row["statement"],
        row["page"],
        subject_key[2],
        subject_key[3],
    )


def fetch_cs_xii_snapshot(cursor: psycopg.Cursor[Any], subject_id: int) -> tuple[tuple[Any, ...], ...]:
    cursor.execute(
        f"""
        SELECT {", ".join(SLO_SNAPSHOT_COLUMNS)}
        FROM public.slos
        WHERE subject_id = %s
        ORDER BY slo_code
        """,
        (subject_id,),
    )
    return tuple(tuple(row) for row in cursor.fetchall())


def verify_existing_target(
    cursor: psycopg.Cursor[Any],
    loaded: dict[tuple[str, str, int, str], list[dict[str, Any]]],
) -> tuple[dict[tuple[str, str, int, str], int | None], dict[tuple[str, str, int, str], bool], tuple[tuple[Any, ...], ...]]:
    ids: dict[tuple[str, str, int, str], int | None] = {}
    complete: dict[tuple[str, str, int, str], bool] = {}

    for subject_key in APPROVED:
        name, grade_label, _, _ = subject_key
        subject_id = subject_id_for(cursor, name, grade_label)
        ids[subject_key] = subject_id
        if subject_id is None:
            complete[subject_key] = False
            continue

        existing = fetch_subject_slos(cursor, subject_id)
        approved_rows = loaded[subject_key]
        expected = {row["slo_code"]: source_record(row, subject_key) for row in approved_rows}
        if not existing:
            complete[subject_key] = False
            continue
        if existing != expected:
            raise ImportSafetyError(
                f"{name} {grade_label} already has non-empty SLO data that does not "
                "exactly match the approved file; refusing to modify or supplement it"
            )
        complete[subject_key] = True

    cs_key = PRESERVED_SUBJECT
    cs_id = subject_id_for(cursor, cs_key[0], cs_key[1])
    if cs_id is None:
        raise ImportSafetyError("Existing Computer Science XII subject is missing")
    cs_snapshot = fetch_cs_xii_snapshot(cursor, cs_id)
    if len(cs_snapshot) != PRESERVED_SLO_COUNT:
        raise ImportSafetyError(
            f"Expected exactly {PRESERVED_SLO_COUNT} existing Computer Science XII "
            f"SLOs, found {len(cs_snapshot)}"
        )

    cursor.execute("SELECT count(*) FROM public.slos")
    current_total = cursor.fetchone()[0]
    existing_approved_count = sum(
        len(loaded[key]) for key in APPROVED if complete[key]
    )
    expected_current_total = PRESERVED_SLO_COUNT + existing_approved_count
    if current_total != expected_current_total:
        raise ImportSafetyError(
            f"Unexpected current public.slos total {current_total}; expected "
            f"{expected_current_total} (103 Computer Science XII plus any complete "
            "approved groups). Investigate before importing."
        )
    return ids, complete, cs_snapshot


def ensure_subject_rows(
    cursor: psycopg.Cursor[Any],
    ids: dict[tuple[str, str, int, str], int | None],
) -> None:
    for subject_key in APPROVED:
        name, grade_label, _, _ = subject_key
        cursor.execute(
            """
            INSERT INTO public.subjects (name, grade, board)
            VALUES (%s, %s, %s)
            ON CONFLICT (name, grade, board) DO NOTHING
            """,
            (name, grade_label, BOARD),
        )
        ids[subject_key] = subject_id_for(cursor, name, grade_label)
        if ids[subject_key] is None:
            raise ImportSafetyError(
                f"Could not resolve subject_id for {name} {grade_label} {BOARD}"
            )


def insert_rows(
    cursor: psycopg.Cursor[Any],
    ids: dict[tuple[str, str, int, str], int | None],
    complete: dict[tuple[str, str, int, str], bool],
    loaded: dict[tuple[str, str, int, str], list[dict[str, Any]]],
) -> int:
    placeholders = ", ".join(["%s"] * len(SLO_INSERT_COLUMNS))
    columns = ", ".join(SLO_INSERT_COLUMNS)
    query = (
        f"INSERT INTO public.slos ({columns}) VALUES ({placeholders}) "
        "ON CONFLICT (subject_id, slo_code) DO NOTHING"
    )
    inserted = 0
    for subject_key, rows in loaded.items():
        if complete[subject_key]:
            continue
        subject_id = ids[subject_key]
        if subject_id is None:
            raise ImportSafetyError(
                f"Missing subject_id for {subject_key[0]} {subject_key[1]}"
            )
        values = [
            (
                subject_id,
                row["chapter"],
                row["topic"],
                row["slo_code"],
                row["statement"],
                row["page"],
                subject_key[2],
                subject_key[3],
            )
            for row in rows
        ]
        cursor.executemany(query, values)
        inserted += cursor.rowcount
    return inserted


def verify_after_import(
    cursor: psycopg.Cursor[Any],
    ids: dict[tuple[str, str, int, str], int | None],
    loaded: dict[tuple[str, str, int, str], list[dict[str, Any]]],
    cs_snapshot_before: tuple[tuple[Any, ...], ...],
) -> None:
    for subject_key, rows in loaded.items():
        subject_id = ids[subject_key]
        assert subject_id is not None
        actual = fetch_subject_slos(cursor, subject_id)
        expected = {row["slo_code"]: source_record(row, subject_key) for row in rows}
        if actual != expected:
            raise ImportSafetyError(
                f"Post-import verification failed for {subject_key[0]} "
                f"{subject_key[1]}"
            )

    cursor.execute("SELECT count(*) FROM public.slos")
    total = cursor.fetchone()[0]
    if total != EXPECTED_TOTAL:
        raise ImportSafetyError(
            f"Expected {EXPECTED_TOTAL} total SLOs after import, found {total}"
        )

    cs_id = subject_id_for(cursor, PRESERVED_SUBJECT[0], PRESERVED_SUBJECT[1])
    if cs_id is None:
        raise ImportSafetyError("Computer Science XII subject disappeared")
    cs_snapshot_after = fetch_cs_xii_snapshot(cursor, cs_id)
    if cs_snapshot_after != cs_snapshot_before:
        raise ImportSafetyError(
            "Existing Computer Science XII SLO rows changed during the import"
        )

    cursor.execute(
        """
        SELECT subject_id, slo_code, count(*)
        FROM public.slos
        GROUP BY subject_id, slo_code
        HAVING count(*) > 1
        """
    )
    duplicates = cursor.fetchall()
    if duplicates:
        raise ImportSafetyError(f"Duplicate SLO keys found: {duplicates[:10]}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate and atomically import the seven approved syllabus JSON files. "
            "Defaults to a dry run; use --apply to commit."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the transaction after every safety check passes",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "DATABASE_URL is not set. Provide the Supabase PostgreSQL connection "
            "string through the environment; never place it in source files or "
            "command history."
        )

    loaded = load_approved_rows()
    print(
        f"Validated {sum(map(len, loaded.values()))} local SLO records across "
        f"{len(loaded)} approved subject/grade files."
    )
    mode = "APPLY (will commit)" if args.apply else "READ-ONLY DRY RUN (no writes)"
    print(f"Mode: {mode}")

    try:
        with psycopg.connect(
            database_url,
            sslmode="require",
            connect_timeout=10,
            application_name="babul-learn-verified-syllabus-import",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET TRANSACTION READ WRITE"
                    if args.apply
                    else "SET TRANSACTION READ ONLY"
                )
                cursor.execute("SET LOCAL lock_timeout = '5s'")
                cursor.execute("SET LOCAL statement_timeout = '120s'")
                ensure_schema(cursor)
                ids, complete, cs_snapshot = verify_existing_target(cursor, loaded)
                if args.apply:
                    ensure_subject_rows(cursor, ids)
                    inserted = insert_rows(cursor, ids, complete, loaded)
                    verify_after_import(cursor, ids, loaded, cs_snapshot)
                    print(
                        f"Post-import checks passed: {EXPECTED_TOTAL} total SLOs; "
                        f"{PRESERVED_SLO_COUNT} Computer Science XII rows preserved; "
                        f"{inserted} SLO rows inserted in this run."
                    )
                else:
                    to_insert = sum(
                        len(loaded[key]) for key in APPROVED if not complete[key]
                    )
                    print(
                        f"Read-only preflight passed. Planned SLO inserts: "
                        f"{to_insert}; expected post-import total: {EXPECTED_TOTAL}; "
                        f"{PRESERVED_SLO_COUNT} Computer Science XII rows verified."
                    )
            if not args.apply:
                print("Read-only dry run complete; no changes made.")
        if args.apply:
            print("Transaction committed.")
        return 0
    except psycopg.Error as exc:
        print(
            "Import aborted; no changes committed: database operation failed "
            f"({type(exc).__name__}); connection details are redacted.",
            file=sys.stderr,
        )
        return 1
    except ImportSafetyError as exc:
        print(f"Import aborted; no changes committed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
