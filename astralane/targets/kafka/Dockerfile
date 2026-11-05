FROM python:3.12-alpine

WORKDIR /app
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir kafka-python==2.2.15

COPY targets/kafka/app.py ./

EXPOSE 8091

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health', timeout=2).read()"

CMD ["python", "app.py"]
