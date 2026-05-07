// ── Google Sheets API Integration ──
const SHEETS = {
  SPREADSHEET_ID: '1g_nw2_rzJfrzu0KEOPaW3lSDNxxaDweN2FeWzONqCbg',
  BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

  // Sheet name mapping
  TABS: {
    opRecord:    '手術',          // 手術紀錄
    matRecord:   '骨材記錄',      // 醫材記錄
    selfPay:     '骨材產品',      // 自費醫材
    opCode:      'OP代碼',        // 代碼
    codeRecord:  'OP代碼記錄',    // 代碼紀錄
    estimate:    '預估',          // 預估
    clinic:      '門診',          // 門診記錄 (sub-sheet)
    clinicProd:  '門診產品',      // 門診產品
    opCategory:  'OP分類',
  },

  cache: {},

  headers() {
    return { Authorization: `Bearer ${AUTH.accessToken}` };
  },

  async read(tab, range) {
    const key = `${tab}!${range}`;
    const url = `${this.BASE}/${this.SPREADSHEET_ID}/values/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Sheets read error: ${res.status}`);
    const data = await res.json();
    return data.values || [];
  },

  async append(tab, values) {
    const range = `${tab}!A1`;
    const url = `${this.BASE}/${this.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
    if (!res.ok) throw new Error(`Sheets append error: ${res.status}`);
    return res.json();
  },

  async update(tab, row, values) {
    // row is 1-indexed sheet row
    const range = `${tab}!A${row}`;
    const url = `${this.BASE}/${this.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [values] })
    });
    if (!res.ok) throw new Error(`Sheets update error: ${res.status}`);
    return res.json();
  },

  // ── Data Loaders ──

  async loadOpRecords() {
    // 手術: 日期, 院區, 姓名, 類型, 術式, 備註
    const rows = await this.read(this.TABS.opRecord, 'A2:F500');
    return rows.map((r, i) => ({
      _row: i + 2,
      date: r[0] || '',
      area: r[1] || '',
      name: r[2] || '',
      type: r[3] || '',
      procedure: r[4] || '',
      note: r[5] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadMatRecords() {
    // 骨材記錄: 日期, 廠牌, 產品, 數量, 單價
    const rows = await this.read(this.TABS.matRecord, 'A2:E500');
    return rows.map((r, i) => ({
      _row: i + 2,
      date: r[0] || '',
      brand: r[1] || '',
      product: r[2] || '',
      qty: r[3] || '',
      price: r[4] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadSelfPay() {
    // 骨材產品: 廠牌, 產品, 單價, 醫院
    const rows = await this.read(this.TABS.selfPay, 'A2:D200');
    return rows.map((r, i) => ({
      _row: i + 2,
      brand: r[0] || '',
      product: r[1] || '',
      price: r[2] || '',
      hospital: r[3] || ''
    }));
  },

  async loadOpCodes() {
    // OP代碼: 代碼, 術式, 院區, 單價
    const rows = await this.read(this.TABS.opCode, 'A2:D200');
    return rows.map((r, i) => ({
      _row: i + 2,
      code: r[0] || '',
      name: r[1] || '',
      area: r[2] || '',
      price: r[3] || ''
    }));
  },

  async loadCodeRecords() {
    // OP代碼記錄: 日期, 術式, 代碼, 單價, 數量, 院區
    const rows = await this.read(this.TABS.codeRecord, 'A2:F500');
    return rows.map((r, i) => ({
      _row: i + 2,
      date: r[0] || '',
      name: r[1] || '',
      code: r[2] || '',
      price: r[3] || '',
      qty: r[4] || '',
      area: r[5] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadEstimate() {
    // 預估: 月份, 預估, 醫材, 中正
    const rows = await this.read(this.TABS.estimate, 'A2:D50');
    return rows.map((r, i) => ({
      _row: i + 2,
      month: r[0] || '',
      estimate: r[1] || '',
      material: r[2] || '',
      zhongzheng: r[3] || ''
    })).sort((a, b) => b.month.localeCompare(a.month));
  },

  async loadClinicProducts() {
    const rows = await this.read(this.TABS.clinicProd, 'A2:C20');
    return rows.map((r, i) => ({
      _row: i + 2,
      itemId: r[0] || '',
      name: r[1] || '',
      price: r[2] || ''
    }));
  },

  async loadClinicRecords() {
    // 門診: 日期, 產品, 數量, 總價
    const rows = await this.read(this.TABS.clinic, 'A2:D500');
    return rows.map((r, i) => ({
      _row: i + 2,
      date: r[0] || '',
      product: r[1] || '',
      qty: r[2] || '',
      total: r[3] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadOpCategories() {
    const rows = await this.read(this.TABS.opCategory, 'A2:B100');
    return rows.map(r => ({ type: r[0] || '', name: r[1] || '' }));
  },

  // ── Writers ──

  async addOpRecord(data) {
    const row = [data.date, data.area, data.name, data.type, data.procedure, data.note];
    return this.append(this.TABS.opRecord, [row]);
  },

  async addMatRecord(data) {
    const row = [data.date, data.brand, data.product, data.qty, data.price];
    return this.append(this.TABS.matRecord, [row]);
  },

  async addCodeRecord(data) {
    const row = [data.date, data.name, data.code, data.price, data.qty, data.area];
    return this.append(this.TABS.codeRecord, [row]);
  },

  async addClinicRecord(data) {
    const row = [data.date, data.product, data.qty, data.total];
    return this.append(this.TABS.clinic, [row]);
  }
};
