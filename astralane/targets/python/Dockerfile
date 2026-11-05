FROM python:3.12-alpine

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1

COPY targets/python/app.py ./

EXPOSE 8083

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8083/health', timeout=2).read()"

CMD ["python", "app.py"]
