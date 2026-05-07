// ── Google OAuth2 ──
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
            APP.onAuthSuccess();
          }
        });
        const saved = this._load();
        if (saved) { this.accessToken = saved; APP.onAuthSuccess(); }
        resolve();
      };
      document.head.appendChild(s);
    });
  },

  signIn() { this.tokenClient?.requestAccessToken({ prompt: '' }); },

  signOut() {
    if (this.accessToken) google.accounts.oauth2.revoke(this.accessToken);
    this.accessToken = null;
    localStorage.removeItem('ortho_tok');
    location.reload();
  },

  _save(resp) {
    localStorage.setItem('ortho_tok', JSON.stringify({
      t: resp.access_token,
      exp: Date.now() + resp.expires_in * 1000
    }));
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
