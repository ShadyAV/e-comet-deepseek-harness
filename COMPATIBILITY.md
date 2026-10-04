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
| Native account page | Actual installed Desktop: Plugins → Installed → dsh-e-comet, account card and separate local/remote states | Passed |
| Human account login | User completed browser login from the account card; the page became connected and remote info succeeded | Passed without app restart after login |
| Desktop WB search | Existing session: remote info → describe_e_comet_tool → browser_job → wb_search_by_query; all four tool results successful, first page returned | Passed with actual backend and extension |
| Private authorization | Native session records show no triggerUrl/trigger_url in model-authored calls for that successful search | Observed |
| Ozon and XLSX | Ozon report creation/download and opening the exact returned XLSX | Not verified |
| Feedback | Host-owned consent/transcript attestation not implemented | Explicitly denied |
| Other hosts | No changes to original Claude/Codex public source | Their existing support is not evidence of DeepSeek support |

The account page, user-controlled browser authorization and WB search were exercised through supported Windows UI automation in the actual Desktop application with its backend. CLI/Cordis and fixture checks do not substitute for the remaining Ozon/XLSX acceptance tests. No login code or account credentials are included in the published evidence.

The automated suite covers native account RPC, background OAuth, callback cancellation and deadline, failed login, later MCP mounting, process loss, Client API Gateway startup, and all original transport/authorization checks. Shared Harness dependencies are pinned to 0.2.0-rc.2; other versions must be tested before changing that compatibility declaration.

Release 0.2.0 verification: 52 tests passed; its archive installed through the bundled Desktop CLI into an isolated profile without a version exemption. The browser client ships prebuilt and needs no install-time compilation.

Release 0.2.1 changes presentation and native display metadata only: branded logo/title/description, capability cards and connection badges. The account controller and RPC behavior are unchanged. The actual Desktop rendered the branded installed entry and the new account layout; 53 tests passed, including the real DeepSeek metadata reader.

## Accepted residual

Cancellation during remote MCP bootstrap after successful OAuth can wait for the SDK's bounded request timeout. The OAuth phase itself is cancellable. Slow-bootstrap cancellation was identified from code; its latency has not been reproduced through the actual Desktop/backend. Keep this as a verification gap rather than claiming instantaneous cancellation at every stage.

The Claude compatibility hook bridge ignores updatedInput. This bundle instead owns MCP registration and performs the trusted argument injection inside the local tool body, after native policy execution and before the SDK call. A remote authorization becomes eligible only after the native committed result observer.

Sources:

- https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client
- https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/hooks/hooks-claude-code
- https://github.com/modelcontextprotocol/typescript-sdk
- https://code.claude.com/docs/en/hooks
- https://developers.openai.com/plugins/concepts/plugins
