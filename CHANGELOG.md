# Changelog

All notable changes to the Create State VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-05

### Added

- Initial release
- **Copilot Chat Participant** (`@createstate`)
  - Natural language interaction with knowledge graph
  - Commands: `/search`, `/restore`, `/handoff`, `/synthesize`, `/capture`, `/code`, `/context`, `/models`, `/help`
  - Intelligent intent inference from natural language
  - Followup suggestions after responses

- **Session Management**
  - Quick restore from latest handoff (`Cmd+Shift+R`)
  - Create session handoff (`Cmd+Shift+H`)
  - Browse and restore from previous handoffs

- **Knowledge Graph**
  - Search captured knowledge (`Cmd+Shift+K`)
  - Synthesize project context (`Cmd+Shift+Y`)
  - View project world model

- **Capture**
  - Capture selected code with descriptions
  - Capture context, decisions, and insights
  - Right-click context menu integration

- **UI**
  - Sidebar panel with quick actions
  - Status bar indicator
  - Results display in webview panels

- **Infrastructure**
  - MCP JSON-RPC client over HTTP
  - Secure API key storage via VS Code SecretStorage
  - Comprehensive test suite

### Technical Details

- Uses HTTP transport to Create State MCP endpoint (`/mcp/`)
- Bearer token authentication
- VS Code API 1.85+
- TypeScript with strict mode
