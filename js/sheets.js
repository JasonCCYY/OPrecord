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
    const rows = await this.read(this.T.matRec, 'A2:H500');
    return rows.filter(r => r[0]).map((r, i) => ({
      _row: i + 2, date: r[0] || '', brand: r[1] || '',
      product: r[2] || '', price: r[3] || '', qty: r[4] || '',
      usageId: r[5] || '', done: r[6] || '', todayNew: r[7] || ''
    })).sort((a, b) => b.date.localeCompare(a.date));
  },

  async loadMatProducts() {
    // A=ItemID, B=廠牌, C=產品, D=類型, E=單價, F=醫院
    const rows = await this.read(this.T.matProd, 'A2:F300');
    return rows.filter(r => r[1]).map((r, i) => ({
      _row: i + 2,
      itemId:   r[0] || '',
      brand:    r[1] || '',
      product:  r[2] || '',
      type:     r[3] || '',
      price:    r[4] || '',
      hospital: r[5] || ''
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
    // Read header row to auto-detect columns
    const hRow = await this.read(this.T.codeRec, 'A1:J1');
    const h = (hRow[0] || []).map(x => (x||'').trim());
    const ci = (names, fb) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return fb; };
    const iDate  = ci(['日期'], 0);
    const iName  = ci(['術式','名稱'], 1);
    const iCode  = ci(['代碼'], 2);
    const iPrice = ci(['單價'], 3);
    const iQty   = ci(['數量'], 4);
    const iArea  = ci(['院區'], 5);
    const iToday = ci(['今日新增'], -1);

    const rows = await this.read(this.T.codeRec, 'A2:J500');
    return rows.filter(r => r[iDate]).map((r, i) => ({
      _row: i + 2,
      date:     r[iDate]  || '',
      name:     r[iName]  || '',
      code:     r[iCode]  || '',
      price:    r[iPrice] || '',
      qty:      r[iQty]   || '',
      area:     r[iArea]  || '',
      todayNew: iToday >= 0 ? (r[iToday] || '') : ''
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
    this.opCats = opRows.filter(r => r[0]).map(r => ({ type: (r[0]||'').trim(), name: (r[1]||'').trim() }));
    const allBone = boneRows.filter(r => r[0]).map(r => ({ type: (r[0]||'').trim(), bone: (r[1]||'').trim() }));
    this.growthFactors = allBone.filter(r => r.type === '生長因子').map(r => r.bone);
    this.boneCats = allBone.filter(r => r.type !== '生長因子');
  },

  // ── Writers ──
  async addOp(d)     { return this.append(this.T.op,      [[d.date, d.area, d.name, d.type, d.opName, d.location, d.implant, d.note]]); },
  async updateMatRow(row, d) {
    // Update columns A-E: 日期,廠牌,產品,單價,數量
    const url = `${this.BASE}/${this.ID}/values/${encodeURIComponent(this.T.matRec + '!A' + row + ':E' + row)}?valueInputOption=USER_ENTERED`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...this.hdrs(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[d.date, d.brand, d.product, d.price, d.qty]] })
    });
    if (!r.ok) throw new Error(`更新失敗(${r.status})`);
    return r.json();
  },

  async setDone(row) {
    // Set column G (Done) to true
    const url = `${this.BASE}/${this.ID}/values/${encodeURIComponent(this.T.matRec + '!G' + row)}?valueInputOption=USER_ENTERED`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...this.hdrs(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['true']] })
    });
    if (!r.ok) throw new Error(`標記失敗(${r.status})`);
    return r.json();
  },

  async addMat(d) {
    // A=日期, B=廠牌, C=產品, D=單價, E=數量, F=UsageID, G=Done, H=今日新增
    const usageId = Math.random().toString(36).substring(2, 10);
    const row = [d.date, d.brand, d.product, d.price, d.qty, usageId, 'false', 'TRUE'];
    return this.append(this.T.matRec, [row]);
  },

  // Quick add from 自費醫材 button - matches 骨材記錄 schema
  // A=日期, B=廠牌, C=產品, D=單價, E=數量, F=UsageID, G=Done
  async quickAddMat(brand, product, price, qty) {
    const now = new Date();
    const month = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    const usageId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
    const row = [month, brand, product, price, qty, usageId, 'false'];
    return this.append(this.T.matRec, [row]);
  },
  async addCode(d)   { return this.append(this.T.codeRec, [[d.date, d.name, d.code, d.price, d.qty, d.area]]); },
  async addClinic(d) { return this.append(this.T.clinic,  [[d.date, d.product, d.qty, d.total]]); },
};
