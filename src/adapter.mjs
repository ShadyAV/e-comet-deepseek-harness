import { isDeepStrictEqual } from 'node:util';
import { processHookEvent, extractTriggerUrl } from '../vendor/e-comet/hooks/browser-job-handoff.mjs';

const REMOTE = 'mcp__e-comet__browser_job';
const LOCAL_PREFIX = 'mcp__e-comet-local__';
const TARGETS = Object.freeze({
  product_card: 'wb_product_card', search_by_query: 'wb_search_by_query',
  check_by_query: 'wb_check_by_query', recommendations_by_product: 'wb_recommendations_by_product',
  seller_reviews: 'wb_seller_reviews', ozon_seller_promotion_report: 'ozon_seller_promotion_report',
  ozon_seller_promotion_reports: 'ozon_seller_promotion_reports',
  ozon_seller_analytics_report: 'ozon_seller_analytics_report',
});
const SIGNED = new Set(Object.values(TARGETS).map(name => LOCAL_PREFIX + name));
const FEEDBACK = new Set(['mcp__e-comet__report_issue', LOCAL_PREFIX + 'prepare_e_comet_feedback', LOCAL_PREFIX + 'submit_e_comet_feedback']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });
const sessionId = exec => {
  const id = exec.agent?.session?.header?.id;
  if (typeof id !== 'string' || !id || Buffer.byteLength(id) > 512) throw failure('HANDOFF_INVALID_SESSION', 'The native agent has no valid session identity.');
  return id;
};
const key = (session, target) => JSON.stringify([session, target]);

// Sanitize the canonical value as well as text projections: run_code receives value.
function sanitize(value, token) {
  if (typeof value === 'string') {
    try { return JSON.stringify(sanitize(JSON.parse(value), token)); } catch { return value.split(token).join('[authorization retained privately]'); }
  }
  if (Array.isArray(value)) return value.map(item => sanitize(item, token));
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([field]) => !['trigger_url', 'triggerUrl'].includes(field))
    .map(([field, item]) => [field, sanitize(item, token)]));
}

