"""Three comparable local HTTP/API timing runs for the Week 1 assessment.

Run from the repository root after serving frontend/build on localhost:3000:
    backend/.venv/bin/python audit/measure_week1.py

The API dependency is overridden with an audit identity; no user record is created.
External integrations are not mocked, so their error statuses remain visible.
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.main import app
from backend.app.routes.auth import require_user


OUTPUT = Path(__file__).with_name("timings.json")
FRONTEND = "http://127.0.0.1:3000"


def frontend_get(path):
    started = time.perf_counter()
    with urllib.request.urlopen(f"{FRONTEND}{path}", timeout=20) as response:
        first_byte_ms = (time.perf_counter() - started) * 1000
        body = response.read()
        total_ms = (time.perf_counter() - started) * 1000
        return {
            "status": response.status,
            "bytes": len(body),
            "first_byte_ms": round(first_byte_ms, 2),
            "total_ms": round(total_ms, 2),
        }


def api_get(client, path):
    started = time.perf_counter()
    response = client.get(path)
    return {
        "status": response.status_code,
        "bytes": len(response.content),
        "total_ms": round((time.perf_counter() - started) * 1000, 2),
    }


def main():
    index = frontend_get("/")
    index_html = urllib.request.urlopen(f"{FRONTEND}/", timeout=20).read().decode()
    import re

    asset = re.search(r'/static/js/main\.[^" ]+\.js', index_html)
    if not asset:
        raise RuntimeError("Compiled main JavaScript asset was not found")
    js_path = asset.group(0)

    app.dependency_overrides[require_user] = lambda: {"name": "Audit"}
    try:
        with TestClient(app) as client:
            runs = []
            for number in range(1, 4):
                runs.append(
                    {
                        "run": number,
                        "frontend_index": frontend_get("/"),
                        "frontend_js": frontend_get(js_path),
                        "organizations": api_get(client, "/organizations"),
                        "users": api_get(client, "/users"),
                        "pe_qualified_leads": api_get(client, "/pe-qualified-leads"),
                    }
                )
    finally:
        app.dependency_overrides.clear()

    output = {
        "method": "Sequential requests, same process and compiled frontend, three runs; warmup GET of index before run 1. Frontend timings include localhost HTTP transfer but not browser render. API timings use FastAPI TestClient in process and include route/service work but not network transport.",
        "frontend_js_path": js_path,
        "warmup_index": index,
        "runs": runs,
    }
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
