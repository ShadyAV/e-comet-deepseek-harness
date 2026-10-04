window.__ModuleLoader__.load({
  id: 'dsh-e-comet',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'eComet.account';
    const dictionaries = {
      ru: { available: 'Подключено', local: 'Локальные инструменты WB / Ozon', remote: 'Аналитика e-Comet', unavailable: 'Недоступно', disconnected: 'Не подключено', title: 'Аккаунт e-Comet', summary: 'Подключите e-Comet, чтобы пользоваться аналитикой продавца.', checking: 'Проверяем подключение…', logged_out: 'e-Comet не подключён', connecting: 'Ожидаем входа в браузере…', connected: 'e-Comet подключён', error: 'Не удалось подключить e-Comet', connect: 'Подключить e-Comet', open: 'Открыть страницу входа', cancel: 'Отменить вход', disconnect: 'Отключить e-Comet', refresh: 'Проверить подключение', loginFailed: 'Не удалось начать вход. Попробуйте ещё раз.', statusFailed: 'Не удалось проверить подключение. Повторите проверку.', cancelFailed: 'Не удалось отменить вход. Попробуйте ещё раз.', disconnectFailed: 'Не удалось отключить аккаунт. Попробуйте ещё раз.', loginHint: 'Откройте страницу входа и подтвердите подключение в браузере. Этот экран обновится автоматически.' },
      en: { available: 'Connected', local: 'Local WB / Ozon tools', remote: 'e-Comet analytics', unavailable: 'Unavailable', disconnected: 'Not connected', title: 'e-Comet account', summary: 'Connect e-Comet to use seller analytics.', checking: 'Checking connection…', logged_out: 'e-Comet is not connected', connecting: 'Waiting for browser login…', connected: 'e-Comet connected', error: 'Could not connect e-Comet', connect: 'Connect e-Comet', open: 'Open login page', cancel: 'Cancel login', disconnect: 'Disconnect e-Comet', refresh: 'Check connection', loginFailed: 'Could not start login. Please try again.', statusFailed: 'Could not check the connection. Please retry.', cancelFailed: 'Could not cancel login. Please try again.', disconnectFailed: 'Could not disconnect the account. Please try again.', loginHint: 'Open the login page and approve the connection in your browser. This screen updates automatically.' },
      zh: { available: '已连接', local: '本地 WB / Ozon 工具', remote: 'e-Comet 分析', unavailable: '不可用', disconnected: '未连接', title: 'e-Comet 账户', summary: '连接 e-Comet 以使用卖家分析。', checking: '正在检查连接…', logged_out: '尚未连接 e-Comet', connecting: '等待浏览器登录…', connected: '已连接 e-Comet', error: '无法连接 e-Comet', connect: '连接 e-Comet', open: '打开登录页面', cancel: '取消登录', disconnect: '断开 e-Comet', refresh: '检查连接', loginFailed: '无法开始登录，请重试。', statusFailed: '无法检查连接，请重试。', cancelFailed: '无法取消登录，请重试。', disconnectFailed: '无法断开账户，请重试。', loginHint: '打开登录页面并在浏览器中确认连接。此页面会自动更新。' },
    };

    Object.assign(dictionaries.en, {
      capabilities: 'Built for marketplace sellers', analyticsTitle: 'Seller analytics', analyticsText: 'Sales, advertising and stock, with context from your account.', wbTitle: 'Live Wildberries data', wbText: 'Search positions, product cards and seller reviews.', ozonTitle: 'Ozon Seller reports', ozonText: 'Promotion and general analytics exports.', connectionTitle: 'Connection', accountHint: 'Sign in with your e-Comet email. Tools connect automatically after authorization.', readyHint: 'Your account is connected. You can work with seller data in this conversation.', localHint: 'Uses the e-Comet Chrome extension.', remoteHint: 'Uses your e-Comet account.', badgeReady: 'Connected', badgeWaiting: 'Awaiting sign-in', badgeError: 'Needs attention', badgeOff: 'Not connected', badgeChecking: 'Checking', privacyHint: 'Email sign-in · no keys to paste into chat'
    });
    Object.assign(dictionaries.ru, {
      capabilities: 'Для продавцов маркетплейсов', analyticsTitle: 'Аналитика продавца', analyticsText: 'Продажи, реклама и остатки с данными вашего аккаунта.', wbTitle: 'Данные Wildberries', wbText: 'Позиции в поиске, карточки товаров и отзывы продавца.', ozonTitle: 'Отчёты Ozon Seller', ozonText: 'Выгрузки по продвижению и общей аналитике.', connectionTitle: 'Подключение', accountHint: 'Войдите по почте e-Comet. Инструменты подключатся автоматически.', readyHint: 'Аккаунт подключён. Можно работать с данными продавца в этом диалоге.', localHint: 'Через расширение e-Comet в Chrome.', remoteHint: 'Данные вашего аккаунта e-Comet.', badgeReady: 'Подключено', badgeWaiting: 'Ожидаем входа', badgeError: 'Нужно внимание', badgeOff: 'Не подключено', badgeChecking: 'Проверяем', privacyHint: 'Вход по почте · без ключей в чате'
    });
    Object.assign(dictionaries.zh, {
      capabilities: '为电商卖家打造', analyticsTitle: '卖家分析', analyticsText: '结合账户数据分析销售、广告和库存。', wbTitle: 'Wildberries 实时数据', wbText: '搜索排名、商品卡片和卖家评论。', ozonTitle: 'Ozon Seller 报表', ozonText: '导出推广和综合分析报表。', connectionTitle: '连接', accountHint: '使用 e-Comet 邮箱登录，授权后工具会自动连接。', readyHint: '账户已连接，可在此对话中处理卖家数据。', localHint: '使用 Chrome 中的 e-Comet 扩展。', remoteHint: '使用您的 e-Comet 账户。', badgeReady: '已连接', badgeWaiting: '等待登录', badgeError: '需要处理', badgeOff: '未连接', badgeChecking: '正在检查', privacyHint: '邮箱登录 · 无需在对话中粘贴密钥'
    });

    function createAccountController(api) {
      let snapshot = { state: 'checking', busy: false, authorizationUrl: null, notice: null };
      let disposed = false;
      let revision = 0;
      let timer;
      let read;
      const listeners = new Set();
      const set = (patch) => {
        if (disposed) return;
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners) listener();
        clearTimeout(timer);
        if (snapshot.state === 'connecting' && !snapshot.busy) timer = setTimeout(() => { void refresh(); }, 1000);
      };
      const unwrap = (result) => {
        if (!result?.ok) throw new Error('native remote failed');
        return result.value;
      };
      const safeLoginUrl = (value) => {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe login link');
        return url.href;
      };
      async function refresh() {
        if (disposed || snapshot.busy || read) return read;
        const current = revision;
        read = (async () => {
          try {
            const status = unwrap(await api.getStatus());
            if (current !== revision || disposed) return;
            set({ state: status.state, notice: null, detail: typeof status.error === 'string' ? status.error : null, connections: status.connections ?? null, authorizationUrl: status.state === 'connecting' ? (status.authorizationUrl ? safeLoginUrl(status.authorizationUrl) : snapshot.authorizationUrl) : null });
          } catch {
            if (current === revision) set({ notice: 'statusFailed', ...(snapshot.state === 'checking' ? { state: 'error' } : {}) });
          } finally {
            read = null;
          }
        })();
        return read;
      }
      async function action(method, notice) {
        if (disposed || (snapshot.busy && method !== 'cancelLogin')) return;
        const current = ++revision;
        set({ busy: true, operation: method, notice: null, detail: null, ...(method === 'startLogin' ? { authorizationUrl: null } : {}) });
        try {
          const result = unwrap(await api[method]());
          if (current !== revision || disposed) return;
          if (method === 'startLogin') {
            if (result.authorizationUrl) {
              set({ state: 'connecting', authorizationUrl: safeLoginUrl(result.authorizationUrl) });
            } else if (result.state === 'connected') set({ state: 'connected' });
            else throw new Error('missing login link');
          } else set({ state: result.state, authorizationUrl: null });
        } catch {
          if (current === revision) set({ notice, ...(method === 'startLogin' ? { state: 'logged_out' } : {}) });
        } finally {
          if (current === revision) set({ busy: false, operation: null });
        }
      }
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        refresh,
        startLogin: () => action('startLogin', 'loginFailed'),
        cancelLogin: () => action('cancelLogin', 'cancelFailed'),
        disconnect: () => action('disconnect', 'disconnectFailed'),
        dispose() { disposed = true; revision++; clearTimeout(timer); listeners.clear(); },
      };
    }

    // Identical to the Host contribution; the bundle needs no browser imports or build step.
    const ACCOUNT_REMOTE = {
      package: 'dsh-e-comet',
      descriptors: ['getStatus', 'startLogin', 'cancelLogin', 'disconnect'].map((method) => ({
        id: `dsh-e-comet#eCometAccount/${method}`,
        service: 'eCometAccount', namespace: 'eCometAccount', method,
        invocation: { kind: 'direct' }, parameters: [], result: { mode: 'src-json' },
      })),
    };
    return {
      inject: ['slots', 'locale', 'remote'],
      createAccountController,
      ACCOUNT_REMOTE,
      async apply(ctx) {
        let phase = 'native account API mounting';
        try {
          await ctx.remote.$mount(ACCOUNT_REMOTE);
          phase = 'locale registration';
          ctx.effect(() => ctx.locale.register(NS, dictionaries), 'e-Comet account dictionaries');
          phase = 'native account namespace lookup';
          const account = ctx.get('remote.eCometAccount');
          if (!account) throw new Error('e-Comet account namespace did not mount');
          const controller = createAccountController(account);
          ctx.effect(() => () => controller.dispose(), 'e-Comet account lifecycle');
          void controller.refresh();
          ctx.on('connection/reset', () => { void controller.refresh(); });
          const cardCss = `
            .ec-card{font:inherit;color:inherit;display:grid;gap:18px;padding:8px 0 12px;width:100%;box-sizing:border-box}
            .ec-card *{box-sizing:border-box}.ec-eyebrow{font-size:11px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;opacity:.55;margin:0 0 12px}
            .ec-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}
            .ec-feature{padding:16px;border:1px solid color-mix(in srgb,currentColor 10%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 2%,transparent)}
            .ec-feature-icon{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:9px;background:rgba(245,151,44,.12);color:#e99838;margin-bottom:10px}
            .ec-feature h4{font-size:14px;font-weight:600;line-height:1.4;margin:0 0 6px}.ec-feature p{font-size:12px;line-height:1.65;opacity:.6;margin:0}
            .ec-panel{padding:22px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:16px;background:color-mix(in srgb,currentColor 3%,transparent)}
            .ec-panel-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.ec-panel h3{margin:0;font-size:16px;font-weight:600}.ec-subtitle{font-size:13px;line-height:1.65;opacity:.6;margin:10px 0 18px;max-width:620px}
            .ec-badge{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,currentColor 5%,transparent);border:1px solid color-mix(in srgb,currentColor 8%,transparent);font-size:11px;line-height:1.4;white-space:nowrap}
            .ec-dot{width:6px;height:6px;border-radius:50%;background:#8e9299;flex:none}.ec-badge[data-tone=ready] .ec-dot{background:#46c985}.ec-badge[data-tone=waiting] .ec-dot{background:#e9a84f}.ec-badge[data-tone=error] .ec-dot{background:#ec7c76}
            .ec-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px;margin:16px 0 0}.ec-link{padding:13px 14px;border:1px solid color-mix(in srgb,currentColor 8%,transparent);border-radius:10px;background:color-mix(in srgb,currentColor 1%,transparent)}
            .ec-link-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:500;flex-wrap:wrap}.ec-link p{font-size:11px;line-height:1.6;opacity:.5;margin:6px 0 0}
            .ec-notice{padding:11px 13px;margin:0 0 16px;border:1px solid rgba(233,168,79,.2);border-radius:10px;background:rgba(233,168,79,.06);font-size:12px;line-height:1.6}
            .ec-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px}.ec-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:9px 14px;border-radius:9px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:500;line-height:1.4;cursor:pointer;text-decoration:none}
            .ec-button:hover{background:color-mix(in srgb,currentColor 5%,transparent)}.ec-button:focus-visible{outline:2px solid #eea44d;outline-offset:3px}.ec-button:disabled{opacity:.4;cursor:not-allowed}
            .ec-button-primary{background:#efa23e;border-color:#efa23e;color:#241b10;font-weight:650}.ec-button-primary:hover{background:#f7b251;border-color:#f7b251}.ec-button-quiet{border-color:transparent;opacity:.65}.ec-footer{display:flex;align-items:center;gap:6px;font-size:10px;opacity:.4;margin:15px 0 0;line-height:1.5}
            @media(max-width:560px){.ec-panel{padding:16px}.ec-feature{padding:15px}.ec-card{gap:16px}}
          `;
          const iconPaths = {
            analytics: 'M4 18V11m6 7V6m6 12V3M2 21h19',
            search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
            report: 'M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9zM14 2v7h7M7 14h10M7 18h7',
            shield: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6',
          };
          const icon = (kind, size=18) => h('svg', { width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true }, h('path',{d:iconPaths[kind]}));
          function AccountCard({ t, view }) {
            const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
            if (view === 'summary') return h('span', null, t(state.state));
            const tone = state.state === 'connected' ? 'ready' : state.state === 'error' ? 'error' : state.state === 'connecting' ? 'waiting' : 'off';
            const badgeKey = {connected:'badgeReady',error:'badgeError',connecting:'badgeWaiting',checking:'badgeChecking',logged_out:'badgeOff'}[state.state] || 'badgeOff';
            const badge = (label, signal) => h('span', {className:'ec-badge','data-tone':signal},h('span',{className:'ec-dot','aria-hidden':true}),label);
            const button = (label, handler, primary=false, disabled=state.busy, quiet=false) => h('button',{type:'button',className:'ec-button'+(primary?' ec-button-primary':'')+(quiet?' ec-button-quiet':''),disabled,onClick:()=>{void handler();}},t(label));
            const connection = (kind, hint) => {
              const current = state.connections?.[kind] || 'disconnected';
              return h('div',{className:'ec-link'},h('div',{className:'ec-link-head'},h('span',null,t(kind)),badge(t(current==='connected'?'available':current),current==='connected'?'ready':'off')),h('p',null,t(hint)));
            };
            const features = [['analytics','analyticsTitle','analyticsText'],['search','wbTitle','wbText'],['report','ozonTitle','ozonText']].map(([kind,title,text]) =>
              h('article', {key:kind,className:'ec-feature'}, h('div',{className:'ec-feature-icon'},icon(kind)), h('h4',null,t(title)), h('p',null,t(text))));
            return h('section', {'aria-label':t('title'),className:'ec-card'},
              h('style',null,cardCss),
              h('div',null,h('p',{className:'ec-eyebrow'},t('capabilities')),h('div',{className:'ec-features'},...features)),
              h('div',{className:'ec-panel'},
                h('div',{className:'ec-panel-head'},h('h3',null,t('connectionTitle')),h('div',{role:'status','aria-live':'polite'},badge(t(badgeKey),tone))),
                h('p',{className:'ec-subtitle'},t(state.state==='connected'?'readyHint':'accountHint')),
                state.detail && h('p',{role:'alert',className:'ec-notice'},state.detail),
                state.notice && h('p',{role:'alert',className:'ec-notice'},t(state.notice)),
                state.authorizationUrl && h('p',{className:'ec-subtitle'},t('loginHint')),
                h('div',{className:'ec-actions'},
                  state.authorizationUrl && h('a',{href:state.authorizationUrl,target:'_blank',rel:'noopener noreferrer',className:'ec-button ec-button-primary'},t('open')),
                  state.state==='connected' ? button('refresh',controller.refresh) : state.state==='connecting'||state.busy ? button('cancel',controller.cancelLogin,false,state.busy&&state.operation!=='startLogin') : button('connect',controller.startLogin,true,state.busy||state.state==='checking'),
                  state.state==='connected' ? button('disconnect',controller.disconnect,false,state.busy,true) : button('refresh',controller.refresh)
                ),
                h('div',{className:'ec-links'},connection('remote','remoteHint'),connection('local','localHint')),
                h('p',{className:'ec-footer'},icon('shield',12),t('privacyHint'))
              )
            );
          }
          phase = 'account page registration';
          ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-e-comet', locale: NS }, AccountCard));
        } catch (error) {
          console.error('[dsh-e-comet] Client bootstrap failed during ' + phase);
          throw error;
        }
      },
    };
  },
});
