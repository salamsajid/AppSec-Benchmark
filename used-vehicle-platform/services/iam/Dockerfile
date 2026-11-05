FROM python:3.11-slim

LABEL maintainer="devops@automarket.internal"
LABEL org.automarket.build.pipeline_id="BUILD-PIPE-8841"
LABEL org.automarket.build.deployer="ci-runner@automarket.internal"
LABEL org.automarket.build.cluster_sync_token="LAB{docker_image_label_leak_token}"

WORKDIR /code

# Flaw: Storing sensitive token in intermediate layer and deleting in later layer (retained in image history/blobs)
RUN echo '{"vault_role": "iam-admin", "vault_token": "LAB{docker_intermediate_layer_vault_token}"}' > /root/.vault_bootstrap.json
RUN rm -f /root/.vault_bootstrap.json

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

