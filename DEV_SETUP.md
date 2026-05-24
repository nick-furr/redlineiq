# RedlineIQ — Development Setup

How to get RedlineIQ running locally on a new machine. Assumes you already have the global Windows dev baseline installed (Git Bash, nvm-windows, VS Code, Claude Code). If not, see `MACHINE_SETUP.md` (Notion / dotfiles) first.

---

## Quick start

```bash
git clone https://github.com/nick-furr/redlineiq.git ~/projects/RedlineIQ
cd ~/projects/RedlineIQ
nvm use                       # picks up .nvmrc (Node 22.14.0)
npm install
cp .env.example .env          # then populate values — see below
npm run dev                   # or whatever script runs the app
```

---

## Prerequisites

These should already be installed system-wide. Verify before continuing:

| Tool | Verify | Expected |
|---|---|---|
| Git Bash | `git --version` | any recent version |
| nvm-windows | `nvm version` | 1.2.x+ |
| Node (after `nvm use`) | `node -v` | v22.14.0 |
| npm | `npm -v` | 10.9.x or newer |
| Claude Code | `claude --version` | 2.1.x+ |

If `node -v` returns the wrong version after `nvm use`, run `nvm install 22.14.0` first.

---

## Repo location

Both machines clone to `~/projects/RedlineIQ` (which is `C:\Users\<you>\projects\RedlineIQ` on Windows). Keeping the path consistent across machines means `CLAUDE.md`, scripts, and any absolute paths in tooling just work.

> Don't put dev projects on the Desktop. Google Drive sync corrupts `.git/` and uploads `node_modules/`. Keep them under `~/projects/`.

---

## Environment variables

`.env` is **gitignored** and not synced via the repo. You'll get a `.env.example` from the repo listing every key the app expects. Populate it locally from your password manager / canonical store.

```bash
cp .env.example .env
# then edit .env in your editor of choice and fill in values
```

If you add a new env variable to the app, also add it (with a placeholder value or empty `=`) to `.env.example` and commit. Future-you setting up machine #3 will thank you.

> **Note:** secrets should not live in Google Drive long-term. Recommended canonical stores: 1Password / Bitwarden CLI, or a dedicated secrets manager (Doppler, Infisical).

---

## Claude Code

The repo has a `CLAUDE.md` at the root that defines project conventions. Claude Code reads it automatically when you start a session in this directory.

To start a session:

```bash
cd ~/projects/RedlineIQ
claude
```

Plugins/MCPs are user-level (not per-project), so they follow your Claude Code install. If your laptop and desktop have different plugins enabled, see `MACHINE_SETUP.md` for the canonical list and how to re-add.

---

## Common tasks

```bash
# Run the dev server
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Build for production
npm run build
```

*(Replace placeholders with whatever scripts `package.json` actually defines — update this section when scripts change.)*

---

## Per-machine notes

### Windows (both desktop and laptop)

- **Shell:** Git Bash (MINGW64). Not PowerShell, not WSL.
- **Line endings:** `core.autocrlf=input` globally — keeps LF in the working tree, no CRLF noise in commits.
- **Path:** `~/projects/RedlineIQ` (not Desktop — see Repo location section)
- **Node:** installed via nvm-windows, not the official .msi. `nvm use` in this directory picks up `.nvmrc` automatically.

### If `nvm use` fails with "exit status 1"

nvm-windows sometimes needs admin to switch the Node symlink:

1. Close Git Bash
2. Right-click Git Bash → **Run as administrator**
3. `nvm use 22.14.0`

After that, normal (non-admin) Git Bash works fine.

---

## Troubleshooting

**`node` not found after install:** close all terminals and reopen. nvm sets PATH on shell start.

**`npm install` is slow or fails on `/mnt/c/`:** you're inside WSL. RedlineIQ is set up to run on native Windows + Git Bash, not WSL. Don't try to migrate it.

**Push goes through but warns "repository moved":** your remote still points to the old `RedlineIQ` (capitalized) URL. Fix:
```bash
git remote set-url origin https://github.com/nick-furr/redlineiq.git
```

**Dependabot alerts spam your inbox:** see the open Notion task for tackling vulnerabilities; until then, `npm audit` shows the current state.

---

## When you add a new machine

1. Run through `MACHINE_SETUP.md` for the global baseline
2. Follow the Quick Start at the top of this file
3. Populate `.env` from your secrets store
4. Confirm `node -v` matches `.nvmrc` and `npm install` runs clean
5. Open Claude Code, verify plugins match your other machines
6. You're done — total time should be under 15 min if the baseline's in place

---

*Last updated: 2026-05-23 (path migration: Desktop → ~/projects/)*
