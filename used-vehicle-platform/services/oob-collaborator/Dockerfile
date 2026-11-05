FROM python:3.11-slim
WORKDIR /code
COPY app.py .
RUN pip install --no-cache-dir fastapi uvicorn
EXPOSE 9000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000"]
