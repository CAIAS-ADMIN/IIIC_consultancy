"""
Bulk-imports a "Staff List Report" .xlsx (columns: Sl No, Empid, Name, Email ID,
Phone No, Department, Role) into:
  1. keycloak/realm-export.json — one Keycloak user per row (no password;
     Google-only sign-in), with employee_id/phone as user attributes.
  2. A generated SQL file that upserts matching `departments` and `users`
     rows directly into Postgres, keyed by the same Keycloak user id, so
     departmentId/employeeId/phone are already correct before anyone's
     first login.

This does NOT touch Keycloak's Google identity provider config or restart
any container — run those steps separately (see
claudereadme/Caias consultancy backend build plan .md and the auth.ts /
realm-export.json comments for the Google OAuth wiring).

Usage:
    python scripts/import-faculty.py "path/to/Staff List Report.xlsx" \
        --realm-export keycloak/realm-export.json \
        --sql-out /tmp/import_faculty.sql \
        --role faculty

After running, apply the SQL against the dev Postgres container and restart
Keycloak to pick up the new realm-export.json:
    docker cp /tmp/import_faculty.sql application-postgres-1:/tmp/import_faculty.sql
    docker exec application-postgres-1 psql -U caias -d caias_consultancy -f /tmp/import_faculty.sql
    docker compose up -d --force-recreate keycloak

Caveat: the dev Keycloak container has no persistent volume — every restart
reimports realm-export.json from scratch, which is what makes editing this
file (rather than only calling the Admin REST API) the durable way to add
users in this project's dev setup.
"""

import argparse
import json
import re
import sys
import uuid
from pathlib import Path

import openpyxl

CANON_DEPTS = {
    "ARTS AND HUMANITIES": "AH",
    "SCIENCE": "SCI",
    "MANAGEMENT": "MGMT",
    "COMPUTER SCIENCE": "CS",
    "COMMERCE": "COM",
    "ACCOUNTS": "ACC",
    "ADMINISTRATION": "ADMIN",
    "HR": "HR",
    "IT SERVICE": "ITS",
    "FACILITY": "FAC",
    "MEDIA": "MEDIA",
    "PHYSICAL EDUCATION": "PE",
}

HONORIFICS = {"mr", "mr.", "ms", "ms.", "mrs", "mrs.", "dr", "dr.", "miss", "miss."}


def resolve_department(raw: str) -> tuple[str, str]:
    """Best-guess a canonical department name out of a possibly comma-joined,
    messy raw value. Prefers whichever comma-segment matches a known
    department name exactly; falls back to the first segment, flagged."""
    segs = [s.strip() for s in raw.split(",")]
    if len(segs) == 1:
        name = segs[0].upper()
        return name, "exact" if name in CANON_DEPTS else "unmatched"
    matches = [s for s in segs if s.upper() in CANON_DEPTS]
    if matches:
        return matches[0].upper(), "resolved-from-multi"
    return segs[0].upper(), "unmatched-fallback-first"


def split_name(name: str) -> tuple[str, str]:
    tokens = name.strip().split()
    while tokens and tokens[0].lower() in HONORIFICS:
        tokens.pop(0)
    if not tokens:
        return name.strip(), ""
    first, rest = tokens[0], tokens[1:]
    return first, " ".join(rest)


def esc(s: str) -> str:
    return s.replace("'", "''")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx_path")
    ap.add_argument("--realm-export", default="keycloak/realm-export.json")
    ap.add_argument("--sql-out", default="import_faculty.sql")
    ap.add_argument("--role", default="faculty", help="Realm role to assign every imported user")
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx_path, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    records = []
    flagged = []
    for r in rows:
        sl, empid, name, email, phone, dept_raw, role = r[:7]
        dept_name, status = resolve_department(str(dept_raw))
        if dept_name not in CANON_DEPTS:
            print(f"ERROR row {sl} ({name}): unresolvable department '{dept_raw}' — add it to CANON_DEPTS", file=sys.stderr)
            sys.exit(1)
        if status != "exact":
            flagged.append(f"row {sl} ({name}): dept_raw='{dept_raw}' -> resolved='{dept_name}' ({status})")
        first, last = split_name(str(name))
        records.append({
            "sl": sl, "empid": str(empid), "name": str(name).strip(),
            "email": str(email).strip().lower(), "phone": str(phone).strip(),
            "dept_name": dept_name, "firstName": first, "lastName": last or first,
            "keycloak_id": str(uuid.uuid4()),
        })

    if flagged:
        print(f"Flagged {len(flagged)} department resolutions for review:", file=sys.stderr)
        print("\n".join(flagged), file=sys.stderr)

    # 1. Merge into realm-export.json
    realm_path = Path(args.realm_export)
    realm = json.loads(realm_path.read_text())

    client = realm["clients"][0]
    existing_mappers = {m["name"] for m in client["protocolMappers"]}
    for name, attr in (("employee-id-attribute", "employee_id"), ("phone-attribute", "phone")):
        if name not in existing_mappers:
            client["protocolMappers"].append({
                "name": name, "protocol": "openid-connect",
                "protocolMapper": "oidc-usermodel-attribute-mapper",
                "consentRequired": False,
                "config": {
                    "userinfo.token.claim": "true", "user.attribute": attr,
                    "id.token.claim": "true", "access.token.claim": "true",
                    "claim.name": attr, "jsonType.label": "String",
                },
            })

    existing_emails = {u["email"] for u in realm["users"] if "email" in u}
    added = 0
    for r in records:
        if r["email"] in existing_emails:
            continue
        realm["users"].append({
            "id": r["keycloak_id"], "username": r["email"], "email": r["email"],
            "enabled": True, "emailVerified": True,
            "firstName": r["firstName"], "lastName": r["lastName"],
            "attributes": {"employee_id": [r["empid"]], "phone": [r["phone"]]},
            "realmRoles": [args.role],
        })
        added += 1

    realm_path.write_text(json.dumps(realm, indent=2))
    print(f"Merged {added} new users into {realm_path} (skipped {len(records) - added} already-present emails)")

    # 2. Generate the matching Postgres SQL
    used_depts = sorted({r["dept_name"] for r in records})
    lines = ["BEGIN;", "", "-- Departments (idempotent upsert by code)"]
    for name, code in CANON_DEPTS.items():
        if name in used_depts:
            lines.append(
                f"INSERT INTO departments (name, code) VALUES ('{esc(name)}', '{code}') "
                f"ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now();"
            )
    lines.append("")
    lines.append(f"-- {len(records)} users, keyed by the Keycloak user id assigned above")
    for r in records:
        lines.append(
            "INSERT INTO users (keycloak_sub, name, email, employee_id, phone, department_id, roles) "
            f"VALUES ('{r['keycloak_id']}', '{esc(r['name'])}', '{esc(r['email'])}', "
            f"'{esc(r['empid'])}', '{esc(r['phone'])}', "
            f"(SELECT id FROM departments WHERE code = '{CANON_DEPTS[r['dept_name']]}'), "
            f"ARRAY['{args.role}']::role[]) "
            "ON CONFLICT (keycloak_sub) DO UPDATE SET "
            "name = EXCLUDED.name, email = EXCLUDED.email, employee_id = EXCLUDED.employee_id, "
            "phone = EXCLUDED.phone, department_id = EXCLUDED.department_id, updated_at = now();"
        )
    lines.append("")
    lines.append("COMMIT;")

    Path(args.sql_out).write_text("\n".join(lines))
    print(f"Wrote {args.sql_out} ({len(records)} user rows, {len(used_depts)} departments)")


if __name__ == "__main__":
    main()
