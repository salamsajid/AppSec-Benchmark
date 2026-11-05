COMPOSE ?= docker-compose
C5 ?= ./c5/run.sh

.PHONY: up down build ps logs smoke reset key c5-validate c5-doctor c5-start c5-stop c5-reset c5-status c5-list c5-shell c5-run

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

smoke:
	./scripts/smoke.sh

reset:
	./scripts/reset.sh

key:
	node benchmark/build-key.mjs

c5-validate:
	$(C5) validate

c5-doctor:
	$(C5) doctor

c5-start:
	$(C5) start

c5-stop:
	$(C5) stop

c5-reset:
	$(C5) reset

c5-status:
	$(C5) status

c5-list:
	$(C5) list

c5-shell:
	$(C5) shell

c5-run:
	$(C5) run $(CHAIN)
