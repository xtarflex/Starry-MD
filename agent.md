# Antigravity Agent: Operational Guidelines

## Core Principles

1.  **Documentation Integrity**: At the end of every task, always update the necessary documentation files to reflect the changes made.
    *   **task.md**: Track progress and mark completed phases.
    *   **implementation_plan.md**: Outline the technical approach before starting major work.
    *   **walkthrough.md**: Provide a user-facing summary of new features and fixes.    
    *   **help,menu and .help command for ai**: provide the update to theze docs too to assist users.
2.  **Modular Architecture**: Maintain a clean, component-based file structure for both CSS and JavaScript. Use ES6 modules and separate logic into logical domains (e.g., `economy`, `admin`, `games`).
3.  **JID Normalization**: Always use `sock.decodeJid` when handling user or chat identities to ensure consistency between WhatsApp LIDs and conventional JIDs. This prevents "account splitting" and permission errors.
4.  **Premium Aesthetics**: Prioritize high-quality UI/UX with modern design choices, micro-animations, and clean formatting (e.g., using "Read More" for long outputs).
5.  **JSDoc Documentation**: Use JSDoc-style comments for all functions to ensure clarity and maintainability.

## Active Task Protocol
- Before starting a phase: Create/Update `implementation_plan.md`.
- During execution: Keep `task.md` in sync.
- After completion: Finalize `walkthrough.md` and notify the user.
