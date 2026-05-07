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
    // Read header row first to detect column order
    const headerRow = await this.read(this.TABS.opRecord, 'A1:J1');
    const headers = (headerRow[0] || []).map(h => (h||'').trim());
    
    // Column index map (fallback to position if header not found)
    const col = (names, fallback) => {
      for (const n of names) {
        const i = headers.indexOf(n);
        if (i >= 0) return i;
      }
      return fallback;
    };
    const iDate     = col(['日期'], 0);
    const iArea     = col(['院區'], 1);
    const iName     = col(['姓名'], 2);
    const iType     = col(['類型'], 3);
    const iOpName   = col(['名稱','術式','手術名稱'], 4);
    const iLoc      = col(['部位'], 5);
    const iImplant  = col(['骨材'], 6);
    const iNote     = col(['備註'], 7);

    const rows = await this.read(this.TABS.opRecord, 'A2:J500');
    return rows
      .filter(r => r[iDate] || r[iName]) // skip empty rows
      .map((r, i) => ({
        _row: i + 2,
        date:    r[iDate]    || '',
        area:    r[iArea]    || '',
        name:    r[iName]    || '',
        type:    r[iType]    || '',
        opName:  r[iOpName]  || '',
        location:r[iLoc]     || '',
        implant: r[iImplant] || '',
        note:    r[iNote]    || ''
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
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
    // OP分類: 類型, 名稱
    const rows = await this.read(this.TABS.opCategory, 'A2:B200');
    return rows.map(r => ({ type: r[0] || '', name: r[1] || '' }));
  },

  async loadBoneCategories() {
    // 骨材分類: A=類型, B=骨材 (includes 生長因子 rows)
    const rows = await this.read('骨材分類', 'A2:B200');
    return rows.map(r => ({ type: r[0] || '', bone: r[1] || '' }));
  },

  // Pre-load and cache both category lists for modal use
  async loadAllCategories() {
    const [opCats, boneCats] = await Promise.all([
      this.loadOpCategories(),
      this.loadBoneCategories()
    ]);
    // Separate growth factors (生長因子) to append to every type
    this._growthFactors = boneCats.filter(c => c.type === '生長因子').map(c => c.bone);
    this._opCats = opCats;
    this._boneCats = boneCats.filter(c => c.type !== '生長因子');
    return { opCats, boneCats };
  },

  // ── Writers ──

  async addOpRecord(data) {
    const row = [data.date, data.area, data.name, data.type, data.opName, data.location, data.implant, data.note];
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
