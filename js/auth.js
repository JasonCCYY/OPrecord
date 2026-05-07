// ── Google OAuth2 Authentication ──
const AUTH = {
  CLIENT_ID: '819164879021-10qcb700t7vpt5l1qhff7id63pkfve9e.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  tokenClient: null,
  accessToken: null,
  userEmail: null,

  async init() {
    return new Promise((resolve) => {
      // Load GIS
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          callback: (resp) => {
            if (resp.error) { console.error(resp); return; }
            this.accessToken = resp.access_token;
            this._saveToken(resp);
            APP.onAuthSuccess();
          }
        });
        // Try restore
        const saved = this._loadToken();
        if (saved) {
          this.accessToken = saved.access_token;
          APP.onAuthSuccess();
        }
        resolve();
      };
      document.head.appendChild(script);
    });
  },

  signIn() {
    if (this.tokenClient) this.tokenClient.requestAccessToken({ prompt: '' });
  },

  signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    localStorage.removeItem('ortho_token');
    location.reload();
  },

  _saveToken(resp) {
    const expiry = Date.now() + (resp.expires_in * 1000);
    localStorage.setItem('ortho_token', JSON.stringify({
      access_token: resp.access_token,
      expiry
    }));
  },

  _loadToken() {
    const raw = localStorage.getItem('ortho_token');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expiry - 60000) {
      localStorage.removeItem('ortho_token');
      return null;
    }
    return data;
  },

  isSignedIn() { return !!this.accessToken; }
};
