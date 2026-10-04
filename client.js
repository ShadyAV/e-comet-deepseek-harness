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
          const buttonStyle = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' };
          function AccountCard({ t, view }) {
            const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
            if (view === 'summary') return h('span', null, t(state.state));
            const button = (label, handler, disabled = state.busy) => h('button', { type: 'button', style: buttonStyle, disabled, onClick: () => { void handler(); } }, t(label));
            return h('section', { 'aria-label': t('title'), style: { color: 'inherit', font: 'inherit', padding: 16, display: 'grid', gap: 12 } },
              h('h3', { style: { margin: 0, fontSize: '1.1em' } }, t('title')),
              h('p', { style: { margin: 0 }, role: 'status', 'aria-live': 'polite' }, t(state.state)),
              state.detail && h('p', { role: 'alert', style: { margin: 0 } }, state.detail),
              state.connections && h('div', { style: { fontSize: '0.9em', display: 'grid', gap: 4 } }, h('span', null, t('local') + ': ' + t(state.connections.local === 'connected' ? 'available' : state.connections.local)), h('span', null, t('remote') + ': ' + t(state.connections.remote === 'connected' ? 'available' : state.connections.remote))),
              state.notice && h('p', { role: 'alert', style: { margin: 0 } }, t(state.notice)),
              state.authorizationUrl && h('p', { style: { margin: 0 } }, t('loginHint')),
              h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
                state.authorizationUrl && h('a', { href: state.authorizationUrl, target: '_blank', rel: 'noopener noreferrer', style: buttonStyle }, t('open')),
                state.state === 'connected' ? button('disconnect', controller.disconnect) : state.state === 'connecting' || state.busy ? button('cancel', controller.cancelLogin, state.busy && state.operation !== 'startLogin') : button('connect', controller.startLogin, state.busy || state.state === 'checking'),
                button('refresh', controller.refresh)
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







