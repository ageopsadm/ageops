#!/usr/bin/env python3
"""Cadastra clientes únicos da OWNAGE em age_clients_db, com valores conferidos.

Fontes (sem somar a mesma linha duas vezes):
  - data/2021.xlsx … data/2025.xlsx  (histórico — fonte da verdade)
  - age_projects no Supabase         (2026 ao vivo, conta gustavowng / OWNAGE)

Não grava linha da OWNAGE em outra empresa. Dedup por nome normalizado.
Atualiza total_value se o cadastro já existir.
"""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
import ssl
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OWNAGE = "aa47f125-4b29-4c2d-b367-88b912f1b33e"
CUR_YEAR = 2026

ALIASES = {
    "jonas": "Jonas Pastore",
    "jonas pastore": "Jonas Pastore",
    "cobertec e solutec": "Cobertec & Solutec",
    "cobertec & solutec": "Cobertec & Solutec",
    "cobertec": "Cobertec & Solutec",
    "talita perosa": "Talita Perosa Nutri",
    "talita perosa nutri": "Talita Perosa Nutri",
    "yuri": "Yuri Guillen",
    "yuri guillen": "Yuri Guillen",
    "kim": "Guilherme Kim",
    "kim nefasto": "Guilherme Kim",
    "guilherme kim": "Guilherme Kim",
    "jay p": "JAY P",
    "jay": "JAY P",
    "joao": "JAY P",
    "joão": "JAY P",
    "lou garcia": "LOU GARCIA",
    "universal music": "UNIVERSAL MUSIC",
    "kg network": "KG NETWORK",
    "mc bill": "MC Bill",
    "irmas lira": "Irmas Lira",
    "irmãs lira": "Irmas Lira",
    "vic": "Victoria Brito",
    "victoria": "Victoria Brito",
    "victoria brito": "Victoria Brito",
    "sub": "Thiago Sub",
    "thiago sub": "Thiago Sub",
    "tony": "Tony",
}


def key_of(name: str) -> str:
    s = re.sub(r"\s+", " ", (name or "").strip().lower())
    s = s.replace("&", "e")
    s = re.sub(r"[^\w\s]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def canonical(name: str) -> str:
    raw = re.sub(r"\s+", " ", (name or "").strip())
    if not raw:
        return ""
    k = key_of(raw)
    if k in ALIASES:
        return ALIASES[k]
    # fallback aliases dict uses original lower with &
    k2 = re.sub(r"\s+", " ", raw.lower())
    return ALIASES.get(k2, raw)


def read_html_const(path: Path) -> tuple[str, str]:
    html = path.read_text(encoding="utf-8", errors="replace")
    url = re.search(r"const SUPABASE_URL\s*=\s*'([^']+)'", html).group(1)
    key = re.search(r"const SUPABASE_ANON_KEY\s*=\s*'([^']+)'", html).group(1)
    return url.rstrip("/"), key


def sb_request(base: str, key: str, method: str, path: str, body=None, extra_qs: str = ""):
    url = f"{base}/rest/v1/{path}{extra_qs}"
    cmd = [
        "curl", "-sS", "-X", method, url,
        "-H", f"apikey: {key}",
        "-H", f"Authorization: Bearer {key}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: return=representation",
        "-w", "\n%{http_code}",
    ]
    if body is not None:
        cmd.extend(["-d", json.dumps(body, ensure_ascii=False)])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    out = proc.stdout or ""
    if "\n" not in out:
        return proc.returncode or 1, {"message": proc.stderr or out}
    raw, _, code_s = out.rpartition("\n")
    try:
        code = int(code_s.strip())
    except ValueError:
        code = proc.returncode or 1
        raw = out
    parsed = None
    if raw.strip():
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"message": raw}
    else:
        parsed = [] if method == "GET" else {}
    return code, parsed


