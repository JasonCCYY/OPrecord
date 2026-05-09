const AUTH = {
  CLIENT_ID: '819164879021-10qcb700t7vpt5l1qhff7id63pkfve9e.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  tokenClient: null,
  accessToken: null,

  async init() {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          callback: resp => {
            if (resp.error) { console.error(resp); return; }
            this.accessToken = resp.access_token;
            this._save(resp);
            this._scheduleRefresh(resp.expires_in * 1000);
            APP.onAuthSuccess();
          }
        });
        const saved = this._load();
        if (saved) {
          this.accessToken = saved;
          // Schedule refresh before token expires
          const d = JSON.parse(localStorage.getItem('ortho_tok') || 'null');
          if (d) this._scheduleRefresh(d.exp - Date.now());
          APP.onAuthSuccess();
        }
        resolve();
      };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  },

  _scheduleRefresh(msUntilExpiry) {
    // Refresh 5 minutes before expiry
    const delay = Math.max(msUntilExpiry - 5 * 60 * 1000, 10000);
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      console.log('Token refreshing...');
      this.tokenClient?.requestAccessToken({ prompt: '' });
    }, delay);
  },

  // Call this when API returns 401
  handleExpired() {
    this.accessToken = null;
    localStorage.removeItem('ortho_tok');
    APP.toast('⚠️ 登入已過期，重新驗證中...');
    setTimeout(() => this.tokenClient?.requestAccessToken({ prompt: '' }), 800);
  },

  signIn() { this.tokenClient?.requestAccessToken({ prompt: '' }); },

  signOut() {
    if (this.accessToken) google.accounts.oauth2.revoke(this.accessToken);
    this.accessToken = null;
    localStorage.removeItem('ortho_tok');
    location.reload();
  },

  _save(resp) {
    localStorage.setItem('ortho_tok', JSON.stringify({ t: resp.access_token, exp: Date.now() + resp.expires_in * 1000 }));
  },
  _load() {
    try {
      const d = JSON.parse(localStorage.getItem('ortho_tok') || 'null');
      if (!d || Date.now() > d.exp - 60000) { localStorage.removeItem('ortho_tok'); return null; }
      return d.t;
    } catch { return null; }
  },
  get ok() { return !!this.accessToken; }
};
