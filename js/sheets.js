// ── Google Sheets API ──
const SHEETS = {
  ID: '1g_nw2_rzJfrzu0KEOPaW3lSDNxxaDweN2FeWzONqCbg',
  BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

  // Sheet tab names (must match your Google Sheet)
  T: {
    op:       '手術',
    matRec:   '骨材記錄',
    matProd:  '骨材產品',
    opCode:   'OP代碼',
    codeRec:  'OP代碼記錄',
    estimate: '預估',
    clinic:   '門診',
    clinicP:  '門診產品',
    opCat:    'OP分類',
    boneCat:  '骨材分類',
  },

  hdrs() { return { Authorization: `Bearer ${AUTH.accessToken}` }; },

  async read(tab, range) {
    const url = `${this.BASE}/${this.ID}/values/${encodeURIComponent(tab + '!' + range)}`;
    const r = await fetch(url, { headers: this.hdrs() });
    if (!r.ok) throw new Error(`讀取失敗(${r.status}): ${tab}`);
    return (await r.json()).values || [];
  },

  async append(tab, rows) {
    const url = `${this.BASE}/${this.ID}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const r = await fetch(url, { method: 'POST', headers: { ...this.hdrs(), 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }) });
    if (!r.ok) throw new Error(`寫入失敗(${r.status}): ${tab}`);
    return r.json();
  },

  // ── Loaders ──

  async loadOpRecords() {
    // Read header first to auto-detect column positions
    const hRow = await this.read(this.T.op, 'A1:K1');
    const h = (hRow[0] || []).map(x => (x || '').trim());
    const ci = (names, fb) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return fb; };
    const iD = ci(['日期'], 0), iA = ci(['院區'], 1), iN = ci(['姓名'], 2),
          iT = ci(['類型'], 3), iON = ci(['名稱', '術式', '手術名稱'], 4),
          iL = ci(['部位'], 5), iI = ci(['骨材'], 6), iNt = ci(['備註'], 7);

    const rows = await this.read(this.T.op, 'A2:K500');
    return rows
      .filter(r => r[iD] || r[iN])
      .map((r, i) => ({
        _row: i + 2,
        date: r[iD] || '', area: r[iA] || '', name: r[iN] || '',
        type: r[iT] || '', opName: r[iON] || '', location: r[iL] || '',
        implant: r[iI] || '', note: r[iNt] || ''
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadMatRecords() {
    const rows = await this.read(this.T.matRec, 'A2:E500');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, date: r[0] || '', brand: r[1] || '',
      product: r[2] || '', qty: r[3] || '', price: r[4] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadMatProducts() {
    const rows = await this.read(this.T.matProd, 'A2:D200');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, brand: r[0] || '', product: r[1] || '',
      price: r[2] || '', hospital: r[3] || ''
    }));
  },

  async loadOpCodes() {
    const rows = await this.read(this.T.opCode, 'A2:D200');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, code: r[0] || '', name: r[1] || '',
      area: r[2] || '', price: r[3] || ''
    }));
  },

  async loadCodeRecords() {
    const rows = await this.read(this.T.codeRec, 'A2:F500');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, date: r[0] || '', name: r[1] || '', code: r[2] || '',
      price: r[3] || '', qty: r[4] || '', area: r[5] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadEstimate() {
    const rows = await this.read(this.T.estimate, 'A2:D50');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, month: r[0] || '', estimate: r[1] || '',
      material: r[2] || '', zhongzheng: r[3] || ''
    })).sort((a, b) => b.month.localeCompare(a.month));
  },

  async loadClinicProducts() {
    const rows = await this.read(this.T.clinicP, 'A2:C20');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, itemId: r[0] || '', name: r[1] || '', price: r[2] || ''
    }));
  },

  async loadClinicRecords() {
    const rows = await this.read(this.T.clinic, 'A2:D500');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, date: r[0] || '', product: r[1] || '',
      qty: r[2] || '', total: r[3] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadCategories() {
    const [opRows, boneRows] = await Promise.all([
      this.read(this.T.opCat, 'A2:B200'),
      this.read(this.T.boneCat, 'A2:B200')
    ]);
    this.opCats = opRows.filter(r => r[0]).map(r => ({ type: r[0] || '', name: r[1] || '' }));
    const allBone = boneRows.filter(r => r[0]).map(r => ({ type: r[0] || '', bone: r[1] || '' }));
    this.growthFactors = allBone.filter(r => r.type === '生長因子').map(r => r.bone);
    this.boneCats = allBone.filter(r => r.type !== '生長因子');
  },

  // ── Writers ──
  async addOp(d)     { return this.append(this.T.op,      [[d.date, d.area, d.name, d.type, d.opName, d.location, d.implant, d.note]]); },
  async addMat(d)    { return this.append(this.T.matRec,  [[d.date, d.brand, d.product, d.qty, d.price]]); },
  async addCode(d)   { return this.append(this.T.codeRec, [[d.date, d.name, d.code, d.price, d.qty, d.area]]); },
  async addClinic(d) { return this.append(this.T.clinic,  [[d.date, d.product, d.qty, d.total]]); },
};
