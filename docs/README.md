# FreshMart learning guide

This documentation is a student-focused guide to the existing FreshMart repository. It explains the code that is present today and distinguishes working features from schema foundations or placeholders.

## Suggested reading order

1. [Chapter 1: Project map and local setup](./01-project-map-and-setup.md)
2. [Chapter 2: System architecture and app boundaries](./02-system-architecture.md)
3. [Chapter 3: Request and response lifecycles](./03-request-response-lifecycles.md)
4. [Chapter 4: PostgreSQL schema and migrations](./04-database-and-migrations.md)
5. [Chapter 5: Authentication, roles, and localization](./05-authentication-roles-localization.md)
6. [Chapter 6: Important code and safe feature development](./06-code-and-feature-development.md)
7. [Chapter 7: Glossary, presentation, viva, and interview questions](./07-glossary-and-review.md)
8. [Chapter 8: MVP roadmap and student learning plan](./08-mvp-roadmap-and-learning-plan.md)

Each chapter ends with questions to help you check your understanding. Chapter 8 is the verified backlog and implementation sequence; it should be revised as milestones are approved and completed. The chapters can be read in order or used as a reference while tracing the code.

## Current project scope

The repository currently implements a public product catalog with search and category filtering, administrator sign-in, and administrator product management. The delivery interface is a placeholder. Although the database has order and delivery tables, the current API does not expose customer checkout, order-management, or delivery workflows.

## Grounding and safety

Documentation is based on files in this repository. Environment files such as `.env` are private configuration and must not be copied into documentation or committed. The example environment files may need local values before the API can connect.

Do not run database setup or migration commands merely to follow an example. Migration commands change database state; use them only when intentionally applying an approved migration after confirming the target database and backup.
