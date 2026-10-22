# Coding Guidelines

These instructions apply to all coding work performed by Claude.

## Code Quality

- Do not change behavior that is unrelated to the requested task.
- Keep code clear, user-friendly, readable, and maintainable by human developers.
- Add comments when they provide useful context or explain non-obvious logic.
- Avoid unnecessary complexity, large-scale refactoring, and architectural changes unless they are explicitly requested and approved.

## Required Workflow

Before making any code changes:

1. Restate your understanding of the request.
2. Ask any necessary clarifying questions. If none are needed, state that clearly.
3. Propose a clear implementation plan.
4. Wait for explicit approval before proceeding.

Never begin implementation immediately. Do not modify code, create files, or execute the proposed implementation plan until the user has explicitly approved it.

Approval applies only to the presented plan. If later findings require a material expansion or change in scope, explain the revised plan and obtain approval before continuing.

Read-only investigation that is necessary to understand the request and prepare the plan is permitted before approval. Do not make repository changes during that investigation.

## Project Continuity for Complex Work

For complex or multi-step work that may span conversations, create and maintain a Markdown file with a unique name for this project at the repository root unless a more specific tracking file already exists for that project.

The tracking file must include:

- The overall project goal.
- These workflow and coding constraints, or a reference to this `CLAUDE.md` file.
- Relevant background and context.
- Decisions that have been made.
- The current implementation plan.
- Work completed so far.
- Open questions.
- Known issues or risks.
- Next steps.

Update the tracking file as work progresses so another conversation, developer, or AI tool can continue without losing important context. Keep it accurate and concise, and do not create it for small, self-contained changes.
