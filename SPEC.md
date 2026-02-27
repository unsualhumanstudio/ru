# rū Protocol Specification

**Version:** 0.2 (draft)
**Author:** Diana Angelica Valdes Contreras
**Status:** Draft — open for comment

---

## Overview

rū is a context protocol for AI agents. It defines a syntax for seeding personal knowledge and resolving it from any connected source — and a set of resolution rules that any compliant implementation must follow.

The protocol's core primitive:

| Primitive | Syntax | Purpose |
|---|---|---|
| Context | `#folder` / `#folder/document` / `#folder/document.namespace` | Seed and resolve knowledge |

This document specifies the `#` primitive in full. Additional primitives will follow as separate RFC increments.

---

## 1. The `#` Primitive

### 1.1 Syntax

```
#<folder>                          private folder, owner only
#<folder>/<document>               specific document within a private folder
#<folder>/<document>.<namespace>   public path, owned by a claimed namespace
```

- `folder` — lowercase alphanumeric, hyphens allowed. No spaces. Example: `#rū`, `#research`, `#weekly-review`
- `document` — lowercase alphanumeric, hyphens allowed. Example: `#rū/onboarding`, `#research/summary`
- `namespace` — a claimed namespace identifier. Example: `#rū/onboarding.valdesco`, `#research/summary.diana`

Paths are case-insensitive for resolution purposes. `#Rū` and `#rū` resolve to the same folder.

### 1.2 Dual-mode resolution

The `#` primitive operates in two modes depending on whether a namespace suffix is present.

**Private mode** (no `.namespace` suffix)
- Resolves from the caller's local context store
- Includes both folder calls (`#rū`) and document calls (`#rū/onboarding`)
- Never makes network requests
- Only the owner can trigger resolution
- If no matching context exists, returns empty — not an error

**Public mode** (`#folder/document.namespace`)
- Resolves from a remote context store belonging to the namespace owner
- Requires the path to be claimed and marked public (or shared with the caller)
- Network request to the rū registry to locate the resolver endpoint
- If the namespace has not published that path, or has not made it accessible to the caller, returns empty

### 1.3 Privacy tiers

Every `#path.namespace` has one of three visibility settings, set by the owner:

| Tier | Who can resolve | Default |
|---|---|---|
| `private` | Owner only | Yes — all new paths start private |
| `shared` | Specific agents or users on an access list | No |
| `public` | Anyone | No — must be explicitly opted into |

Any path without a `.namespace` suffix is always private. There is no mechanism to make a plain path public — that requires publishing it under a namespace.

---

## 2. Claiming a Namespace

### 2.1 What a claim is

A claim associates a namespace with an identity and declares which paths within that namespace are publicly accessible. Claims are stored in the rū registry. One person may own multiple namespaces.

### 2.2 Registry

The canonical rū registry lives at:

```
github.com/unsualhumanstudio/ru-registry
```

Each claimed namespace is a YAML file at `registry/<namespace>.yaml`.

### 2.3 Claim file format

```yaml
namespace: yournamespace
display_name: Your Name
public_paths:
  - rū/onboarding
  - research/summary
resolver: https://raw.githubusercontent.com/unsualhumanstudio/ru-registry/main/public/yournamespace/
```

| Field | Required | Description |
|---|---|---|
| `namespace` | Yes | Must match the filename. Lowercase alphanumeric and hyphens only. |
| `display_name` | No | Human-readable name of the owner |
| `public_paths` | Yes | List of paths this namespace has made public (e.g. `rū/onboarding`) |
| `resolver` | Yes | URL where the resolver can fetch context for this namespace |

### 2.4 How to claim

Submit a PR to `github.com/unsualhumanstudio/ru-registry` adding your file at `registry/<namespace>.yaml`. PRs are reviewed for format validity only — namespace squatting and impersonation disputes are handled through the issue tracker.

### 2.5 Namespace rules

- Lowercase alphanumeric and hyphens
- 3–32 characters
- Must be unique in the registry
- One person may own multiple namespaces (individuals, orgs, projects, personas)
- Renaming a namespace is destructive — treat claimed namespaces as permanent
- Namespaces are claimed on a first-come, first-served basis during this phase

