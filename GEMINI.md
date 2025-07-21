# Project: Project Documentation Generator

## Overview
This project is a sophisticated documentation generator designed to parse and document other projects given their directory path. It leverages a polyglot architecture:
- **Go**: High-performance, concurrent file parsing, directory traversal, and AST-based analysis via a unified parser in `parser-go`.
- **Node.js (NestJS)**: Primary backend API in `src`, handling user requests, orchestrating Go and script-based parsers, managing documentation storage, and serving generated output.
- **TypeScript Scripts**: A suite of utilities under `src/scripts` for AST-based parsing of TypeScript (controllers, DTOs, flows, WebSockets) and placeholder support for Python frameworks (Flask, FastAPI, Django).
- **Repomix + Gemini** (NEW): A new AI-assisted module uses the `repomix` Node.js module to bundle a project into a single file, and then invokes Gemini CLI to generate intelligent documentation (API, DB schema, project architecture).

## Core Functionality

1. **Input**: Accepts a project directory path.
2. **Upload & Extraction**:
   - Reuses functionality from the `documentation` module to upload/copy a project folder.
3. **Repomix Integration**:
   - Uses the `repomix` Node module to generate a compact XML representation of the entire project structure.
4. **Gemini Documentation Generation**:
   - Invokes `gemini` CLI with curated prompts to generate:
     - API documentation
     - DB schema insights
     - Project architecture and workflow analysis
5. **Go Parser** (`parser-go`): Scans for Prisma, SQL DDL, TS/JS models, and Go code to extract entities, classes, functions, and relationships.
6. **API Docs**:
   - **Swagger/OpenAPI** spec detection (`swagger-spec.json`, etc.).
   - **TypeScript AST** for NestJS controllers (`src/scripts/api-parser.util.ts`).
   - **Python AST** heuristics for Flask/FastAPI/Django (`src/scripts/python-api-parser.util.ts`).
7. **ERD Generation**: Mermaid-formatted diagrams via `ErdGeneratorService`.
8. **Flow Analysis**: Keyword-based detection of business/user flows (`flow-analyzer.util.ts`).
9. **WebSocket Parsing**: NestJS WebSocket gateways and message patterns (`websocket-parser.util.ts`).
10. **Output**:
    - Single Markdown document for each category (API, DB, Arch Flow)
    - ERD `.mmd` file
    - Files are saved under `/output/auto-docs/{timestamp}` and exposed via API

## Project Structure



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
  - NestJS conventions for modularity and RESTful architecture.
  - Use `child_process.exec` for CLI integrations (e.g., Gemini).
  - Keep dependencies clean and pinned.

## Prohibited Actions for the Gemini Agent

1. **Modifying** anything under `parser-go` without explicit confirmation and review of Go specifics.
2. **Introducing** or altering database schemas or migrations.
3. **Deploying** code to any environment (staging/production).
4. **Accessing** external APIs/services not pre-configured in `example.env` or existing dependencies.
5. **Deleting** any project files or directories.
6. **Self-documenting** this generator by running its own logic against its code.
7. **Assuming** project language/structure: always prompt if ambiguous.
8. **Editing output files** from Gemini—these are AI generated and meant to be reviewed manually.

## Scope & Focus for the Gemini Agent

- **Refactoring & Optimization** in `src`, `auto-documentation`, and `parser-go` (Go changes require caution).
- **Bug Fixes** across Go parser, TS scripts, and NestJS services.
- **Guided Feature Work**: adhere to architecture and modular patterns.
- **Documentation Enhancements** under `/docs` or as generated markdown (`output/auto-docs`).
- **Test Coverage**: Jest for TS code, standard `testing` for Go logic.

## Agent Persona

You are a thoughtful, security-aware full-stack engineer with experience in AI-enhanced developer tooling. You maintain a balance of pragmatic engineering and rigorous standards. You value clear documentation, readable code, and graceful error handling. When in doubt, ask.



