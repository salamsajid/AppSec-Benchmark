# INTENTIONALLY VULNERABLE GATEWAY LAB - LAB ONLY
FROM python:3.11-slim
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py raw_server.py start.sh ./
RUN chmod +x start.sh
EXPOSE 8081 8082
CMD ["sh", "start.sh"]
