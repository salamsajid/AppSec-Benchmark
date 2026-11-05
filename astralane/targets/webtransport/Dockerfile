FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir aioquic==1.7.0

COPY targets/webtransport/app.py ./

EXPOSE 8096/udp
EXPOSE 8097/tcp
EXPOSE 8098/tcp

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8097/health', timeout=2).read()"

CMD ["python", "app.py"]
