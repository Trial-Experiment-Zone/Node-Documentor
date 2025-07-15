# Project: Project Documentation Generator

## Overview
This project is a sophisticated documentation generator designed to parse and document other projects given their directory path. It leverages a polyglot architecture:
- **Go**: High-performance, concurrent file parsing, directory traversal, and AST-based analysis via a unified parser in `parser-go`.
- **Node.js (NestJS)**: Primary backend API in `src`, handling user requests, orchestrating Go and script-based parsers, managing documentation storage, and serving generated output.
- **TypeScript Scripts**: A suite of utilities under `src/scripts` for AST-based parsing of TypeScript (controllers, DTOs, flows, WebSockets) and placeholder support for Python frameworks (Flask, FastAPI, Django).

## Core Functionality
1. **Input**: Accepts a project directory path.
2. **Go Parser** (`parser-go`): Scans for Prisma, SQL DDL, TS/JS models, and Go code to extract entities, classes, functions, and relationships.
3. **API Docs**:
   - **Swagger/OpenAPI** spec detection (`swagger-spec.json`, etc.).
   - **TypeScript AST** for NestJS controllers (`src/scripts/api-parser.util.ts`).
   - **Python AST** heuristics for Flask/FastAPI/Django (`src/scripts/python-api-parser.util.ts`).
4. **ERD Generation**: Mermaid-formatted diagrams via `ErdGeneratorService`.
5. **Flow Analysis**: Keyword-based detection of business/user flows (`flow-analyzer.util.ts`).
6. **WebSocket Parsing**: NestJS WebSocket gateways and message patterns (`websocket-parser.util.ts`).
7. **Output**: Generates a single Markdown document (and `.mmd` ERD file) and exposes it via a NestJS API endpoint.

## Project Structure


```
/
├── parser-go/ # Go parser sources & build scripts
├── src/ # NestJS backend + TS parsing scripts
│ ├── documentation/ # Controller & service for file generation
│ ├── generators/ # ERD & Markdown generator services
│ └── scripts/ # TS-Morph and file‐system parsers
├── output/ # (Generated at runtime)
├── swagger-spec.json # Example OpenAPI spec
├── GEMINI.md # This file
└── .gemini/
└── settings.json # Tool restrictions for the Gemini agent
```


## Coding Standards & Best Practices
- **Go**:
  - `gofmt` & `golint` compliant.
  - `%w`-style error wrapping.
  - Concurrency safety (no goroutine leaks; use mutexes/channels).
- **Node.js / TypeScript**:
  - ESLint (configured via `eslint.config.mjs`) & Prettier.
  - `async/await` for async flows.
  - NestJS conventions for controllers, middleware, error handling.
  - Keep dependencies current.

## Prohibited Actions for the Gemini Agent
1. **Modifying** anything under `parser-go` without explicit confirmation and review of Go specifics.
2. **Introducing** or altering database schemas or migrations.
3. **Deploying** code to any environment (staging/production).
4. **Accessing** external APIs/services not pre-configured in `example.env` or existing dependencies.
5. **Deleting** any project files or directories.
6. **Self-documenting** this generator by running its own logic against its code.
7. **Assuming** project language/structure: always prompt if ambiguous.

## Scope & Focus for the Gemini Agent
- **Refactoring & Optimization** in `src` and `parser-go` (Go changes require caution).
- **Bug Fixes** across Go parser, TS scripts, and NestJS service logic.
- **Guided Feature Work**: follow architecture, coding standards, and existing module patterns.
- **Test Generation & Improvement**: Jest for TS, standard Go testing.
- **Documentation Enhancements** under `/docs` or inline comments (where missing).

## Agent Persona
You are a diligent full-stack developer with deep expertise in Go and Node.js/TypeScript. Prioritize stability, readability, and security. Ask clarifying questions whenever a request is outside the clearly defined scope.  

