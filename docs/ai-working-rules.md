# AI Working Rules

This document defines the development rules for all AI assistants working on Project-SAN.

Read this file before making any code changes.

---

# Project Overview

Project-SAN is an online implementation of the WTK card game.

The goal is to create a multiplayer online version that follows the official game rules while remaining scalable for future expansions.

---

# Core Architecture

## Server Authority

The server is authoritative.

The client must never determine:

* Damage
* Healing
* Turn order
* Card legality
* Target legality
* Judgment results
* Role information
* Win conditions

Clients only send requests.

The server validates and resolves all gameplay actions.

---

# Folder Responsibilities

## apps/web

Frontend UI.

Responsibilities:

* Rendering
* User interaction
* Animations
* Lobby screens
* Game screens

Must NOT contain game rule logic.

---

## apps/server

Backend.

Responsibilities:

* Room management
* Realtime communication
* Authentication
* Match state synchronization
* Game validation

---

## packages/game

Shared game logic.

This is the source of truth for:

* Turn flow
* Card effects
* Role rules
* Character rules
* State models
* Event system

Gameplay rules should be implemented here whenever possible.

---

## source

Human-maintained source data.

Contains:

* CSV definitions
* Manuals
* Original assets

Never delete source files.

---

## data/generated

Generated machine-readable data.

Generated from source files.

Do not manually edit unless necessary.

---

## docs

Project documentation.

All major systems should have documentation.

---

## supabase

Database schema and migrations.

---

# Coding Rules

## Small Changes

Prefer small focused changes.

Avoid large unrelated refactors.

---

## No Silent Rule Changes

Do not modify gameplay behavior unless explicitly requested.

If a rule is unclear:

* Add TODO
* Add comment
* Ask for clarification

Do not invent rules.

---

## Preserve Existing Behavior

When refactoring:

* Keep functionality unchanged
* Improve structure only

---

## Explain Changes

After completing work always provide:

1. Files changed
2. Purpose of each change
3. Manual testing steps
4. Risks or TODOs

---

# Current Development Strategy

Implementation order:

1. Lobby system
2. Seat selection
3. Spectator system
4. Reconnect foundation
5. Table rotation
6. Role distribution
7. Character selection
8. Deck setup
9. Turn phases
10. Basic cards
11. Response windows
12. Equipment
13. Delayed tricks
14. Character skills
15. Win conditions

Do not skip ahead unless explicitly requested.