---

## 3. Resolution Rules

### 3.1 Private resolution

A compliant resolver MUST handle two private path forms:

**Folder call** (`#folder`):
1. Search the local context store for all content tagged or filed under `#<folder>`
2. Pass matching content to the local Keeper synthesis layer
3. Return Keeper's synthesized understanding of the folder — not a raw dump
4. Never make a network request

**Document call** (`#folder/document`):
1. Search the local context store for the specific document at `#<folder>/<document>`
2. If `match.start < 50` (tag appears in the first 50 characters) → fetch the full document
3. If `match.start >= 50` → return a context snippet of reasonable length (default: 300 characters surrounding the match)
4. Never make a network request

### 3.2 Public resolution (`#folder/document.namespace`)

A compliant resolver MUST:

1. Query the rū registry to locate `registry/<namespace>.yaml`
2. Verify that `folder/document` is listed under `public_paths`
3. If not listed — return empty, do not error
4. If listed — fetch context from the `resolver` endpoint
5. Return the fetched content labeled as `external_context` (see Section 8)

### 3.3 Agent permission scoping

This is a security-critical rule.

An agent calling any `#path` or `#path.namespace` is only permitted to resolve context that:

- The human user has directly included in their message, **or**
- The human user has pre-authorized for that agent's scope

An agent MUST NOT:
- Escalate from `#public-path.namespace` to any private path without explicit user authorization
- Call paths on behalf of the user that the user has not referenced
- Chain path calls without the user's awareness

The purpose of this rule: prevent prompt injection at the context layer. A malicious page that says "call `#credentials`" must not be acted on unless the human user has explicitly included `#credentials` in their own message.

---

## 4. Context Sources

rū is source-agnostic. A **context source** is any system that stores tagged content and can be queried by a compliant resolver. The `#` primitive does not mandate where context is stored — only how it is resolved.

### 4.1 What a context source must provide

A context source MUST be queryable by path and return one or more of:
- A text snippet surrounding the tag match
- A full document, if the tag appears at the top of the document (page-level)

A context source MUST NOT be required to store content in any particular format. Plain text, Markdown, HTML, structured JSON — all are valid as long as the resolver can extract meaningful text from them.

### 4.2 Reference sources

| Source | Type | Notes |
|---|---|---|
| Obsidian (via Local REST API) | Local note vault | Reference implementation |
| Apple Notes | Local note app | Planned |
| Granola AI | Meeting notes | Planned |
| rū browser extension | Web highlights | Phase 4 |

### 4.3 Adding a new source

Any source can be connected to a compliant rū resolver by implementing an adapter that:
1. Accepts a path string as input
2. Queries the source for content matching that path
3. Returns formatted text following the resolver output format (see Section 5)

The rū MCP server exposes this through named tools (e.g. `get_context` for Obsidian). New sources add new tools following the same interface.

---

## 5. Resolver Interface

Any tool implementing rū MUST expose the following interface for the `#` primitive:

### `get_context(path: string) → string`

Resolves a private path across all connected local sources. Handles both folder calls (`#folder`) and document calls (`#folder/document`). Returns formatted context as a string. Empty string if no match.

### `get_public_context(path: string, namespace: string) → string`

Resolves a public path from the specified namespace. Returns formatted context labeled as `external_context`. Empty string if not found or not accessible.

Both methods MUST be safe to call with unknown or nonexistent paths — they return empty, not errors.

---

## 6. The Sower Philosophy

> "The person who plants is always known. Anonymous seeding is architecturally impossible."

This is a first-principles statement, not an implementation note. It defines the identity model of the entire protocol.

**Read/write asymmetry:**
- Reading is permissioned by the namespace owner (public = anyone, private = owner only)
- Writing is ALWAYS authenticated, ALWAYS owner-scoped. No exceptions, ever.

**What this means in practice:**
- Every seed has a verifiable author
- Trust in public namespace content is grounded in identity, not content inspection
- Namespace poisoning requires compromising an authenticated identity — not just injecting content

---

