"""Read-only Dynamics connection check; prints no credentials or token."""

import asyncio
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.services.auth import get_access_token
from backend.app.services.dynamics import get_pe_qualified_leads


def safe_error(exc):
    if isinstance(exc, httpx.HTTPStatusError):
        return {"type": type(exc).__name__, "status": exc.response.status_code}
    if isinstance(exc, httpx.RequestError):
        return {"type": type(exc).__name__}
    message = str(exc)
    if message.startswith("Token error:"):
        try:
            body = json.loads(message.removeprefix("Token error:").strip())
            return {
                "type": "TokenError",
                "error": body.get("error"),
                "error_codes": body.get("error_codes"),
            }
        except json.JSONDecodeError:
            return {"type": "TokenError"}
    if message.startswith("Dynamics GET error:"):
        return {"type": "DynamicsGetError"}
    return {"type": type(exc).__name__}


async def main():
    try:
        token = await get_access_token()
        print(json.dumps({"token_request": "success", "token_length": len(token)}))
    except Exception as exc:
        print(json.dumps({"token_request": "failed", **safe_error(exc)}))
        return

    try:
        result = await get_pe_qualified_leads(limit=1)
        print(json.dumps({"pe_request": "success", "count": result.get("count")}))
    except Exception as exc:
        print(json.dumps({"pe_request": "failed", **safe_error(exc)}))


if __name__ == "__main__":
    asyncio.run(main())
