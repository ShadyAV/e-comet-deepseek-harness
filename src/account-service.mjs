import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ACCOUNT_HOST } from './account-rpc.mjs';

export class AccountService extends TypertRemoteService {
  static inject = ['typert'];
  constructor(ctx, { account, connections } = {}) {
    super(ctx, 'eCometAccount', { namespace: 'eCometAccount' });
    this.account = account;
    this.connections = connections;
    ctx.effect(() => ctx.typert.register(ACCOUNT_HOST));
  }
  getStatus() { return { ...this.account.getStatus(), ...(this.connections ? { connections: { ...this.connections } } : {}) }; }
  startLogin() { return this.account.startLogin(); }
  cancelLogin() { return this.account.cancelLogin(); }
  disconnect() { return this.account.disconnect(); }
}
