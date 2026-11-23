.PHONY: mongo-local mongo-atlas down seed test lint typecheck

# Self-managed MongoDB (mongo:8) — models the on-prem setup. Rule-based search.
mongo-local:
	docker compose up --build

# MongoDB Atlas (atlas-local) — models the managed service. Enables Atlas $search.
mongo-atlas:
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