/** Owns exact native invocations. Secrets never enter arguments logged by ToolRuntime. */
export function createAdapter({ dataDirectory, now = Date.now } = {}) {
  if (typeof dataDirectory !== 'string' || !dataDirectory) throw new TypeError('A dedicated dataDirectory is required.');
  const env = { ...process.env, PLUGIN_DATA: dataDirectory, CLAUDE_PLUGIN_DATA: dataDirectory };
  const permitted = new Map();
  const drafts = new Map();
  const grants = new Map();
  const relevant = name => name === REMOTE || SIGNED.has(name) || FEEDBACK.has(name);

  function validate(exec) {
    if (FEEDBACK.has(exec.name)) throw failure('FEEDBACK_HOST_UNSUPPORTED', 'Native feedback consent and session transcript attestation are unavailable. This call was blocked before dispatch.');
    sessionId(exec);
    if (SIGNED.has(exec.name)) {
      if (!record(exec.arguments)) throw failure('HANDOFF_INVALID_INPUT', 'Local tool arguments must be an object.');
      if (Object.hasOwn(exec.arguments, 'triggerUrl') || Object.hasOwn(exec.arguments, 'trigger_url')) throw failure('HANDOFF_MODEL_AUTHORIZATION', 'Remove model-authored authorization fields; the native adapter injects them privately.');
    }
  }

  async function preExecute(exec, next) {
    if (!relevant(exec.name)) return next();
    try { validate(exec); } catch (error) { return { kind: 'deny', reason: error.message }; }
    const decision = await next();
    if (decision.kind === 'allow' && !exec.signal.aborted) permitted.set(exec.token, { session: sessionId(exec), name: exec.name, executing: false });
    return decision;
  }

  async function execute(exec, next) {
    if (!relevant(exec.name)) return next();
    const permit = permitted.get(exec.token);
    if (!permit || permit.name !== exec.name || permit.session !== sessionId(exec)) throw failure('HANDOFF_UNATTESTED', 'The native pre-execution lifecycle is missing.');
    if (exec.signal.aborted) throw failure('HANDOFF_CANCELLED', 'The native call was cancelled before dispatch.');
    permit.executing = true;
    try { return await next(); } finally { permit.executing = false; }
  }

  function attest(exec) {
    validate(exec);
    const permit = permitted.get(exec.token);
    if (!permit?.executing || permit.name !== exec.name || permit.session !== sessionId(exec)) throw failure('HANDOFF_UNATTESTED', 'The native execution lifecycle is missing.');
    if (exec.signal.aborted) throw failure('HANDOFF_CANCELLED', 'The native call was cancelled before dispatch.');
  }

  async function authorizeLocal(exec) {
    const grantKey = key(sessionId(exec), exec.name);
    const pending = grants.get(grantKey) ?? [];
    grants.delete(grantKey); // A competing local body cannot claim these grants.
    if (!pending.length) throw failure('HANDOFF_MISSING', 'Call browser_job once for this session and matching local tool.');
    const fresh = pending.filter(grant => now() - grant.createdAt <= 90_000 && grant.createdAt <= now() + 5_000);
    if (!fresh.length) throw failure('HANDOFF_EXPIRED', 'Call browser_job once for a fresh matching authorization.');
    // tools/result is synchronous and cannot await disk writes. Deferred publication
    // processes only committed native Post evidence here, before the local body.
    for (const grant of fresh) {
      const stage = await processHookEvent(grant.event, { env, nowMs: grant.createdAt });
      if (stage.exitCode !== 0) throw failure('HANDOFF_STAGE_FAILED', 'The public authorization hook could not stage the committed result. Check local storage and retry with one fresh browser_job.');
    }
    const outcome = await processHookEvent({ hook_event_name: 'PreToolUse', tool_name: exec.name, session_id: sessionId(exec), tool_input: exec.arguments }, { env, nowMs: now() });
    let output;
    try { output = JSON.parse(outcome.stdout).hookSpecificOutput; } catch { throw failure('HANDOFF_HOOK_FAILED', 'The public authorization hook returned no valid decision.'); }
    if (output.permissionDecision !== 'allow' || !record(output.updatedInput)) throw failure('HANDOFF_DENIED', output.permissionDecisionReason ?? 'The public authorization hook denied dispatch.');
    return output.updatedInput;
  }

  function wrapToolDefinition(definition) {
    if (!relevant(definition.name)) return definition;
    const wrapped = { ...definition, async execute(args, exec) {
      attest(exec);
      if (SIGNED.has(exec.name)) {
        const effective = await authorizeLocal(exec);
        if (exec.signal.aborted) throw failure('HANDOFF_CANCELLED', 'The native call was cancelled before local dispatch.');
        try { return sanitize(await definition.execute(effective, exec), effective.triggerUrl); }
        catch (error) {
          const message = error instanceof Error ? error.message : 'The local MCP call failed.';
          throw new Error(message.split(effective.triggerUrl).join('[authorization retained privately]'));
        }
      }
      const raw = await definition.execute(args, exec);
      if (exec.name !== REMOTE) return raw;
      let token;
      try { token = extractTriggerUrl(raw); } catch { throw failure('HANDOFF_INVALID_TOKEN', 'The remote browser authorization is ambiguous or invalid.'); }
      if (!token) throw failure('HANDOFF_TOKEN_NOT_FOUND', 'The remote browser authorization contained no usable token.');
      const target = Object.hasOwn(TARGETS, args?.job?.type) ? TARGETS[args.job.type] : undefined;
      if (!target) throw failure('HANDOFF_INVALID_TOOL', 'The remote job type has no supported local tool.');
      const safe = sanitize(raw, token);
      drafts.set(exec.token, { session: sessionId(exec), target: LOCAL_PREFIX + target, safe, createdAt: now(), eligible: false,
        event: { hook_event_name: 'PostToolUse', tool_name: REMOTE, session_id: sessionId(exec), tool_input: args, tool_response: raw } });
      return safe;
    } };
    if (definition.name === REMOTE) {
      // A bridge projector must never restore its cached, unsanitized upstream result.
      delete wrapped.projectContent;
      delete wrapped.finalizeContent;
    }
    return wrapped;
  }

  async function postExecute(exec, result, next) {
    const decision = await next();
    const draft = drafts.get(exec.token);
    if (draft) draft.eligible = !result.isError && !exec.signal.aborted && decision.kind === 'accept'
      && (decision.value === undefined || isDeepStrictEqual(decision.value, draft.safe));
    return decision;
  }

  function result(exec, outcome) {
    const draft = drafts.get(exec.token);
    drafts.delete(exec.token);
    permitted.delete(exec.token);
    if (!draft?.eligible || outcome.isError || exec.signal.aborted || draft.session !== sessionId(exec) || !isDeepStrictEqual(outcome.value, draft.safe)) return;
    const grantKey = key(draft.session, draft.target);
    const pending = (grants.get(grantKey) ?? []).filter(grant => now() - grant.createdAt <= 90_000);
    pending.push(draft);
    grants.set(grantKey, pending);
  }

  return { wrapToolDefinition, preExecute, execute, postExecute, result };
}

export function installAdapter(ctx, adapter) {
  ctx.on('tools/pre-execute', adapter.preExecute);
  ctx.on('tools/execute', adapter.execute);
  ctx.on('tools/post-execute', adapter.postExecute);
  ctx.on('tools/result', adapter.result);
}
