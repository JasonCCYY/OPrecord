// ── Ortho Record App ──
const APP = {
  tab: 'surgery',
  subMat: 'matRec',
  subCli: 'cliPrice',

  async init() {
    this.showLoad(true);
    await AUTH.init();
    this.bindTabs();
    this.bindSubTabs();
    document.getElementById('fab').addEventListener('click', () => this.fabClick());
    this.showLoad(false);
    if (!AUTH.ok) this.showAuth();
  },

  showLoad(v) { document.getElementById('loading').style.display = v ? 'flex' : 'none'; },
  showAuth()  { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app').style.display = 'none'; },

  onAuthSuccess() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    const now = new Date();
    document.getElementById('hdr-month').textContent = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    // Pre-load categories quietly
    SHEETS.loadCategories().catch(e => console.warn('Category load:', e));
    this.switchTab('surgery');
  },

  today() {
    const n = new Date();
    return `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')}`;
  },
  todayISO() { return new Date().toISOString().split('T')[0]; },

  // ── Tabs ──
  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
  },

  switchTab(tab) {
    this.tab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('hdr-title').textContent = { surgery: '手術紀錄', material: '醫材管理', clinic: '門診' }[tab];
    document.getElementById('sub-mat').style.display = tab === 'material' ? 'flex' : 'none';
    document.getElementById('sub-cli').style.display = tab === 'clinic'   ? 'flex' : 'none';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    if (tab === 'surgery')  { document.getElementById('pg-surgery').classList.add('active');  this.loadSurgery(); }
    else if (tab === 'material') this.switchMat(this.subMat);
    else if (tab === 'clinic')   this.switchCli(this.subCli);

    document.getElementById('fab').style.display = 'flex';
  },

  bindSubTabs() {
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.addEventListener('click', () => this.switchMat(b.dataset.sub)));
    document.querySelectorAll('#sub-cli .sub-tab').forEach(b => b.addEventListener('click', () => this.switchCli(b.dataset.sub)));
  },

  switchMat(sub) {
    this.subMat = sub;
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const map = { matRec: 'pg-mat-rec', selfPay: 'pg-selfpay', opCode: 'pg-opcode', codeRec: 'pg-code-rec', estimate: 'pg-estimate' };
    document.getElementById(map[sub])?.classList.add('active');
    const load = { matRec: ()=>this.loadMatRec(), selfPay: ()=>this.loadSelfPay(), opCode: ()=>this.loadOpCode(), codeRec: ()=>this.loadCodeRec(), estimate: ()=>this.loadEstimate() };
    load[sub]?.();
  },

  switchCli(sub) {
    this.subCli = sub;
    document.querySelectorAll('#sub-cli .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (sub === 'cliPrice') { document.getElementById('pg-cli-price').classList.add('active'); this.loadCliPrice(); }
    else                    { document.getElementById('pg-cli-rec').classList.add('active');   this.loadCliRec(); }
  },

  fabClick() {
    if (this.tab === 'surgery')  this.openModal('modal-op');
    else if (this.tab === 'material') {
      if (this.subMat === 'matRec')  this.openModal('modal-mat');
      else if (this.subMat === 'codeRec') this.openModal('modal-code');
    } else if (this.tab === 'clinic') this.openModal('modal-cli');
  },

  // ── Surgery ──
  async loadSurgery() {
    const wrap = document.getElementById('sx-list');
    wrap.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadOpRecords();
      if (!recs.length) { wrap.innerHTML = this.empty(); return; }
      let html = '<div class="sx-wrap"><table class="sx-table"><thead><tr><th>日期</th><th>院區</th><th>姓名</th><th>類型</th><th>名稱</th><th>部位</th><th>骨材</th><th>備註</th></tr></thead><tbody>';
      let lastM = '';
      recs.forEach(r => {
        const m = r.date.substring(0, 7);
        if (m !== lastM) {
          lastM = m;
          const cnt = recs.filter(x => x.date.startsWith(m)).length;
          html += `<tr class="sx-mrow"><td colspan="8"><span class="month-hdr" style="padding:0">${m} <span class="month-badge">${cnt}</span></span></td></tr>`;
        }
        const day = r.date.substring(5);
        html += `<tr class="sx-row">
          <td class="sx-date">${day}</td>
          <td class="sx-area">${r.area}</td>
          <td class="sx-name">${r.name}</td>
          <td><span class="badge badge-${r.type}">${r.type}</span></td>
          <td class="sx-opname">${r.opName}</td>
          <td class="sx-loc">${r.location}</td>
          <td class="sx-implant">${r.implant}</td>
          <td class="sx-note">${r.note}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      wrap.innerHTML = html;
    } catch(e) { wrap.innerHTML = this.err(e); }
  },

  // ── Material Record ──
  async loadMatRec() {
    const el = document.getElementById('mat-rec-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadMatRecords();
      if (!recs.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      const groups = this.groupByMonth(recs);
      groups.forEach(([m, rows]) => {
        const total = rows.reduce((s, r) => s + (parseFloat(r.price) * parseInt(r.qty || 1) || 0), 0);
        html += `<div class="month-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        const sorted = [...rows].sort((a, b) => APP.sortBrands(a.brand||'', b.brand||''));
        sorted.forEach((r, ri) => {
          const isNew = r.todayNew && r.todayNew.toString().toUpperCase() === 'TRUE';
          const isDone = r.done && r.done.toString().toLowerCase() === 'true';
          const rowCls = isNew ? 'item-row item-row--new' : 'item-row';
          const dot = isNew ? '<span class="new-dot" title="今日新增"></span>' : '<span class="new-dot-ph"></span>';
          const cleanP = parseFloat(String(r.price).replace(/,/g,'')) || 0;
          const subtotal = cleanP && r.qty && parseInt(r.qty) > 1
            ? '<span class="item-subtotal">✕' + parseInt(r.qty) + ' =' + (cleanP*parseInt(r.qty)).toLocaleString() + '</span>'
            : '';
          const doneBtn = !isDone
            ? `<button class="done-btn" onclick="event.stopPropagation();APP.markDone(${r._row})" title="標記完成">☑</button>`
            : '<span style="width:32px;flex-shrink:0"></span>';
          const rowData = encodeURIComponent(JSON.stringify({_row:r._row,brand:r.brand,product:r.product,date:r.date,price:r.price,qty:r.qty,done:r.done,todayNew:r.todayNew}));
          html += `<div class="${rowCls}" onclick="APP.openMatDetail('${rowData}')">
            ${dot}
            <div class="item-brand">${r.brand}</div>
            <div class="item-product">${r.product}${subtotal}</div>
            <div class="item-qty">${r.qty}</div>
            <div class="item-price">${cleanP ? '$'+cleanP.toLocaleString() : ''}</div>
            ${doneBtn}
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Self-pay Products ──
  async loadSelfPay() {
    const el = document.getElementById('selfpay-list');
    el.innerHTML = this.loading();
    try {
      const items = await SHEETS.loadMatProducts();
      if (!items.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      // Group by brand, sorted alphabetically
      const groups = {};
      items.forEach(r => { (groups[r.brand] = groups[r.brand] || []).push(r); });
      Object.entries(groups).sort((a,b) => APP.sortBrands(a[0],b[0])).forEach(([brand, rows]) => {
        html += `<div class="month-hdr">${brand} <span class="month-badge">${rows.length}</span></div>`;
        rows.forEach(r => {
          const priceStr = r.price ? Number(String(r.price).replace(/,/g,"")).toLocaleString() : '-';
          const safeB = (r.brand||'').replace(/'/g,"\'");
          const safeP = (r.product||'').replace(/'/g,"\'");
          const safePrice = r.price || '';
          html += `<div class="item-row">
            <div class="item-brand">${r.brand}</div>
            <div class="item-product">${r.product}${r.type ? '<br><span style="font-size:.7rem;color:var(--muted)">' + r.type + '</span>' : ''}</div>
            <div class="item-price">$${priceStr}</div>
            <div style="width:40px;text-align:right;font-size:.72rem;color:var(--muted)">${r.hospital}</div>
            <button class="quick-add-btn" onclick="APP.quickAddMat('${safeB}','${safeP}','${safePrice}')" title="新增到骨材記錄">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── OP Codes ──
  async loadOpCode() {
    const el = document.getElementById('opcode-list');
    el.innerHTML = this.loading();
    try {
      const items = await SHEETS.loadOpCodes();
      if (!items.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      const groups = {};
      items.forEach(r => { (groups[r.area || '通用'] = groups[r.area || '通用'] || []).push(r); });
      Object.entries(groups).forEach(([area, rows]) => {
        html += `<div class="month-hdr">${area}</div>`;
        rows.forEach(r => {
          html += `<div class="item-row">
            <div class="item-brand" style="font-family:'JetBrains Mono',monospace;font-size:.76rem">${r.code}</div>
            <div class="item-product">${r.name}</div>
            <div class="item-price">$${Number(String(r.price).replace(/,/g,"")).toLocaleString()}</div>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Code Records ──
  async loadCodeRec() {
    const el = document.getElementById('code-rec-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadCodeRecords();
      if (!recs.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      const groups = this.groupByMonth(recs);
      groups.forEach(([m, rows]) => {
        // Fix: price * qty for total
        const total = rows.reduce((s, r) => {
          const p = parseFloat(String(r.price).replace(/,/g,'')) || 0;
          const q = parseInt(r.qty) || 1;
          return s + p * q;
        }, 0);
        html += `<div class="month-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          const isNew = r.todayNew && r.todayNew.toString().toUpperCase() === 'TRUE';
          const cleanP = parseFloat(String(r.price).replace(/,/g,'')) || 0;
          const dot = isNew ? '<span class="new-dot" title="今日新增"></span>' : '<span class="new-dot-ph"></span>';
          const rowCls = isNew ? 'code-row code-row--new' : 'code-row';
          html += `<div class="${rowCls}">
            ${dot}
            <div class="code-name">${r.name}</div>
            <div class="code-id">${r.code}</div>
            <div class="code-price">${cleanP ? '$'+cleanP.toLocaleString() : ''}</div>
            <div class="code-qty">${r.qty}</div>
            <div class="code-area">${r.area}</div>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Estimate ──
  async loadEstimate() {
    const el = document.getElementById('estimate-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadEstimate();
      if (!recs.length) { el.innerHTML = this.empty(); return; }
      el.innerHTML = recs.map(r => `<div class="est-row">
        <div class="est-month">${r.month}</div>
        <div class="est-total">${r.estimate ? Number(String(r.estimate).replace(/,/g,"")).toLocaleString() : '-'}</div>
        <div class="est-val">${r.material ? Number(String(r.material).replace(/,/g,"")).toLocaleString() : '-'}</div>
        <div class="est-val">${r.zhongzheng ? Number(String(r.zhongzheng).replace(/,/g,"")).toLocaleString() : '-'}</div>
      </div>`).join('');
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Clinic Price ──
  async loadCliPrice() {
    const el = document.getElementById('cli-price-list');
    el.innerHTML = this.loading();
    try {
      const items = await SHEETS.loadClinicProducts();
      this._clinicProds = items;
      if (!items.length) { el.innerHTML = this.empty(); return; }
      el.innerHTML = items.map(r => `<div class="clinic-item">
        <div class="clinic-name">${r.name}</div>
        <div class="clinic-price">${r.price ? '$'+Number(String(r.price).replace(/,/g,"")).toLocaleString() : '免費'}</div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>`).join('');
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Clinic Records ──
  async loadCliRec() {
    const el = document.getElementById('cli-rec-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadClinicRecords();
      if (!recs.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      const groups = this.groupByMonth(recs);
      groups.forEach(([m, rows]) => {
        const total = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        html += `<div class="month-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          html += `<div class="item-row">
            <div class="item-brand" style="width:44px;font-size:.74rem">${r.date.substring(5)}</div>
            <div class="item-product">${r.product}</div>
            <div class="item-qty">${r.qty}</div>
            <div class="item-price">${r.total ? '$'+Number(String(r.total).replace(/,/g,"")).toLocaleString() : ''}</div>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Helpers ──
  groupByMonth(recs) {
    const map = {};
    recs.forEach(r => { const m = r.date.substring(0, 7); (map[m] = map[m] || []).push(r); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  },
  loading() { return '<div style="padding:24px;text-align:center;color:var(--muted);font-size:.85rem">載入中...</div>'; },
  empty()   { return '<div class="empty"><div class="empty-icon">📋</div><div class="empty-txt">尚無紀錄</div></div>'; },
  err(e)    { return `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-txt">${e.message}</div></div>`; },

  // ── Modals ──
  openModal(id) {
    document.getElementById(id).classList.add('open');
    // Reset date fields to today
    document.querySelectorAll(`#${id} input[type="date"]`).forEach(el => el.value = this.todayISO());
  },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── Surgery Modal Logic ──
  selectArea(el, v) {
    document.querySelectorAll('.area-chip').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    document.getElementById('s-area-val').value = v;
  },

  selectType(el, type) {
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    document.getElementById('s-type-val').value = type;
    this.updateOpDropdowns(type.trim());
  },

  updateOpDropdowns(type) {
    // OP Name select
    const sel = document.getElementById('s-opname');
    const type2 = type.trim();
    const names = (SHEETS.opCats || []).filter(c => c.type.trim() === type2).map(c => c.name);
    sel.innerHTML = '<option value="">選擇手術名稱</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');

    // Bone checkboxes
    const wrap = document.getElementById('s-bone-wrap');
    const mainBones = (SHEETS.boneCats || []).filter(c => c.type.trim() === type2).map(c => c.bone);
    const growth = (SHEETS.growthFactors && SHEETS.growthFactors.length)
      ? SHEETS.growthFactors
      : ['漢森柏0.5', 'PRP 15K', 'PRP 36K', '羊膜22S', '瑟若美'];

    let html = mainBones.map(b => `<label class="bone-chip"><input type="checkbox" value="${b}" onchange="APP.updateBoneVal()"><span>${b}</span></label>`).join('');
    html += `<div class="bone-section">生長因子</div>`;
    html += growth.map(b => `<label class="bone-chip"><input type="checkbox" value="${b}" onchange="APP.updateBoneVal()"><span>${b}</span></label>`).join('');
    wrap.innerHTML = html;
    this.updateBoneVal();
  },

  updateBoneVal() {
    const vals = [...document.querySelectorAll('#s-bone-wrap input:checked')].map(c => c.value);
    document.getElementById('s-bone-val').value = vals.join(' , ');
  },

  // Clinic auto-calc
  calcClinicTotal() {
    const prod = document.getElementById('cl-product').value;
    const qty  = parseInt(document.getElementById('cl-qty').value) || 1;
    const found = (this._clinicProds || []).find(p => p.name === prod);
    if (found) document.getElementById('cl-total').value = (parseFloat(found.price) * qty) || 0;
  },

  // ── Save handlers ──
  async saveOp() {
    const d = {
      date:     document.getElementById('s-date').value.replace(/-/g, '/'),
      area:     document.getElementById('s-area-val').value,
      name:     document.getElementById('s-name').value.trim(),
      type:     document.getElementById('s-type-val').value,
      opName:   document.getElementById('s-opname').value,
      location: document.getElementById('s-location').value.trim(),
      implant:  document.getElementById('s-bone-val').value,
      note:     document.getElementById('s-note').value.trim(),
    };
    if (!d.date || !d.name) { this.toast('請填入日期和姓名'); return; }
    try { await SHEETS.addOp(d); this.closeModal('modal-op'); this.toast('✅ 手術紀錄已儲存'); this.loadSurgery(); }
    catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveMat() {
    const d = {
      date:    document.getElementById('m-date').value.replace(/-/g, '/'),
      brand:   document.getElementById('m-brand').value.trim(),
      product: document.getElementById('m-product').value.trim(),
      qty:     document.getElementById('m-qty').value,
      price:   document.getElementById('m-price').value,
    };
    if (!d.date || !d.product) { this.toast('請填入日期和產品'); return; }
    try { await SHEETS.addMat(d); this.closeModal('modal-mat'); this.toast('✅ 醫材紀錄已儲存'); this.loadMatRec(); }
    catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveCode() {
    const d = {
      date:  document.getElementById('c-date').value.replace(/-/g, '/'),
      name:  document.getElementById('c-name').value.trim(),
      code:  document.getElementById('c-code').value.trim(),
      price: document.getElementById('c-price').value,
      qty:   document.getElementById('c-qty').value,
      area:  document.getElementById('c-area-val').value,
    };
    if (!d.date || !d.code) { this.toast('請填入日期和代碼'); return; }
    try { await SHEETS.addCode(d); this.closeModal('modal-code'); this.toast('✅ 代碼紀錄已儲存'); this.loadCodeRec(); }
    catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveCli() {
    const d = {
      date:    document.getElementById('cl-date').value.replace(/-/g, '/'),
      product: document.getElementById('cl-product').value,
      qty:     document.getElementById('cl-qty').value,
      total:   document.getElementById('cl-total').value,
    };
    if (!d.date || !d.product) { this.toast('請填入日期和產品'); return; }
    try { await SHEETS.addClinic(d); this.closeModal('modal-cli'); this.toast('✅ 門診紀錄已儲存'); this.loadCliRec(); }
    catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  // ── Mat Record Detail + Edit ──
  openMatDetail(encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._editRow = r._row;
    this._editData = r;
    const cleanP = parseFloat(String(r.price||0).replace(/,/g,'')) || 0;
    const total = cleanP * (parseInt(r.qty) || 1);
    document.getElementById('md-brand').textContent   = r.brand;
    document.getElementById('md-product').textContent = r.product;
    document.getElementById('md-date').textContent    = r.date;
    document.getElementById('md-price').textContent   = cleanP ? '$' + cleanP.toLocaleString() : '-';
    document.getElementById('md-qty').textContent     = r.qty;
    document.getElementById('md-total').textContent   = total ? '$' + total.toLocaleString() : '-';
    document.getElementById('md-view').style.display  = '';
    document.getElementById('md-edit').style.display  = 'none';
    this.openModal('modal-mat-detail');
  },

  openMatEdit() {
    const r = this._editData;
    document.getElementById('me-brand').value   = r.brand;
    document.getElementById('me-product').value = r.product;
    document.getElementById('me-date').value    = r.date;
    document.getElementById('me-price').value   = String(r.price||'').replace(/,/g,'');
    document.getElementById('me-qty').value     = r.qty || 1;
    document.getElementById('md-view').style.display = 'none';
    document.getElementById('md-edit').style.display = '';
  },

  closeMatEdit() {
    document.getElementById('md-view').style.display = '';
    document.getElementById('md-edit').style.display = 'none';
  },

  async saveMatEdit() {
    const d = {
      brand:   document.getElementById('me-brand').value.trim(),
      product: document.getElementById('me-product').value.trim(),
      date:    document.getElementById('me-date').value.trim(),
      price:   document.getElementById('me-price').value,
      qty:     document.getElementById('me-qty').value,
    };
    try {
      await SHEETS.updateMatRow(this._editRow, d);
      this.closeModal('modal-mat-detail');
      this.toast('✅ 已更新');
      this.loadMatRec();
    } catch(e) { this.toast('❌ 更新失敗: ' + e.message); }
  },

  async markDone(row) {
    try {
      await SHEETS.setDone(row);
      this.toast('✅ 已標記完成');
      this.loadMatRec();
    } catch(e) { this.toast('❌ 失敗: ' + e.message); }
  },

  // ── Quick Add Mat from selfpay button (direct, no confirm) ──
  async quickAddMat(brand, product, price) {
    const now = new Date();
    const date = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    // Clean price: remove commas and non-numeric chars
    const cleanPrice = String(price).replace(/,/g, '').trim();
    try {
      await SHEETS.addMat({ date, brand, product, price: cleanPrice, qty: '1' });
      this.toast(`✅ 已新增 ${product}`);
    } catch(e) { this.toast('❌ 新增失敗: ' + e.message); }
  },

  // ── Sort: English brands first, then Chinese ──
  sortBrands(a, b) {
    const isEngA = /^[A-Za-z0-9]/.test(a);
    const isEngB = /^[A-Za-z0-9]/.test(b);
    if (isEngA && !isEngB) return -1;  // A is English, B is Chinese → A first
    if (!isEngA && isEngB) return 1;   // A is Chinese, B is English → B first
    return a.localeCompare(b, 'zh-TW'); // Same type → alphabetical
  },

  // ── Toast ──
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  },

  // ── Refresh ──
  refresh() {
    if (this.tab === 'surgery') this.loadSurgery();
    else if (this.tab === 'material') this.switchMat(this.subMat);
    else this.switchCli(this.subCli);
    this.toast('🔄 重新載入');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  APP.init();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
});
