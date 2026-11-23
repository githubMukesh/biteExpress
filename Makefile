.PHONY: mongo-local mongo-atlas down seed test lint typecheck

COMPOSE_ATLAS = docker compose -f docker-compose.yml -f docker-compose.search.yml

# Self-managed MongoDB (mongo:8) — models the on-prem setup. Rule-based search.
# Tears down first so a prior run (incl. a Ctrl+C'd one) never leaks stale state.
mongo-local:
	docker compose down -v --remove-orphans 2>/dev/null || true
	docker compose up --build

# MongoDB Atlas (atlas-local) — models the managed service. Enables Atlas $search.
# Tears down first: atlas-local must init fresh (Ctrl+C leaves a stopped container
# whose keyfile/replica-set state would otherwise be reused and fail).
mongo-atlas:
	$(COMPOSE_ATLAS) down -v --remove-orphans 2>/dev/null || true
	$(COMPOSE_ATLAS) up --build

down:
	docker compose down -v --remove-orphans

seed:
	npm run build && npm run seed

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck
