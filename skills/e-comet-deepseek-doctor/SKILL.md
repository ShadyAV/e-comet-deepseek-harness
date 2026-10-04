---
name: e-comet-deepseek-doctor
description: Diagnose missing e-Comet tools, account connection, browser extension readiness, and signed Wildberries or Ozon calls in DeepSeek Harness.
---

# e-Comet in DeepSeek Harness

Use observed tool results to distinguish account login, extension prerequisites, host compatibility and unknown failures. A successfully imported plugin does not prove either MCP is connected.

1. Look for the `mcp__e-comet__` and `mcp__e-comet-local__` tools. If remote tools are absent, direct the user to Plugins → Installed → dsh-e-comet → e-Comet account → Connect e-Comet → Open login page. Account login happens in the browser; do not ask for API keys or bearer tokens in chat, terminal commands, or a restart after ordinary login. A successful account connection must be verified with a remote `info` call.
2. Call `local_bridge_status` for current bridge facts. A secondary bridge with `address_in_use` can be healthy. For an unconnected extension, use `e_comet_diagnose` with installation scope, `safe_probes`, and `extension_install`. Do not run Codex-only probes in DeepSeek.
3. If a checked browser profile has e-Comet installed but disabled, tell the user to enable that copy. For a WB flow, open wildberries.ru in the browser with the enabled extension. Browser metadata does not prove which browser the user is using. An Ozon flow follows its own typed route result.
4. Before a browser operation, call `describe_e_comet_tool` for the exact local tool and follow its contract. The native adapter owns authorization. Never supply `triggerUrl`, `trigger_url`, signatures or host-adapter fields in model input, and never copy an authorization between tools or sessions.
5. Missing, expired or rejected authorization is not permission to automatically repeat `browser_job`. Preserve completed work; an uncertain report creation or upload must not be retried to hide an error.
6. If a host capability is reported unsupported, state the exact limitation. Do not offer Codex/Cowork menu instructions or claim that submitting feedback works before this host's consent and transcript path have been verified. Do not send a report without the user's explicit consent.

The public upstream tool contracts define marketplace parameters and recovery rules. This skill changes host diagnostics, not those contracts.
