#!/usr/bin/env python3
"""Substitui o histórico sintético OWNAGE pelos projetos reais das planilhas.

Fonte da verdade: data/2021.xlsx … data/2025.xlsx (aba 0).
O ano do KPI é o do arquivo — 2024/2025 têm datas de venda defasadas.
Totais conferidos com HIST_SUMMARY em age-ops-v4.html.
Não importa 2026 (fica em age_projects). Não toca outros tenants.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OWNAGE = "aa47f125-4b29-4c2d-b367-88b912f1b33e"
HIST_SUMMARY = {
    2021: {"fat": 67415, "n": 12},
    2022: {"fat": 109042, "n": 25},
    2023: {"fat": 210591, "n": 28},
    2024: {"fat": 162440, "n": 22},
    2025: {"fat": 110190, "n": 23},
}
SKIP = re.compile(r"^(total|soma|m[eê]dia|subtotal|grand)", re.I)
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
    "bill": "MC Bill",
    "irmas lira": "Irmas Lira",
    "irmãs lira": "Irmas Lira",
    "cinq": "CINQ",
    "giana": "Giana Mello",
    "giana mello": "Giana Mello",
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
    return re.sub(r"\s+", " ", s).strip()


def canonical(name: str) -> str:
    raw = re.sub(r"\s+", " ", (name or "").strip())
    if not raw:
        return ""
    return ALIASES.get(key_of(raw), raw)


def read_html_const(path: Path) -> tuple[str, str]:
    html = path.read_text(encoding="utf-8", errors="replace")
    url = re.search(r"const SUPABASE_URL\s*=\s*'([^']+)'", html).group(1)
    key = re.search(r"const SUPABASE_ANON_KEY\s*=\s*'([^']+)'", html).group(1)
    return url.rstrip("/"), key


def sb_request(base: str, key: str, method: str, path: str, body=None, extra_qs: str = "", extra_headers=None):
    url = f"{base}/rest/v1/{path}{extra_qs}"
    cmd = [
        "curl", "-sS", "-X", method, url,
        "-H", f"apikey: {key}",
        "-H", f"Authorization: Bearer {key}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: return=representation",
        "-w", "\n%{http_code}",
    ]
    if extra_headers:
        for h in extra_headers:
            cmd.extend(["-H", h])
    if body is not None:
        cmd.extend(["-d", json.dumps(body, ensure_ascii=False)])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    out = proc.stdout or ""
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
        parsed = [] if method in ("GET", "DELETE") else {}
    return code, parsed


def num(v) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace("R$", "").replace("$", "").replace(" ", "").strip()
    if re.match(r"^-?\d{1,3}(\.\d{3})*(,\d+)?$", s):
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def iso(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, date):
        return v.isoformat()
    return None


def month_of(v, sale, pay):
    try:
        m = int(v) if v not in (None, "") else 0
        if 1 <= m <= 12:
            return m
    except (TypeError, ValueError):
        pass
    for d in (sale, pay):
        if isinstance(d, (datetime, date)):
            return d.month
    return None


def parse_year_xlsx(yr: int) -> list[dict]:
    path = ROOT / "data" / f"{yr}.xlsx"
    wb = load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        client = row[0] or ""
        if not isinstance(client, str):
            continue
        client = re.sub(r"\s+", " ", client).strip()
        if not client or SKIP.match(client):
            continue
        proj = row[1] or ""
        proj = proj.strip() if isinstance(proj, str) else (str(proj) if proj is not None else "")
        proj = re.sub(r"\s+", " ", proj).strip()
        fat = num(row[7])
        if fat <= 0 and not proj:
            continue
        cost = num(row[8])
        profit = num(row[9])
        margin = num(row[10])
        if 0 < margin <= 1.5:
            margin = round(margin * 100, 1)
        nps = num(row[13]) if len(row) > 13 else 0
        if nps > 10:
            nps = 0
        novo = str(row[5] or "").strip()
        out.append({
            "year": yr,
            "month": month_of(row[4], row[2], row[3]),
            "client_name": canonical(client),
            "project_name": proj,
            "sale_date": iso(row[2]),
            "payment_date": iso(row[3]),
            "is_new_client": bool(re.match(r"^(sim|yes|true|1)$", novo, re.I)),
            "value": round(fat, 2),
            "cost": round(cost, 2),
            "profit": round(profit if profit else fat - cost, 2),
            "margin_pct": round(margin, 1) if margin else (round((fat - cost) / fat * 100, 1) if fat else 0),
            "category": str(row[11] or "").strip() or None,
            "segment": str(row[12] or "").strip() or None,
            "nps": nps if nps else None,
            "status": "concluido",
        })
    return out


def summarize(rows: list[dict]) -> dict:
    bag = defaultdict(lambda: {"n": 0, "fat": 0.0})
    for r in rows:
        bag[r["year"]]["n"] += 1
        bag[r["year"]]["fat"] += r["value"]
    return bag


def fetch_hist(base, key) -> list[dict]:
    code, body = sb_request(
        base, key, "GET", "age_hist_projects",
        extra_qs=f"?company_id=eq.{OWNAGE}&select=id,year,client_name,project_name,value&limit=5000",
    )
    if code != 200 or not isinstance(body, list):
        raise SystemExit(f"GET hist falhou HTTP {code} {body}")
    return body


def main():
    base, key = read_html_const(ROOT / "age-ops-v4.html")
    real = []
    for yr in range(2021, 2026):
        real.extend(parse_year_xlsx(yr))

    print("=== PLANILHA (fonte) ===")
    sums = summarize(real)
    mismatch = False
    for yr in range(2021, 2026):
        got = sums[yr]
        exp = HIST_SUMMARY[yr]
        d_fat = round(got["fat"]) - exp["fat"]
        d_n = got["n"] - exp["n"]
        ok = d_fat == 0 and d_n == 0
        if not ok:
            mismatch = True
        print(f"  {yr}: n={got['n']} fat={got['fat']:.0f}  planilha n={exp['n']} fat={exp['fat']}  {'OK' if ok else f'DIFF n={d_n} fat={d_fat}'}")
    if mismatch:
        raise SystemExit("Totais da planilha não batem com HIST_SUMMARY — abortando.")

    current = fetch_hist(base, key)
    print(f"\n=== BANCO atual OWNAGE hist: {len(current)} linhas ===")
    cur_sum = defaultdict(lambda: {"n": 0, "fat": 0.0})
    for r in current:
        y = int(r.get("year") or 0)
        cur_sum[y]["n"] += 1
        cur_sum[y]["fat"] += float(r.get("value") or 0)
    for yr in sorted(cur_sum):
        print(f"  {yr}: n={cur_sum[yr]['n']} fat={cur_sum[yr]['fat']:.0f}")
    fake = [r for r in current if re.search(r"oficial|2021-0|videoclipe oficial", str(r.get("project_name") or ""), re.I)]
    print(f"  nomes sintéticos detectados: {len(fake)}")

    ids = [r["id"] for r in current if r.get("id")]
    print(f"\n[1] apagando {len(ids)} linhas OWNAGE em age_hist_projects")
    deleted = 0
    for i in range(0, len(ids), 40):
        chunk = ids[i:i + 40]
        flt = ",".join(str(x) for x in chunk)
        code, resp = sb_request(
            base, key, "DELETE", "age_hist_projects",
            extra_qs=f"?id=in.({flt})&company_id=eq.{OWNAGE}",
        )
        if code not in (200, 204):
            raise SystemExit(f"DELETE falhou HTTP {code} {resp}")
        deleted += len(resp) if isinstance(resp, list) else len(chunk)
    leftover = fetch_hist(base, key)
    if leftover:
        raise SystemExit(f"ainda restam {len(leftover)} linhas OWNAGE — abortando insert")
    print(f"  apagadas={deleted} restante=0")

    print(f"\n[2] inserindo {len(real)} linhas reais")
    # probe columns with a dummy GET
    cols = {
        "year", "month", "client_name", "project_name", "segment", "category",
        "value", "cost", "profit", "margin_pct", "nps", "is_new_client",
        "sale_date", "payment_date", "status", "company_id", "created_by", "deleted",
    }
    ins = err = 0
    for row in real:
        mapping = {
            "year": row["year"],
            "month": row.get("month"),
            "client_name": row["client_name"],
            "project_name": row.get("project_name") or "",
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
        else:
            err += 1
            print(f"  ! {row['year']} {row['client_name']} {row['project_name']} HTTP {code} {resp}")
    print(f"  inseridos={ins} erros={err}")

    after = fetch_hist(base, key)
    after_sum = defaultdict(lambda: {"n": 0, "fat": 0.0})
    clients = defaultdict(lambda: {"n": 0, "fat": 0.0})
    for r in after:
        y = int(r.get("year") or 0)
        after_sum[y]["n"] += 1
        after_sum[y]["fat"] += float(r.get("value") or 0)
        nm = canonical(r.get("client_name") or "")
        clients[nm]["n"] += 1
        clients[nm]["fat"] += float(r.get("value") or 0)

    print("\n=== BANCO depois vs planilha ===")
    ok_all = err == 0
    for yr in range(2021, 2026):
        got = after_sum[yr]
        exp = HIST_SUMMARY[yr]
        d_fat = round(got["fat"]) - exp["fat"]
        d_n = got["n"] - exp["n"]
        ok = d_fat == 0 and d_n == 0
        ok_all = ok_all and ok
        print(f"  {yr}: n={got['n']} fat={got['fat']:.0f}  {'OK' if ok else f'DIFF n={d_n} fat={d_fat}'}")
    print(f"clientes únicos hist: {len(clients)}")
    print("top 10:")
    for name, d in sorted(clients.items(), key=lambda x: -x[1]["fat"])[:10]:
        print(f"  {name:28} {d['n']:3}p  R${d['fat']:10.0f}")
    if not ok_all:
        sys.exit(1)
    print("\nPronto: faturamento 2021–2025 bate com as planilhas.")


if __name__ == "__main__":
    main()