def extract_hist_projects() -> list[dict]:
    """Linhas reais de data/2021.xlsx…2025.xlsx — nunca o PROJECTS_DATA sintético."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from reimport_ownage_hist import parse_year_xlsx
    rows = []
    for yr in range(2021, 2026):
        rows.extend(parse_year_xlsx(yr))
    return rows


def extract_sheet_2026() -> list[dict]:
    text = (ROOT / "age-ops-v4.html").read_text(encoding="utf-8", errors="replace")
    m = re.search(r"const _OWNAGE_PROJ_SHEET = \[(.*?)\];", text, re.S)
    if not m:
        return []
    rows = []
    for rec in re.finditer(r"\{([^}]+)\}", m.group(1)):
        body = rec.group(1)
        cm = re.search(r'cliente:"([^"]+)"', body)
        fm = re.search(r"fat:(\d+\.?\d*)", body)
        nm = re.search(r"nps:(\d+\.?\d*)", body)
        if not cm:
            continue
        rows.append({
            "year": 2026,
            "client_name": cm.group(1),
            "value": float(fm.group(1) if fm else 0),
            "nps": float(nm.group(1) if nm else 0),
        })
    return rows


def extract_csv_2026() -> list[dict]:
    path = ROOT / "exports/OWNAGE_projetos.csv"
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            name = (r.get("cliente") or "").strip()
            if not name:
                continue
            rows.append({
                "year": 2026,
                "client_name": name,
                "value": float(r.get("faturamento") or 0),
                "nps": float(r.get("nps") or 0),
            })
    return rows


def probe_table_columns(base, key, table: str) -> set[str]:
    candidates = [
        "id", "created_at", "updated_at", "deleted", "company_id", "created_by",
        "name", "client_name", "cliente", "client", "notes", "email", "phone",
        "status", "total_value", "total_projects", "first_year", "last_year",
        "avg_nps", "years_active", "segment", "category", "last_project_date",
        "project_name", "year", "month", "value", "cost", "profit", "margin_pct",
        "nps", "is_new_client", "sale_date", "payment_date",
    ]
    found = set()
    for col in candidates:
        code, body = sb_request(base, key, "GET", table, extra_qs=f"?select={col}&limit=1")
        msg = str(body)
        if code == 200:
            found.add(col)
        elif "42703" in msg or "does not exist" in msg or "Could not find" in msg:
            continue
    return found


def fetch_live_projects(base, key) -> list[dict]:
    code, body = sb_request(
        base, key, "GET", "age_projects",
        extra_qs=f"?company_id=eq.{OWNAGE}&select=client_name,total_value,nps&limit=2000",
    )
    if code != 200 or not isinstance(body, list):
        print("avisos: age_projects", code, body)
        return []
    rows = []
    for p in body:
        name = (p.get("client_name") or "").strip()
        if not name:
            continue
        rows.append({
            "year": 2026,
            "client_name": name,
            "value": float(p.get("total_value") or 0),
            "nps": float(p.get("nps") or 0),
        })
    return rows


def fetch_existing(base, key, name_col: str) -> dict[str, dict]:
    sel = f"id,{name_col}"
    code, body = sb_request(
        base, key, "GET", "age_clients_db",
        extra_qs=f"?company_id=eq.{OWNAGE}&select={sel}&limit=2000",
    )
    if code != 200:
        # table may not have company_id
        code, body = sb_request(base, key, "GET", "age_clients_db", extra_qs=f"?select={sel}&limit=2000")
    existing = {}
    if code == 200 and isinstance(body, list):
        for r in body:
            n = canonical(r.get(name_col) or "")
            if n:
                existing[key_of(n)] = r
    else:
        print("avisos: existing", code, body)
    return existing


def build_clients(events: list[dict]) -> list[dict]:
    bag = defaultdict(lambda: {
        "name": "", "fat": 0.0, "n": 0, "nps_sum": 0.0, "nps_n": 0, "years": set()
    })
    for e in events:
        name = canonical(e["client_name"])
        if not name:
            continue
        k = key_of(name)
        b = bag[k]
        if not b["name"] or len(name) > len(b["name"]):
            b["name"] = name
        b["fat"] += float(e.get("value") or 0)
        b["n"] += 1
        nps = float(e.get("nps") or 0)
        if nps > 0:
            b["nps_sum"] += nps
            b["nps_n"] += 1
        b["years"].add(int(e["year"]))
    out = []
    for b in bag.values():
        years = sorted(b["years"])
        last = years[-1]
        first = years[0]
        if last >= CUR_YEAR:
            status = "ativo"
        elif last >= CUR_YEAR - 1:
            status = "recorrente"
        else:
            status = "inativo"
        avg = round(b["nps_sum"] / b["nps_n"], 1) if b["nps_n"] else None
        out.append({
            "name": b["name"],
            "first_year": first,
            "last_year": last,
            "total_projects": b["n"],
            "total_value": round(b["fat"], 2),
            "avg_nps": avg,
            "status": status,
            "years_active": ",".join(str(y) for y in years),
            "notes": "Cadastro OWNAGE conferido nas planilhas 2021–2025 (faturamento da planilha) + projetos 2026.",
        })
    out.sort(key=lambda x: -x["total_value"])
    return out


def payload_for(row: dict, cols: set[str], name_col: str) -> dict:
    mapping = {
        name_col: row["name"],
        "first_year": row["first_year"],
        "last_year": row["last_year"],
        "total_projects": row["total_projects"],
        "total_value": row["total_value"],
        "avg_nps": row["avg_nps"],
        "status": row["status"],
        "years_active": row["years_active"],
        "notes": row["notes"],
        "company_id": OWNAGE,
        "created_by": "gustavowng",
        "deleted": False,
    }
    return {k: v for k, v in mapping.items() if k in cols and v is not None}


def hist_dup_key(row: dict) -> str:
    return "|".join([
        str(row.get("year") or ""),
        key_of(canonical(row.get("client_name") or "")),
        re.sub(r"\s+", " ", (row.get("project_name") or "").strip().lower()),
    ])


def fetch_existing_hist(base, key) -> set[str]:
    code, body = sb_request(
        base, key, "GET", "age_hist_projects",
        extra_qs=f"?company_id=eq.{OWNAGE}&select=year,client_name,project_name&limit=5000",
    )
    if code != 200 or not isinstance(body, list):
        code, body = sb_request(base, key, "GET", "age_hist_projects", extra_qs="?select=year,client_name,project_name&limit=5000")
    keys = set()
    if code == 200 and isinstance(body, list):
        for r in body:
            keys.add(hist_dup_key(r))
    else:
        print("avisos: hist existing", code, body)
    return keys


def seed_hist(base, key, hist_rows: list[dict], cols: set[str]) -> tuple[int, int, int]:
    existing = fetch_existing_hist(base, key)
    ins = skip = err = 0
    for row in hist_rows:
        row = {**row, "client_name": canonical(row["client_name"])}
        k = hist_dup_key(row)
        if k in existing:
            skip += 1
            continue
        mapping = {
            "year": row["year"],
            "month": row.get("month"),
            "client_name": row["client_name"],
            "project_name": row.get("project_name"),
            "segment": row.get("segment"),
            "category": row.get("category"),
            "value": row.get("value"),
            "cost": row.get("cost"),
            "profit": row.get("profit"),
            "margin_pct": row.get("margin_pct"),
            "nps": row.get("nps"),
            "is_new_client": row.get("is_new_client"),
            "sale_date": row.get("sale_date"),
            "payment_date": row.get("payment_date"),
            "status": row.get("status"),
            "company_id": OWNAGE,
            "created_by": "gustavowng",
            "deleted": False,
        }
        body = {k: v for k, v in mapping.items() if k in cols and v is not None}
        if "client_name" not in body and "client_name" in mapping:
            body["client_name"] = mapping["client_name"]
        if "company_id" not in body:
            body["company_id"] = OWNAGE
        code, resp = sb_request(base, key, "POST", "age_hist_projects", body)
        tries = 0
        while code >= 400 and tries < 12:
            msg = str(resp)
            m = re.search(r"Could not find the '([^']+)' column", msg)
            if not m:
                break
            body.pop(m.group(1), None)
            cols.discard(m.group(1))
            code, resp = sb_request(base, key, "POST", "age_hist_projects", body)
            tries += 1
        if code in (200, 201):
            ins += 1
            existing.add(k)
        else:
            err += 1
            print(f"  hist ! {row.get('year')} {row.get('client_name')} {row.get('project_name')} HTTP {code} {resp}")
    return ins, skip, err


def main():
    html = ROOT / "age-ops-v4.html"
    base, key = read_html_const(html)

    hist = extract_hist_projects()
    live = fetch_live_projects(base, key)
    print(f"fontes: hist={len(hist)} live2026={len(live)}")

    events = hist + live
    clients = build_clients(events)
    print(f"únicos após dedup: {len(clients)}")
    print(f"faturamento cadastro: {sum(c['total_value'] for c in clients):.2f}")

    print("\n[1] age_hist_projects (aba Clientes lê 2021–2025 daqui)")
    hist_cols = probe_table_columns(base, key, "age_hist_projects")
    print("colunas hist:", ", ".join(sorted(hist_cols)) or "(?)")
    h_ins = h_skip = h_err = 0
    if "client_name" in hist_cols or True:
        h_ins, h_skip, h_err = seed_hist(base, key, hist, hist_cols)
    print(f"hist inseridos={h_ins} já existiam={h_skip} erros={h_err}")

    print("\n[2] age_clients_db")
    cols = probe_table_columns(base, key, "age_clients_db")
    print("colunas age_clients_db:", ", ".join(sorted(cols)) or "(nenhuma?)")
    name_col = next((c for c in ("client_name", "name", "cliente", "client") if c in cols), None)
    inserted = skipped = 0
    errors = []
    if not name_col:
        print("age_clients_db ainda não tem coluna de nome — clientes aparecem via histórico.")
        print("Rode supabase/sql/age_clients_db_colunas.sql no SQL Editor para persistir o cadastro.")
    else:
        existing = fetch_existing(base, key, name_col)
        print(f"já no banco (OWNAGE): {len(existing)}")
        updated = 0
        for c in clients:
            k = key_of(c["name"])
            body = payload_for(c, cols, name_col)
            if not body.get(name_col):
                body[name_col] = c["name"]
            if "company_id" not in body:
                body["company_id"] = OWNAGE
            prev = existing.get(k)
            if prev and prev.get("id"):
                code, resp = sb_request(
                    base, key, "PATCH", "age_clients_db", body,
                    extra_qs=f"?id=eq.{prev['id']}&company_id=eq.{OWNAGE}",
                )
                action = "upd"
            else:
                code, resp = sb_request(base, key, "POST", "age_clients_db", body)
                action = "ins"
            tries = 0
            while code >= 400 and tries < 12:
                msg = str(resp)
                m = re.search(r"Could not find the '([^']+)' column", msg)
                if not m:
                    break
                body.pop(m.group(1), None)
                cols.discard(m.group(1))
                if action == "upd":
                    code, resp = sb_request(
                        base, key, "PATCH", "age_clients_db", body,
                        extra_qs=f"?id=eq.{prev['id']}&company_id=eq.{OWNAGE}",
                    )
                else:
                    code, resp = sb_request(base, key, "POST", "age_clients_db", body)
                tries += 1
            if code in (200, 201, 204):
                if action == "upd":
                    updated += 1
                else:
                    inserted += 1
                    existing[k] = {}
                print(f"  {'~' if action=='upd' else '+'} {c['name']}  {c['total_projects']}p  R${c['total_value']:.0f}")
            else:
                errors.append((c["name"], code, resp))
                print(f"  ! {c['name']}  HTTP {code} {resp}")
        skipped = 0
        print(f"(atualizados={updated})")

    print("\n=== RESUMO ===")
    print(f"história: +{h_ins} / skip {h_skip} / err {h_err}")
    print(f"cadastro clientes: +{inserted} / skip {skipped} / err {len(errors)}")
    print("Obs: se age_clients_db não tiver coluna client_name, rode supabase/sql/age_clients_db_colunas.sql")
    print("lista única:")
    for c in clients:
        print(f"  {c['name']:28} {c['total_projects']:3}p  {c['status']:10}  {c['years_active']}")


if __name__ == "__main__":
    main()
