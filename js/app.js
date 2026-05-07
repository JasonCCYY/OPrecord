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

    document.getElementById('fab').style.display = this.tab === 'surgery' ? 'flex' : 'none';
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

      // Normalize month: ensure YYYY/MM format
      const getMonth = d => {
        const p = d.split('/');
        if(p.length>=2) return p[0]+'/'+p[1].padStart(2,'0');
        return d.substring(0,7);
      };

      // Sort: by month desc, then 中正 before 右昌, then date desc
      const sorted = [...recs].sort((a,b) => {
        const ma = getMonth(a.date), mb = getMonth(b.date);
        if(ma !== mb) return mb.localeCompare(ma);
        const aZ = a.area==='中正'?0:a.area==='右昌'?1:2;
        const bZ = b.area==='中正'?0:b.area==='右昌'?1:2;
        if(aZ !== bZ) return aZ-bZ;
        return b.date.localeCompare(a.date);
      });

      let html = '<div class="sx-wrap"><table class="sx-table"><thead><tr><th>日期</th><th>院區</th><th>姓名</th><th>類型</th><th>名稱</th><th>部位</th><th>骨材</th><th>備註</th></tr></thead><tbody>';
      let lastM = '';
      sorted.forEach(r => {
        const m = getMonth(r.date);
        if (m !== lastM) {
          lastM = m;
          const monthRecs = sorted.filter(x => getMonth(x.date) === m);
          const zhCnt = monthRecs.filter(x=>x.area==='中正').length;
          const ycCnt = monthRecs.filter(x=>x.area==='右昌').length;
          const cntLabel = monthRecs.length + `（${zhCnt}/${ycCnt}）`;
          html += `<tr class="sx-mrow"><td colspan="8"><span style="display:flex;align-items:center;gap:8px;padding:0">${m} <span class="month-badge">${cntLabel}</span></span></td></tr>`;
        }
        // Show day portion cleanly
        const parts = r.date.split('/');
        const day = parts.length>=3 ? parts[1].padStart(2,'0')+'/'+parts[2].padStart(2,'0') : r.date.substring(5);
        const rowData = encodeURIComponent(JSON.stringify({_row:r._row,date:r.date,area:r.area,name:r.name,type:r.type,opName:r.opName,location:r.location,implant:r.implant,note:r.note}));
        html += `<tr class="sx-row swipeable-tr" data-sx="${rowData}">
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

      // Click to open detail
      wrap.querySelectorAll('.swipeable-tr').forEach(tr => {
        tr.addEventListener('click', () => APP.openSurgeryDetail(tr.getAttribute('data-sx')));
      });
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
        const sorted = [...rows].sort((a, b) => {
          const aN = a.todayNew&&a.todayNew.toString().toUpperCase()==='TRUE';
          const bN = b.todayNew&&b.todayNew.toString().toUpperCase()==='TRUE';
          if(aN&&!bN) return -1; if(!aN&&bN) return 1;
          return APP.sortBrands(a.brand||'',b.brand||'');
        });
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
          html += `<div class="${rowCls} swipeable" data-mat='${rowData}'>
            <div class="swipe-content" style="gap:10px">
              ${dot}
              <div class="item-brand">${r.brand}</div>
              <div class="item-product">${r.product}${subtotal}</div>
              <div class="item-qty">${r.qty}</div>
              <div class="item-price">${cleanP ? '$'+cleanP.toLocaleString() : ''}</div>
              ${doneBtn}
            </div>
            <div class="swipe-delete" onclick="event.stopPropagation();APP.deleteMatRow(${r._row})">刪除</div>
          </div>`;
        });
      });
      el.innerHTML = html;
      // Use event delegation for mobile touch compatibility
      this.initSwipe(el, '.swipeable', row => {
        if(row.getAttribute('data-mat')) APP.openMatDetail(row.getAttribute('data-mat'));
      });
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
        html += `<div class="month-hdr">${brand}</div>`;
        rows.forEach(r => {
          const cleanP = String(r.price||'').replace(/,/g,'').trim();
          const priceStr = cleanP ? Number(cleanP).toLocaleString() : '-';
          const rowData = encodeURIComponent(JSON.stringify({_row:r._row,brand:r.brand,product:r.product,type:r.type,price:r.price,hospital:r.hospital}));
          const safeB = (r.brand||'').replace(/'/g,"\'");
          const safeP2 = (r.product||'').replace(/'/g,"\'");
          html += `<div class="item-row swipeable" data-selfpay="${rowData}">
            <div class="swipe-content">
              <div class="item-brand">${r.brand}</div>
              <div class="item-product">${r.product}</div>
              <div class="item-price">$${priceStr}</div>
              <div style="width:36px;text-align:right;font-size:.72rem;color:var(--muted);flex-shrink:0">${r.hospital}</div>
              <button class="scalpel-btn" onclick="event.stopPropagation();APP.quickAddMat('${safeB}','${safeP2}','${cleanP}')" title="新增到骨材記錄">＋</button>
            </div>
            <div class="swipe-delete" onclick="event.stopPropagation();APP.deleteSelfPay(${r._row})">刪除</div>
          </div>`;
        });
      });
      el.innerHTML = html;
      this.initSwipe(el, '.swipeable', row => APP.openSelfPayDetail(row.getAttribute('data-selfpay')));
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
      // Group by area, 中正 first then 右昌 then others
      const areaOrder = ['中正','右昌'];
      const groups = {};
      items.forEach(r => { const a = r.area||'通用'; (groups[a]=groups[a]||[]).push(r); });
      const sortedAreas = Object.keys(groups).sort((a,b) => {
        const ai = areaOrder.indexOf(a), bi = areaOrder.indexOf(b);
        if(ai>=0 && bi>=0) return ai-bi;
        if(ai>=0) return -1; if(bi>=0) return 1;
        return a.localeCompare(b,'zh-TW');
      });
      sortedAreas.forEach(area => {
        const rows = groups[area].sort((a,b) => parseInt(a.code||0) - parseInt(b.code||0));
        html += `<div class="month-hdr">${area}</div>`;
        rows.forEach(r => {
          const cleanP = parseFloat(String(r.price).replace(/,/g,''))||0;
          const safeN = r.name.replace(/'/g,"\'"), safeC = r.code.replace(/'/g,"\'");
          const safeP = String(r.price).replace(/,/g,''), safeA = r.area.replace(/'/g,"\'");
          const ocData = encodeURIComponent(JSON.stringify({_row:r._row,code:r.code,name:r.name,price:r.price,area:r.area}));
          html += `<div class="item-row swipeable" data-opcode="${ocData}">
            <div class="swipe-content">
              <div class="item-brand" style="font-family:'JetBrains Mono',monospace;font-size:.76rem;width:52px">${r.code}</div>
              <div class="item-product">${r.name}</div>
              <div class="item-price">${cleanP?'$'+cleanP.toLocaleString():''}</div>
              <button class="scalpel-btn" onclick="event.stopPropagation();APP.quickAddCode('${safeN}','${safeC}','${safeP}','${safeA}')" title="新增到代碼紀錄">＋</button>
            </div>
            <div class="swipe-delete" onclick="event.stopPropagation();APP.deleteOpCode(${r._row})">刪除</div>
          </div>`;
        });
      });
      el.innerHTML = html;
      this.initSwipe(el, '.swipeable', r => APP.openOpCodeDetail(r.getAttribute('data-opcode')));
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
        // Sort: today-new first, then 中正>右昌, then English>Chinese
        const areaOrd = ['中正','右昌'];
        const sortedRows = [...rows].sort((a,b) => {
          const aN = a.todayNew&&a.todayNew.toString().toUpperCase()==='TRUE';
          const bN = b.todayNew&&b.todayNew.toString().toUpperCase()==='TRUE';
          if(aN&&!bN) return -1; if(!aN&&bN) return 1;
          const ai=areaOrd.indexOf(a.area), bi=areaOrd.indexOf(b.area);
          if(ai>=0&&bi>=0&&ai!==bi) return ai-bi;
          return parseInt(a.code||0) - parseInt(b.code||0);
        });
        sortedRows.forEach(r => {
          const isNew = r.todayNew && r.todayNew.toString().toUpperCase() === 'TRUE';
          const cleanP = parseFloat(String(r.price).replace(/,/g,'')) || 0;
          const dot = isNew ? '<span class="new-dot" title="今日新增"></span>' : '<span class="new-dot-ph"></span>';
          const rowCls = isNew ? 'code-row code-row--new' : 'code-row';
          const crData = encodeURIComponent(JSON.stringify({_row:r._row,date:r.date,name:r.name,code:r.code,price:r.price,qty:r.qty,area:r.area}));
          html += `<div class="${rowCls} swipeable" data-cr="${crData}">
            <div class="swipe-content" style="gap:6px;padding:12px 16px">
              ${dot}
              <div class="code-name">${r.name}</div>
              <div class="code-id">${r.code}</div>
              <div class="code-price">${cleanP ? '$'+cleanP.toLocaleString() : ''}</div>
              <div class="code-qty">${r.qty}</div>
              <div class="code-area">${r.area}</div>
            </div>
            <div class="swipe-delete" onclick="event.stopPropagation();APP.deleteCodeRec(${r._row})">刪除</div>
          </div>`;
        });
      });
      el.innerHTML = html;
      this.initSwipe(el, '.swipeable', () => {});
    } catch(e) { el.innerHTML = this.err(e); }
  },

  async deleteCodeRec(row) {
    if(!confirm('確定刪除？')) return;
    try {
      await SHEETS.clearRow(SHEETS.T.codeRec, row, 'A', 'H');
      this.toast('🗑 已刪除'); this.loadCodeRec();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
  },

  // ── Estimate ──
  async loadEstimate() {
    const el = document.getElementById('estimate-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadEstimate();
      if (!recs.length) { el.innerHTML = this.empty(); return; }
      const fmt = v => v ? Number(String(v).replace(/,/g,'')).toLocaleString() : '-';
      el.innerHTML = recs.map(r => `<div class="est-row">
        <div class="est-month">${r.month}</div>
        <div class="est-total">${fmt(r.estimate)}</div>
        <div class="est-val">${fmt(r.material)}</div>
        <div class="est-val">${fmt(r.clinic)}</div>
        <div class="est-val">${fmt(r.zhongzheng)}</div>
        <div class="est-val">${fmt(r.youchang)}</div>
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
          html += `<div class="item-row swipeable">
            <div class="swipe-content" style="gap:10px">
              <div class="item-brand" style="width:44px;font-size:.74rem">${r.date.substring(5)}</div>
              <div class="item-product">${r.product}</div>
              <div class="item-qty">${r.qty}</div>
              <div class="item-price">${r.total ? '$'+Number(String(r.total).replace(/,/g,"")).toLocaleString() : ''}</div>
            </div>
            <div class="swipe-delete" onclick="event.stopPropagation();APP.deleteCliRec(${r._row})">刪除</div>
          </div>`;
        });
      });
      el.innerHTML = html;
      this.initSwipe(el, '.swipeable', () => {});
    } catch(e) { el.innerHTML = this.err(e); }
  },

  async deleteCliRec(row) {
    if(!confirm('確定刪除？')) return;
    try {
      await SHEETS.clearRow(SHEETS.T.clinic, row, 'A', 'D');
      this.toast('🗑 已刪除'); this.loadCliRec();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
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
    // Set Done toggle
    const isDone = r.done && r.done.toString().toLowerCase() === 'true';
    document.getElementById('me-done-y').classList.toggle('on', isDone);
    document.getElementById('me-done-n').classList.toggle('on', !isDone);
    document.getElementById('me-done-val').value = isDone ? 'true' : 'false';
    document.getElementById('md-view').style.display = 'none';
    document.getElementById('md-edit').style.display = '';
  },

  toggleDone(val) {
    document.getElementById('me-done-val').value = val;
    document.getElementById('me-done-y').classList.toggle('on', val === 'true');
    document.getElementById('me-done-n').classList.toggle('on', val === 'false');
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
      done:    document.getElementById('me-done-val').value,
    };
    try {
      await SHEETS.updateMatRow(this._editRow, d);
      this.closeModal('modal-mat-detail');
      this.toast('✅ 已更新');
      this.loadMatRec();
    } catch(e) { this.toast('❌ 更新失敗: ' + e.message); }
  },

  async deleteMatRow() {
    if (!confirm('確定刪除這筆紀錄？')) return;
    try {
      await SHEETS.deleteMatRow(this._editRow);
      this.closeModal('modal-mat-detail');
      this.toast('🗑 已刪除');
      this.loadMatRec();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
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

  // ── Swipe-to-delete (touch + mouse) ──
  initSwipe(container, selector, onTap) {
    container.querySelectorAll(selector).forEach(el => {
      let startX = 0, startY = 0, dx = 0, swiped = false;
      const content = el.querySelector('.swipe-content');
      const del = el.querySelector('.swipe-delete');

      const onStart = e => {
        startX = (e.touches?.[0]||e).clientX;
        startY = (e.touches?.[0]||e).clientY;
        dx = 0; swiped = false;
        content.style.transition = 'none';
      };
      const onMove = e => {
        dx = (e.touches?.[0]||e).clientX - startX;
        const dy = Math.abs((e.touches?.[0]||e).clientY - startY);
        if(dy > 10 && Math.abs(dx) < dy) return;
        if(dx < 0) {
          content.style.transform = `translateX(${Math.max(dx,-80)}px)`;
          e.preventDefault();
        }
      };
      const onEnd = () => {
        content.style.transition = 'transform 0.2s';
        if(dx < -40) {
          content.style.transform = 'translateX(-80px)';
          del.style.width = '80px';
          swiped = true;
        } else {
          content.style.transform = '';
          del.style.width = '0';
          swiped = false;
        }
      };
      el.addEventListener('touchstart', onStart, {passive:true});
      el.addEventListener('touchmove', onMove, {passive:false});
      el.addEventListener('touchend', onEnd);
      el.addEventListener('mousedown', onStart);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseup', onEnd);

      el.addEventListener('click', e => {
        if(swiped) { e.stopPropagation(); return; }
        if(e.target.closest('.scalpel-btn,.swipe-delete')) return;
        onTap(el);
      });
    });
  },

  // ── OP Code detail + quick add ──
  quickAddCode(name, code, price, area) {
    SHEETS.quickAddCode({name, code, price, area})
      .then(() => this.toast(`✅ 已新增 ${name}`))
      .catch(e => this.toast('❌ 新增失敗: ' + e.message));
  },

  openOpCodeDetail(encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._editOpCode = r;
    document.getElementById('ocd-code').textContent  = r.code;
    document.getElementById('ocd-name').textContent  = r.name;
    const cleanP = parseFloat(String(r.price||0).replace(/,/g,''))||0;
    document.getElementById('ocd-price').textContent = cleanP ? '$'+cleanP.toLocaleString() : '-';
    document.getElementById('ocd-area').textContent  = r.area;
    document.getElementById('ocd-view').style.display = '';
    document.getElementById('ocd-edit').style.display = 'none';
    this.openModal('modal-opcode-detail');
  },

  openOpCodeEdit() {
    const r = this._editOpCode;
    document.getElementById('oce-code').value  = r.code;
    document.getElementById('oce-name').value  = r.name;
    document.getElementById('oce-price').value = String(r.price||'').replace(/,/g,'');
    document.getElementById('oce-area').value  = r.area;
    document.getElementById('ocd-view').style.display = 'none';
    document.getElementById('ocd-edit').style.display = '';
  },

  async saveOpCodeEdit() {
    const r = this._editOpCode;
    const d = {
      code:  document.getElementById('oce-code').value.trim(),
      name:  document.getElementById('oce-name').value.trim(),
      price: document.getElementById('oce-price').value,
      area:  document.getElementById('oce-area').value.trim(),
    };
    try {
      await SHEETS.updateOpCode(r._row, d);
      this.closeModal('modal-opcode-detail');
      this.toast('✅ 已更新');
      this.loadOpCode();
    } catch(e) { this.toast('❌ 更新失敗: ' + e.message); }
  },

  async deleteOpCode(row) {
    if(!confirm('確定刪除？')) return;
    try {
      await SHEETS.clearRow(SHEETS.T.opCode, row, 'A', 'E');
      this.toast('🗑 已刪除'); this.loadOpCode();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
  },

  // ── Self-pay detail ──
  openSelfPayDetail(encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._editSelfPay = r;
    document.getElementById('spd-brand').textContent   = r.brand;
    document.getElementById('spd-product').textContent = r.product;
    const cleanP = parseFloat(String(r.price||0).replace(/,/g,''))||0;
    document.getElementById('spd-price').textContent   = cleanP ? '$'+cleanP.toLocaleString() : '-';
    document.getElementById('spd-hospital').textContent= r.hospital;
    document.getElementById('spd-view').style.display  = '';
    document.getElementById('spd-edit').style.display  = 'none';
    this.openModal('modal-selfpay-detail');
  },

  openSelfPayEdit() {
    const r = this._editSelfPay;
    document.getElementById('spe-brand').value   = r.brand;
    document.getElementById('spe-product').value = r.product;
    document.getElementById('spe-price').value   = String(r.price||'').replace(/,/g,'');
    document.getElementById('spe-hospital').value= r.hospital;
    document.getElementById('spd-view').style.display = 'none';
    document.getElementById('spd-edit').style.display = '';
  },

  async saveSelfPayEdit() {
    const r = this._editSelfPay;
    const d = {
      brand:    document.getElementById('spe-brand').value.trim(),
      product:  document.getElementById('spe-product').value.trim(),
      price:    document.getElementById('spe-price').value,
      hospital: document.getElementById('spe-hospital').value.trim(),
    };
    try {
      await SHEETS.updateSelfPay(r._row, d);
      this.closeModal('modal-selfpay-detail');
      this.toast('✅ 已更新'); this.loadSelfPay();
    } catch(e) { this.toast('❌ 更新失敗: ' + e.message); }
  },

  async deleteSelfPay(row) {
    if(!confirm('確定刪除？')) return;
    try {
      await SHEETS.clearRow(SHEETS.T.matProd, row, 'A', 'F');
      this.toast('🗑 已刪除'); this.loadSelfPay();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
  },

  // ── Surgery detail ──
  openSurgeryDetail(encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._editSurgery = r;
    document.getElementById('sxd-date').textContent    = r.date;
    document.getElementById('sxd-area').textContent    = r.area;
    document.getElementById('sxd-name').textContent    = r.name;
    document.getElementById('sxd-type').textContent    = r.type;
    document.getElementById('sxd-opname').textContent  = r.opName;
    document.getElementById('sxd-loc').textContent     = r.location;
    document.getElementById('sxd-implant').textContent = r.implant;
    document.getElementById('sxd-note').textContent    = r.note;
    document.getElementById('sxd-view').style.display  = '';
    document.getElementById('sxd-edit').style.display  = 'none';
    this.openModal('modal-sx-detail');
  },

  openSurgeryEdit() {
    const r = this._editSurgery;
    document.getElementById('sxe-date').value   = r.date;
    document.getElementById('sxe-area').value   = r.area;
    document.getElementById('sxe-name').value   = r.name;
    document.getElementById('sxe-type').value   = r.type;
    document.getElementById('sxe-opname').value = r.opName;
    document.getElementById('sxe-loc').value    = r.location;
    document.getElementById('sxe-implant').value= r.implant;
    document.getElementById('sxe-note').value   = r.note;
    document.getElementById('sxd-view').style.display = 'none';
    document.getElementById('sxd-edit').style.display = '';
  },

  async saveSurgeryEdit() {
    const d = {
      date:    document.getElementById('sxe-date').value.trim(),
      area:    document.getElementById('sxe-area').value.trim(),
      name:    document.getElementById('sxe-name').value.trim(),
      type:    document.getElementById('sxe-type').value.trim(),
      opName:  document.getElementById('sxe-opname').value.trim(),
      location:document.getElementById('sxe-loc').value.trim(),
      implant: document.getElementById('sxe-implant').value.trim(),
      note:    document.getElementById('sxe-note').value.trim(),
    };
    try {
      await SHEETS.updateSurgery(this._editSurgery._row, d);
      this.closeModal('modal-sx-detail');
      this.toast('✅ 已更新');
      this.loadSurgery();
    } catch(e) { this.toast('❌ 更新失敗: ' + e.message); }
  },

  async deleteSurgery(row) {
    if(!confirm('確定刪除這筆手術紀錄？')) return;
    try {
      await SHEETS.clearRow(SHEETS.T.op, row, 'A', 'H');
      this.closeModal('modal-sx-detail');
      this.toast('🗑 已刪除');
      this.loadSurgery();
    } catch(e) { this.toast('❌ 刪除失敗: ' + e.message); }
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
