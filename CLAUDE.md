## workflow

Before making any changes, read `docs/workflow.md` — the working guide for this repo (dev loop, known pitfalls like the inert Tailwind setup and the `.next` build/dev conflict, commit conventions, reusable engine patterns). Project status lives in `docs/current-status.md`; mandatory coding rules in `docs/ai-working-rules.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## cost / token discipline (budget-conscious)

The user is cost-sensitive. Minimize token spend without hurting correctness:

- **Cheaper model for subagents.** When spawning an `Explore`, `Plan`, or research subagent, pass `model: "sonnet"` on the Agent tool by default (search/exploration doesn't need Opus). Use `"haiku"` for trivial one-file lookups. Only use Opus for a subagent doing genuinely hard reasoning. The main thread keeps whatever model the user set.
- **Spawn sparingly.** Don't fan out subagents for tasks you can do inline. Prefer 1 focused agent over 3; reuse a running agent via SendMessage instead of a cold new spawn. A "thorough" request is not a request to spawn.
- **graphify first.** `graphify query/path/explain` returns a small scoped subgraph — use it before Explore agents or raw grep (the PreToolUse hooks already enforce this). It's the cheapest way to orient.
- **Don't re-read.** Don't re-read a file you just edited to "verify"; Edit/Write already confirm success. Read only the ranges you need (offset/limit), not whole large files.
- Note for the user (can't be set from here): the global model/effort is `opus` + `xhigh` — the priciest combo. Lowering effort to `high`/`medium` via `/config`, or main model to Sonnet via `/model` for routine work, is the single biggest saving.
