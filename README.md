# Create State VS Code Extension

AI-powered knowledge graph for your codebase. Capture context, search knowledge, and maintain continuity across sessions.

## Quick Start

1. Install the extension
2. [Create a free account](https://createstate.ai/web/signup) (free trial available)
3. [Get your API key](https://createstate.ai/web/api-keys) from your account dashboard
4. Run `Create State: Set API Key` and enter your API key
5. Open Copilot Chat and type `@createstate restore` to continue from your last session

## Links

- **Website**: https://createstate.ai
- **Documentation**: https://createstate.ai/web/documentation
- **API Keys**: https://createstate.ai/web/api-keys
- **GitHub**: https://github.com/Create-State/createstate-vscode
- **SDK Downloads**: https://createstate.ai/web/sdk
- **Privacy Policy**: https://createstate.ai/web/privacy
- **Security Policy**: https://createstate.ai/web/security-policy
- **Support**: support@createstate.ai

## Copilot Chat Integration

The extension registers as a **Copilot Chat Participant**, allowing natural language interaction:

```
@createstate what decisions have we made about authentication?
@createstate restore
@createstate capture We chose Redis for caching due to its TTL support
@createstate handoff Finished implementing user auth
```

### Chat Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/search` | Search knowledge graph | `@createstate /search auth flow` |
| `/restore` | Restore latest session | `@createstate /restore` |
| `/handoff` | Create session handoff | `@createstate /handoff Added caching layer` |
| `/synthesize` | Generate project summary | `@createstate /synthesize` |
| `/capture` | Capture context/decisions | `@createstate /capture Decided to use JWT` |
| `/code` | Capture selected code | `@createstate /code Auth middleware` |
| `/context` | Get project world model | `@createstate /context` |
| `/models` | List world models | `@createstate /models` |
| `/help` | Show all commands | `@createstate /help` |

### Natural Language

You can also just ask naturally without commands:

- "What have we decided about the database schema?"
- "Remember that we chose PostgreSQL for ACID compliance"
- "Continue from where I left off"
- "Save this session"
- "Summarize the project"

## Core Features

### Session Management
- **Quick Restore** (`Cmd+Shift+R`) - Instantly restore from your most recent session handoff
- **Create Handoff** (`Cmd+Shift+H`) - Save your current session state for later continuation
- **Restore from Handoff** - Browse and select from previous handoffs

### Knowledge Graph
- **Search Knowledge** (`Cmd+Shift+K`) - Search all captured decisions, insights, and context
- **Synthesize Context** (`Cmd+Shift+Y`) - Generate comprehensive project summary from captured knowledge

### Capture
- **Capture Code** - Select code and capture it to the knowledge graph with descriptions
- **Capture Context** - Record decisions, insights, and architectural notes

## Keyboard Shortcuts

| Shortcut | Mac | Windows/Linux | Action |
|----------|-----|---------------|--------|
| Quick Restore | `Cmd+Shift+R` | `Ctrl+Shift+R` | Restore latest session |
| Create Handoff | `Cmd+Shift+H` | `Ctrl+Shift+H` | Save current session |
| Search Knowledge | `Cmd+Shift+K` | `Ctrl+Shift+K` | Search the knowledge graph |
| Synthesize | `Cmd+Shift+Y` | `Ctrl+Shift+Y` | Generate project context |

## Sidebar

Click the Create State icon in the Activity Bar to access:
- Session controls (restore/create handoffs)
- Knowledge graph search and synthesis
- Code and context capture

## Installation

### From Source

```bash
cd vscode-extension
npm install
npm run compile
npm run package   # Creates .vsix file
```

Then in VS Code: Extensions > ... > Install from VSIX

### From Marketplace

Search for "Create State" in VS Code Extensions, or visit the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=CreateState.createstate).

## API Key Management

Your API key is stored securely using VS Code's SecretStorage (encrypted via your OS keychain).

| Action | How To |
|--------|--------|
| **Set API Key** | Command Palette → `Create State: Set API Key` |
| **Change API Key** | Run `Create State: Set API Key` again (overwrites existing) |
| **Clear API Key** | Command Palette → `Create State: Clear API Key` |

The API key is never stored in plain text settings files.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `createstate.serverUrl` | Create State server URL | `https://createstate.ai` |
| `createstate.projectName` | Default project/world model name | (empty) |

## Commands

| Command | Description |
|---------|-------------|
| `Create State: Set API Key` | Configure your API key |
| `Create State: Clear API Key` | Remove your stored API key |
| `Create State: Quick Restore (Latest Handoff)` | Restore most recent session |
| `Create State: Restore from Handoff` | Browse and restore from handoffs |
| `Create State: Create Handoff` | Save session for later |
| `Create State: Search Knowledge Graph` | Search captured knowledge |
| `Create State: Synthesize Project Context` | Generate project summary |
| `Create State: Capture Selected Code` | Capture highlighted code |
| `Create State: Capture Context` | Record notes/decisions |
| `Create State: Load World Model` | Load a project's context |
| `Create State: List World Models` | View all your world models |

## Context Menu

Right-click on selected code to access "Create State: Capture Selected Code".

## For AI Agents

This extension is designed to help AI coding agents maintain context across sessions.

### Recommended Workflow

**Start of session:**
```
@createstate /restore
```
This loads your previous session context, active world model, and pending work.

**During work - searching for context:**
```
@createstate why did we choose PostgreSQL?
@createstate what patterns do we use for API endpoints?
@createstate are there any known issues with auth?
```

**Capturing decisions and context:**
```
@createstate /capture Decided to use Redis for session storage because of TTL support and atomic operations
@createstate /capture Fixed the race condition by adding optimistic locking - root cause was concurrent updates to user preferences
```

**Capturing code (select code first, then):**
```
@createstate /code Authentication middleware that validates JWT tokens
```

**End of session:**
```
@createstate /handoff Implemented user authentication with JWT
```

### What Gets Stored

The knowledge graph stores:
- Architectural decisions and rationale
- Code patterns and conventions  
- Bug fixes and their root causes
- Project priorities and known issues
- Code snapshots with versioning
- Session context for continuity

### GitHub Copilot Instructions

Add this to `.github/copilot-instructions.md` for Copilot to automatically use Create State:

```markdown
## Create State Integration

At the start of each session, restore context:
@createstate /restore

Before making architectural decisions, search for prior decisions:
@createstate /search [topic]

Capture important decisions as you make them:
@createstate /capture [decision and rationale]

At session end, create a handoff:
@createstate /handoff [summary]
```

## Architecture

```
src/
  extension.ts        # Entry point, status bar
  mcpClient.ts        # MCP JSON-RPC client (HTTP)
  auth.ts             # API key management
  commands.ts         # VS Code command implementations
  sidebarProvider.ts  # Sidebar webview UI
```

## License

MIT License - Copyright (c) 2026 Create State. All rights reserved.

See [LICENSE](LICENSE) for details.
