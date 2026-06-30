# fitfiller — common developer tasks.
# Run `make` or `make help` to see everything.

# Use bash and fail fast.
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm

.PHONY: help install env dev dev-api dev-web build core test test-core test-api test-web \
        typecheck check sample stop clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	$(PNPM) install

env: ## Create apps/api/.env from the example if missing
	@test -f apps/api/.env || (cp .env.example apps/api/.env && echo "created apps/api/.env")

core: ## Build the core package (needed before the API can import it)
	$(PNPM) --filter @fitfiller/core build

dev: stop install env core ## Run the full stack (API + web) with live reload
	@echo "API → http://localhost:3001   web → http://localhost:5173"
	$(PNPM) dev

dev-api: env core ## Run only the API (http://localhost:3001)
	$(PNPM) --filter @fitfiller/api dev

dev-web: ## Run only the web app (http://localhost:5173, proxies /api)
	$(PNPM) --filter @fitfiller/web dev

build: ## Build every package
	$(PNPM) -r build

test: ## Run all test suites (core + api + web)
	$(PNPM) -r test

test-core: ## Run core tests
	$(PNPM) --filter @fitfiller/core test

test-api: ## Run API tests
	$(PNPM) --filter @fitfiller/api test

test-web: ## Run web tests
	$(PNPM) --filter @fitfiller/web test

typecheck: ## Type-check every package
	$(PNPM) -r typecheck

check: typecheck test ## Full quality gate: typecheck + all tests

sample: core ## Generate a sample .fit (with a forgotten pause) at /tmp/sample-run.fit
	@$(PNPM) --filter @fitfiller/core exec node -e "$$SAMPLE_SCRIPT"
	@echo "wrote /tmp/sample-run.fit — upload it at http://localhost:5173"

stop: ## Stop stray dev servers (API + web) and free their ports
	@pkill -f "turbo run dev" 2>/dev/null || true; \
	pkill -f "tsx.*watch.*src/server.ts" 2>/dev/null || true; \
	sleep 1; \
	for p in 3001 5173; do \
		pids=$$(lsof -ti tcp:$$p 2>/dev/null || true); \
		if [ -n "$$pids" ]; then kill $$pids 2>/dev/null || true; fi; \
	done; \
	echo "stopped dev servers (freed :3001 and :5173)"

clean: ## Remove build output and caches
	@rm -rf packages/*/dist apps/*/dist .turbo packages/*/.turbo apps/*/.turbo
	@echo "cleaned build output"

# Inline sample-FIT generator used by `make sample`.
define SAMPLE_SCRIPT
import { Encoder, Profile } from "@garmin/fitsdk";
import { writeFileSync } from "node:fs";
const M = Profile.MesgNum, SC = 2**31/180, deg = d => Math.round(d*SC);
const BASE = Date.UTC(2026,5,29,8,0,0), enc = new Encoder();
enc.writeMesg({mesgNum:M.FILE_ID,type:"activity",timeCreated:new Date(BASE),manufacturer:"garmin",product:0,serialNumber:42});
let lat=47.9950, lon=7.8500, dist=0;
const rec=(s,la,lo,d)=>enc.writeMesg({mesgNum:M.RECORD,timestamp:new Date(BASE+s*1000),positionLat:deg(la),positionLong:deg(lo),distance:d,enhancedSpeed:3.2,enhancedAltitude:278+Math.sin(s/50)*4,heartRate:150+Math.round(Math.sin(s/30)*8),cadence:84});
let s=0; for(;s<=120;s++){ lon+=0.00003; dist+=3.2; rec(s,lat,lon,dist); }
enc.writeMesg({mesgNum:M.EVENT,timestamp:new Date(BASE+120000),event:"timer",eventType:"stop"});
const rS=480, rLat=lat+0.0090, rLon=lon+0.0060, rDist=dist+1150;
enc.writeMesg({mesgNum:M.EVENT,timestamp:new Date(BASE+rS*1000),event:"timer",eventType:"start"});
let la=rLat, lo=rLon, d=rDist; for(let k=0;k<=180;k++){ lo+=0.00003; d+=3.2; rec(rS+k,la,lo,d); }
enc.writeMesg({mesgNum:M.SESSION,timestamp:new Date(BASE+(rS+180)*1000),startTime:new Date(BASE),sport:"running",totalDistance:d,totalTimerTime:300});
writeFileSync("/tmp/sample-run.fit", Buffer.from(enc.close()));
endef
export SAMPLE_SCRIPT
