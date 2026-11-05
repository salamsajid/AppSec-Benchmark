import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.get("FLAG_PYTHON", "ASTRA{python_format_sandbox_d3b8}")
CHARSET_FLAG = os.environ.get("FLAG_CHARSET", "ASTRA{charset_ebcdic_spel_c04b}")
PORT = int(os.environ.get("PORT", "8083"))

with open("/flag", "w", encoding="utf-8") as handle:
    handle.write(FLAG + "\n")
os.chmod("/flag", 0o444)


class RenderContext:
    def __init__(self):
        self.name = "visitor"
        self.role = "member"
        self.plan = "standard"


def render_template(template):
    def resolve(match):
        expression = match.group(1).strip()
        if not expression:
            return ""
        return str(eval(f"ctx.{expression}", {"__builtins__": __builtins__}, {"ctx": RenderContext()}))

    return re.sub(r"\{([^{}]+)\}", resolve, template)


class Handler(BaseHTTPRequestHandler):
    server_version = "AstraLaneRender/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("x-content-type-options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "astralane-python-format"})
            return
        if self.path in ("/", "/format"):
            self.send_json(200, {
                "service": "astralane-python-format",
                "formatEndpoint": "/arena/python/format",
                "body": {"template": "Hello {name}"},
                "hint": "The template resolver evaluates the contents of each format field as Python instead of resolving a safe attribute path.",
            })
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in ("/format", "/charset"):
            self.send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > 64 * 1024:
                raise ValueError("invalid body length")
            raw = self.rfile.read(length)
        except Exception as error:
            self.send_json(400, {"error": str(error)})
            return

        if self.path == "/charset":
            utf8_view = raw.decode("utf-8", errors="replace")
            if "grant-admin" in utf8_view:
                self.send_json(403, {"error": "request rejected by the UTF-8 policy filter"})
                return
            ebcdic_view = raw.decode("cp037", errors="replace")
            if "grant-admin" not in ebcdic_view:
                self.send_json(400, {"error": "backend did not observe an authorization command"})
                return
            self.send_json(200, {"ok": True, "flag": CHARSET_FLAG})
            return

        try:
            body = json.loads(raw.decode("utf-8"))
            template = body.get("template")
            if not isinstance(template, str):
                raise ValueError("template must be a string")
            rendered = render_template(template)
        except Exception as error:
            self.send_json(400, {"error": str(error)})
            return

        payload = {"ok": True, "rendered": rendered}
        if FLAG in rendered:
            payload["flag"] = FLAG
        self.send_json(200, payload)

    def log_message(self, _format, *_args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
