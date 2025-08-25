.PHONY: help build dev prod clean logs logs-prod shell shell-engine shell-frontend test test-engine test-frontend

# Default target
help:
	@echo "DollarZing Docker Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make logs         - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo "  make logs-prod    - View production logs"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build all images"
	@echo "  make build-prod   - Build production images"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Stop and remove containers, networks, and volumes"
	@echo "  make clean-images - Remove all images"
	@echo "  make shell        - Open shell in frontend container"
	@echo "  make shell-engine - Open shell in engine container"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-engine  - Run engine tests"
	@echo "  make test-frontend - Run frontend tests"

# Development
dev:
	docker-compose up -d

dev-build:
	docker-compose up -d --build

# Production
prod:
	docker-compose -f docker-compose.prod.yml up -d

prod-build:
	docker-compose -f docker-compose.prod.yml up -d --build

# Building
build:
	docker-compose build --no-cache

build-prod:
	docker-compose -f docker-compose.prod.yml build --no-cache

# Logs
logs:
	docker-compose logs -f

logs-prod:
	docker-compose -f docker-compose.prod.yml logs -f

# Shell access
shell:
	docker-compose exec frontend sh

shell-engine:
	docker-compose exec engine sh

# Testing
test:
	@echo "Running all tests..."
	@docker-compose exec engine npm test
	@docker-compose exec frontend npm test

test-engine:
	docker-compose exec engine npm test

test-frontend:
	docker-compose exec frontend npm test

# Cleanup
clean:
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v
	docker system prune -f

clean-images:
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.prod.yml down -v --rmi all
	docker system prune -af

# Status
status:
	@echo "Development containers:"
	@docker-compose ps
	@echo ""
	@echo "Production containers:"
	@docker-compose -f docker-compose.prod.yml ps
	@echo ""
	@echo "Docker system info:"
	@docker system df
