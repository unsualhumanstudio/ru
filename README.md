# rū

**An AI-native interaction primitive for context sharing.**

Highlight context once. Call it into any AI conversation, anytime — with just `#`.

---

## The idea

Context doesn't travel across tools. It gets left behind.

Users move between browsers, notes, documents, and AI conversations all day — but the context they've built up in one place never follows them to the next. The workarounds are manual, fragmented, and invisible to every other tool in the stack.

rū introduces the `#` gesture as a deliberate interaction primitive — giving users explicit control over what context enters AI model conversations, making human agency visible at the interaction layer rather than delegating it to ambient memory.

`#folder/document` lets you capture a spark the moment it happens and call it into any conversation, without switching apps or reprompting from scratch. Private context stays local. Public context is published under a namespace you own and can be called by anyone.

---

## The `#` primitive — two modes

**Private** (`#tag`)
Resolves from your local vault. Never leaves your machine. Only you can call it.

```
#project    → your notes on a specific project
#research   → your curated research context
#me         → your background, preferences, working style
```

**Public** (`#folder/document.namespace`)
A path you've claimed under your namespace and chosen to share. Others can call it to retrieve your published context.

```
#rū/onboarding.yournamespace      → your public onboarding guide
#research/summary.yournamespace   → your public research summary
```

Private is the default. Public requires a deliberate claim under a namespace you own. You decide what's shareable.

---

## Install

Requires: [Claude Desktop](https://claude.ai/download) and [Node.js](https://nodejs.org) 18+.

```bash
npx ru-mcp setup
```

The setup wizard will:
1. Write the rū MCP server config to Claude Desktop automatically
2. Optionally connect your Obsidian vault (requires the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api))

Then **fully quit and relaunch Claude Desktop** (Cmd+Q, not just close the window).

That's it. Type a `#tag` in any Claude conversation and rū resolves it automatically.

---

## How it works

rū runs as a local MCP server. Claude Desktop connects to it on startup. When you write a `#tag` in a message, rū automatically retrieves matching context from your vault and delivers it to Claude before it responds.

No cloud. No account required for private tags. Your context stays on your machine.

**Smart retrieval:** If a tag appears at the top of a note (page-level), rū fetches the full note. If it appears inline, rū returns just the surrounding snippet. You always get the right amount of context.

**Keeper:** Create a `Keeper/` folder in your vault to define how rū resolves specific tags. `Keeper/default` applies globally. `Keeper/tasks` applies only when resolving `#tasks`. No config files — just notes.

---

## Using rū

Once Claude Desktop is running with rū connected, just type a `#tag` in any conversation:

> What should I focus on this week? #project

Claude retrieves your `#project` context and factors it into the response. No setup per conversation. No prompt to attach. It just works.

**Public tags** use a namespace suffix:

> Walk me through setup. #rū/onboarding.ru

---

## Tagging your notes

In Obsidian, add `#tag` anywhere in a note. rū finds it.

For page-level context (the whole note is about this topic), put the tag on line 1:

```markdown
#project

This project is about building a tool that...
```

For inline context (the tag marks a section within a larger note):

```markdown
## Meeting notes — Feb 2025

#project The client confirmed the scope...
```

---

## Browser extension

The rū browser extension lets you seed context from anything you read — highlight text on any webpage, pick a type, assign a `#tag`, and it lands in your vault instantly.

Download the latest `.zip` from [ru-ivory.vercel.app](https://ru-ivory.vercel.app) and load it as an unpacked extension in Chrome.

---

## Connecting Obsidian

1. Install the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) in Obsidian
2. Enable it and copy the API key from **Settings → Community Plugins → Local REST API**
3. Re-run `npx ru-mcp setup` and enter the key when prompted

---

## Troubleshooting

**Tags return no results**
- Make sure Obsidian is open (not just in the background — the window must be active)
- Confirm the Local REST API plugin is enabled

**rū doesn't appear in Claude Desktop**
- Fully quit Claude Desktop (Cmd+Q) and relaunch after setup

**Extension shows "Error saving"**
- Make sure Claude Desktop is running — the extension bridge runs inside the MCP server

**Extension shows "Open Obsidian to save"**
- Make sure Obsidian is open and the Local REST API plugin is enabled

---

## Coming next

- **rū Desktop** — a native app that replaces Obsidian as the local vault, making setup instant
- **Namespace registry** — claim your namespace, publish and share context with anyone
- **Keeper** — per-tag synthesis instructions that guide how Claude resolves your context

See [SPEC.md](./SPEC.md) for the full protocol specification.

---

## Creator

rū was created by **Diana Angelica Valdes Contreras**.
MIT License © 2025
