# INTENTIONALLY VULNERABLE AI ASSISTANT - LAB ONLY
FROM python:3.11-slim
WORKDIR /code
RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY governance.env ./
RUN echo "LAB{ai_file_secret}" > /secret.txt && echo "LAB{ai_file_secret}" > ./secret.txt
EXPOSE 6000
CMD ["python", "app.py"]
