FROM golang:1.22-alpine AS build

WORKDIR /src
COPY targets/go/go.mod .
COPY targets/go/main.go .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /astralane-go .

FROM alpine:3.20

RUN adduser -D -H -u 65532 target
COPY --from=build /astralane-go /usr/local/bin/astralane-go

USER target
EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD ["/usr/local/bin/astralane-go", "-health"]

ENTRYPOINT ["/usr/local/bin/astralane-go"]
