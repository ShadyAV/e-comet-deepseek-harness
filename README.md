# e-Comet for DeepSeek Harness

Experimental independent integration for seller analytics and local Wildberries/Ozon tools. Requires DeepSeek Harness Desktop **0.2.0-rc.2**, Node.js 22+, an e-Comet account and the e-Comet Chrome extension for browser operations. The model's usage plan is separate from this package.

This is a native DeepSeek bundle, not an import of the Claude/Codex manifest. The MCP implementation comes from public e-Comet release 2026.9.3; see NOTICE and LICENSE. This repository is not an official DeepSeek or e-Comet endorsed distribution.

## Install

In DeepSeek Harness, open **Plugins → Add plugin**, paste the repository root and click Install:

```text
https://github.com/ShadyAV/e-comet-deepseek-harness
```

Do not use a GitHub `/tree/main/...` link. The root package declares `dsh.bundle` and ships JavaScript directly; installation needs no build script permission.

Alternatively, install the release archive into your selected profile:

```text
dsh plugin --profile desktop add ./dsh-e-comet-0.2.0.tgz
```

Only one copy of this bundle should be enabled in the same profile. After upgrading from 0.1.0, restart DeepSeek once so the new account page is loaded. Subsequent account connections do not require an application restart.

## Connect your e-Comet account

1. Open **Plugins → Installed → dsh-e-comet**.
2. In **e-Comet account**, click **Connect e-Comet**.
3. Click **Open login page** and sign in with your e-Comet email in the browser. Enter the email code on that page, never in chat.
4. Return to DeepSeek. The account page updates automatically, and the remote tools connect without restarting the application.

The card also offers **Cancel login**, **Disconnect e-Comet**, and **Check connection**. Cancelling, declining, or timing out does not silently restart authorization. Local WB/Ozon tools remain independent of remote account login; their connection status does not prove that the browser extension is ready.

Do not paste API keys, bearer tokens or browser authorizations into chat. Login credentials stay in your user profile at `.e-comet-deepseek-harness/account/credentials.json`; they are not published or sent to the model. On Windows, POSIX file modes do not enforce ACLs: keep this user-profile directory private to your Windows account.

If remote login has not completed, local diagnostics remain available. Account connection is verified only after a real remote `info` call succeeds.

## Browser prerequisite

Install and enable the [e-Comet extension](https://chromewebstore.google.com/detail/e-comet/apeallgchpgibifmbgefkhifidihmodh), activate it with your e-Comet account API key in the extension UI, and sign into the relevant marketplace in that Chrome profile. For WB, open wildberries.ru. For Ozon, follow the tool's seller-portal prerequisites.

Start with a small read-only request, for example: «Получи первую страницу выдачи WB по запросу тушенка». The agent must follow `describe_e_comet_tool`, then authorize the matching job and call its local tool. The native adapter injects the permission privately. A model-authored authorization, another session/tool, expired authorization or duplicate pending grants is denied.

## Current verification and limits

See [COMPATIBILITY.md](COMPATIBILITY.md). This is an experimental package, not a declaration of complete Desktop support.

- Native authorization and denial paths have automated tests, including execution on the published Harness ToolRuntime.
- The native account page and browser login were tested in the real Desktop. Remote tools connected after login without restarting it.
- A real first-page WB search completed through info, describe_e_comet_tool, browser_job and wb_search_by_query in an existing Desktop session.
- Ozon export and XLSX delivery in Desktop have **not** been verified end to end.
- Native feedback submission and optional session transcript collection are currently blocked. The package does not pretend to be Claude/Codex or bypass the consent boundary.
- Tool results retain their canonical MCP content. Image/resource rendering and returned file links require Desktop acceptance testing.
- No automatic retry after an uncertain report creation or upload. Completed work must be preserved.
- This package does not include an AI model subscription and does not establish regional availability or payment support in Russia.

## Development

```text
npm ci --ignore-scripts
npm test
npm pack
```

The adapter and package are maintained here for the pilot. The public e-Comet snapshot is pinned in NOTICE; it is not a copy of private development history. Future distributions can be generated from one canonical repository with host-specific adapters.

The `npm run connect -- --open` helper remains available for developers, but is not the Desktop user's connection procedure.
