# Compatibility evidence — 2026-10-04

Target: official DeepSeek Harness Desktop 0.2.0-rc.2 on Windows. Published runtime packages and the installed Desktop runtime both report 0.2.0-rc.2. MCP JavaScript SDK: 1.32.0. Public e-Comet snapshot: 2026.9.3, commit recorded in NOTICE.

| Surface | Evidence | Status |
| --- | --- | --- |
| Native authorization | Real published ToolRuntime with frozen arguments; private injection, no canonical/content token echo and replay denial | Automated integration passed |
| Other authorization boundaries | Missing lifecycle/grant, expiration, wrong session/namespace, authored token, downstream denial/cancellation, ambiguity | Automated tests passed |
| MCP transports | Real SDK stdio children; independent remote/local startup, schemas and structured results | Automated transport tests passed |
| OAuth | Real SDK against local protocol fixture: PKCE, exchange/refresh, state validation and issuer constraints | Automated protocol tests passed |
| Live discovery | HTTPS e-Comet protected-resource metadata advertises https://auth.mcp.e-comet.io/ | Observed |
| Local bridge | Package loaded into Cordis; real vendored stdio MCP answered local_bridge_status with ok:true | Observed; not a Desktop acceptance result |
| Archive installation | dsh plugin add installed the 0.1.0 archive into an isolated profile without a version exemption | Passed |
| Installed Desktop CLI | Desktop's bundled 0.2.0-rc.2 CLI dump-config includes the installed dsh-e-comet bundle | Passed; not a GUI test |
| Browser extension | The live bridge reported extensionConnected:true during the read-only smoke check | Observed readiness only |
| Human account login | Email/browser OAuth completion and subsequent remote info | Not verified |
| Desktop marketplace calls | WB search, Ozon report, permissions UI and opening the exact returned XLSX | Not verified |
| Feedback | Host-owned consent/transcript attestation not implemented | Explicitly denied |
| Other hosts | No changes to original Claude/Codex public source | Their existing support is not evidence of DeepSeek support |

Native app UI automation is unavailable in the development session. CLI/Cordis and fixture checks do not substitute for the actual Desktop UI with its backend. Do not report the marketplace flow as passed until that test is performed.

Final automated suite: 28 tests passed. Public distribution review found no private paths, credentials or private Git history in the packaged files. Shared Harness dependencies are pinned to 0.2.0-rc.2; other versions must be tested before changing that compatibility declaration.

The Claude compatibility hook bridge ignores updatedInput. This bundle instead owns MCP registration and performs the trusted argument injection inside the local tool body, after native policy execution and before the SDK call. A remote authorization becomes eligible only after the native committed result observer.

Sources:

- https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client
- https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/hooks/hooks-claude-code
- https://github.com/modelcontextprotocol/typescript-sdk
- https://code.claude.com/docs/en/hooks
- https://developers.openai.com/plugins/concepts/plugins
