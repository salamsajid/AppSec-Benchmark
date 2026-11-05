"""Mock OOB collaborator + interaction logger. LAB ONLY."""
from fastapi import FastAPI, Request
from datetime import datetime

app = FastAPI()
LOGS = []

@app.get("/")
def root():
    return {"ok": True, "logs": LOGS[-50:]}

@app.api_route("/log", methods=["GET", "POST", "PUT", "DELETE"])
async def log(request: Request):
    body = None
    try:
        body = await request.json()
    except Exception:
        body = (await request.body()).decode(errors="replace")[:2000]
    entry = {"ts": datetime.utcnow().isoformat(), "method": request.method, "path": str(request.url), "headers": dict(request.headers), "body": body, "client": request.client.host if request.client else None}
    LOGS.append(entry)
    print(f"OOB: {entry}", flush=True)
    return {"logged": True, "id": len(LOGS)}

@app.get("/logs")
def logs():
    return LOGS

@app.post("/clear")
def clear():
    """Internal test helper: reset the interaction log."""
    LOGS.clear()
    return {"cleared": True}