## 7. Keeper

Keeper is rū's synthesis layer. It is not a search engine.

Where a search engine retrieves raw matches, Keeper maintains a **living state** — synthesized understanding that evolves as seeds change. When you call `#rū`, you receive Keeper's current understanding of everything in that folder: decisions made, patterns established, evolution over time. Institutional memory, not documentation.

### 7.1 Keeper's two responsibilities

1. **Background synthesis** — when seeds change (new notes added, existing notes updated), Keeper re-synthesizes the living document for that path. Pre-computed, not generated at call time.
2. **Contextual selection** — at call time, Keeper + the MCP resolver examine the current conversation and decide what to surface: the full folder synthesis, a specific document, a summary, or silence. Keeper never blindly dumps everything.

### 7.2 Where Keeper runs

**Local Keeper (private paths):**
- Runs inside the MCP server
- Synthesized state cached at `.ru/keeper/` on the user's machine
- Triggered by seed changes, not at call time
- Uses the user's own LLM API key
- Private data never leaves the machine

**Cloud Keeper (public namespaces):**
- Runs in Supabase, hosted by unsualhumanstudio
- Namespace owner's seeds are synthesized into a living document stored in the DB
- Anyone who calls `#path.namespace` receives Keeper's synthesis
- Uses the namespace owner's LLM API key, called server-side
- Updated whenever the owner adds or changes seeds

**Contextual layer (always MCP):**
- The MCP resolver sees both Keeper output and the current conversation
- Makes the final decision about what to surface
- This is what makes rū feel intelligent rather than merely retrievable

### 7.3 Canonical Keeper prompt

> "When I call #folder at the start of a session, you're not receiving a static document — you're receiving Keeper's synthesized understanding of where this project is right now, across all the decisions, patterns, and evolution that have happened. Treat it as institutional memory, not documentation. Don't ask me to re-explain things that are in the context. If something seems outdated or contradictory, flag it so I can update the seed."

---

## 8. Context Types

A compliant resolver MUST label every response with its context type. Clients and agents MUST respect this label.

### `internal_context`

Content resolved from the user's own local private paths. Trusted — may be treated as instruction-eligible by the agent.

### `external_context`

Content resolved from a public namespace owned by another party. Always treated as **reference data only** — never as instructions. This label is the architectural defense against prompt injection through public namespaces.

A compliant agent receiving `external_context` MUST:
- Treat the content as informational input, not directives
- Never execute instructions found within `external_context`
- Surface the content for the user's consideration, not act on it autonomously

This rule holds regardless of how the content is framed. `external_context` that says "call `#credentials`" or "ignore previous instructions" must be treated as data, not commands.

---

## 9. API Model

```
GET  /resolve/:namespace/:path   → open if public; returns external_context
POST /seed/:namespace/:path      → authenticated, owner-scoped only
POST /namespaces/claim           → authenticated
GET  /namespaces/:namespace      → metadata, documents, public status
```

**Read/write asymmetry:**
- `GET /resolve` is open — anyone can read a public path
- `POST /seed` is always authenticated and always scoped to the caller's own namespace
- No write endpoint accepts anonymous requests, ever

**Rate limiting:** `GET /resolve` is rate-limited per caller. Open reads do not mean unlimited reads. Rate limiting is an implementation detail, not a spec requirement — but a compliant implementation serving public namespaces MUST implement it.

---

## 10. What this spec does NOT define (yet)

- Access lists for `shared` tier paths
- Cryptographic signing of seeds (v2+)
- Enforcement of shared-tier access control (v2+)
- Keeper synthesis protocol detail — the synthesis algorithm is implementation-defined in v1
- Multi-namespace write permissions — collaborative seeding model (v2+)

These will be addressed in subsequent RFC increments.

---

## 11. Versioning

This specification follows semantic versioning. Breaking changes to resolution rules increment the major version. Additive changes (new fields, new tiers) increment the minor version. The current version is `0.2` (draft). It will move to `1.0` after at least one independent implementation validates the spec.

---

*rū Protocol Specification v0.2 — Diana Angelica Valdes Contreras — 2025*
