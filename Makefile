.PHONY: up up-search down seed test lint typecheck

# Default demo: mongo:8 + seed + api
up:
	docker compose up --build

# Opt-in: atlas-local (Atlas Search) instead of mongo:8
up-search:
	docker compose -f docker-compose.yml -f docker-compose.search.yml up --build

down:
	docker compose down -v

seed:
	npm run build && npm run seed

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck
