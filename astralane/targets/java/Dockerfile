FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
COPY targets/java/Main.java .
RUN javac Main.java

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /src/Main.class /app/Main.class
USER 65534:65534
EXPOSE 8087
HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD wget -q -O /dev/null http://127.0.0.1:8087/health || exit 1
CMD ["java", "-cp", "/app", "Main"]
