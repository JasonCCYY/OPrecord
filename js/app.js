// ── Ortho Record App v3 ──
const APP = {
  tab: 'surgery',
  subMat: 'matRec',
  subSx: 'sxList',
  searchActive: false,
  searchQuery: '',
  // material slide index: 0=matRec,1=selfPay,2=opCode,3=codeRec,4=estimate
  matSlideIdx: 0,
  MAT_SUBS: ['matRec','selfPay','opCode','codeRec','estimate'],
  _swipeStartX: 0, _swipeStartY: 0, _swiping: false,

  // ── Init ──
  async init() {
    document.getElementById('loading').style.display = 'flex';
    // Show cached data immediately for snappy feel
    this._showCachedAll();
    await AUTH.init();
    this.bindTabs();
    this.bindSubTabs();
    this.bindMatSwipe();
    this.bindModalSwipe();
    document.getElementById('fab').addEventListener('click', () => this.fabClick());
    document.getElementById('loading').style.display = 'none';
    if (!AUTH.ok) {
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  },

  // Show cached data from localStorage immediately (before auth)
  _showCachedAll() {
    // We'll render from cache when each page is first visited
    // This is handled inside each load function via SHEETS.cached()
  },

  onAuthSuccess() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    SHEETS.loadCategories();
    this.switchTab('surgery');
    // After 3s, refresh current view from network
    setTimeout(() => this.refresh(), 3000);
  },

  // ── Helpers ──
  fmt(v) { return v ? Number(String(v).replace(/,/g,'')).toLocaleString() : ''; },
  fmtP(v) { const n = this.fmt(v); return n ? '$'+n : ''; },
  uid() { return Math.random().toString(36).substring(2,10); },
  nowMonth() { const n=new Date(); return `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}`; },
  today() { const n=new Date(); return `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')}`; },
  todayISO() { return new Date().toISOString().split('T')[0]; },

  loading() { return '<div class="load-msg">載入中...</div>'; },
  empty()   { return '<div class="empty-state"><div class="empty-icon">📋</div><div>尚無紀錄</div></div>'; },
  err(e)    { return `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${e.message}</div></div>`; },

  dateNum(d) {
    const p = d.split('/');
    return p.length>=3 ? parseInt(p[0])*10000+parseInt(p[1])*100+parseInt(p[2]) : 0;
  },
  getMonth(d) {
    const p = d.split('/');
    return p.length>=2 ? p[0]+'/'+p[1].padStart(2,'0') : d.substring(0,7);
  },
  groupByMonth(recs) {
    const map = {};
    recs.forEach(r => { const m=this.getMonth(r.date); (map[m]=map[m]||[]).push(r); });
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  },
  sortBrands(a,b) {
    const eA=/^[A-Za-z0-9]/.test(a), eB=/^[A-Za-z0-9]/.test(b);
    if(eA&&!eB) return -1; if(!eA&&eB) return 1;
    return a.localeCompare(b,'zh-TW');
  },
  // Truncate text for display
  trunc(s, max) {
    if(!s) return '';
    return s.length > max ? s.substring(0, max) + '…' : s;
  },
  // ── Row store (avoids HTML encoding issues in onclick) ──
  _rowStore: [],
  _storeRow(r) { this._rowStore.push(r); return this._rowStore.length - 1; },
  _clearStore() { this._rowStore = []; },
  _getRow(i) { return this._rowStore[i]; },


  // ── Tab routing ──
  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
  },

  switchTab(tab) {
    this.tab = tab;
    this._clearStore();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
    document.getElementById('sub-mat').style.display  = tab==='material' ? 'flex' : 'none';
    document.getElementById('sub-sx').style.display   = tab==='surgery'  ? 'flex' : 'none';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('fab').style.display = tab==='surgery' ? 'flex' : 'none';
    document.getElementById('hdr-add-btn').style.display = 'none';
    if (tab==='surgery')  { document.getElementById('pg-surgery').classList.add('active');  this.switchSx(this.subSx); }
    else if(tab==='material') { document.getElementById('pg-material').classList.add('active'); this.switchMat(this.subMat); }
    else if(tab==='clinic') { document.getElementById('pg-clinic').classList.add('active'); this.loadClinic(); }
  },

  bindSubTabs() {
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.addEventListener('click', ()=>this.switchMat(b.dataset.sub)));
    document.querySelectorAll('#sub-sx .sub-tab').forEach(b => b.addEventListener('click', ()=>this.switchSx(b.dataset.sub)));
  },

  switchMat(sub) {
    this.subMat = sub;
    this._clearStore();
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub===sub));
    const idx = this.MAT_SUBS.indexOf(sub);
    if(idx >= 0) {
      this.matSlideIdx = idx;
      this._applySlide(idx);
    }
    document.getElementById('fab').style.display = 'none'; // FAB only for surgery
    document.getElementById('hdr-add-btn').style.display = 'none';
    const loaders = { matRec:()=>this.loadMatRec(), selfPay:()=>this.loadSelfPay(), opCode:()=>this.loadOpCode(), codeRec:()=>this.loadCodeRec(), estimate:()=>this.loadEstimate() };
    loaders[sub]?.();
  },

  _applySlide(idx) {
    const inner = document.getElementById('mat-swipe-inner');
    if(inner) inner.style.transform = `translateX(${-idx * 20}%)`;
  },

  // ── Swipe gestures for material tabs ──
  bindMatSwipe() {
    const container = document.getElementById('mat-swipe-container');
    if(!container) return;
    let startX, startY, startIdx, dragging = false;

    container.addEventListener('touchstart', e => {
      if(e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startIdx = this.matSlideIdx;
      dragging = false;
    }, {passive: true});

    container.addEventListener('touchmove', e => {
      if(e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if(!dragging && Math.abs(dy) > Math.abs(dx) + 8) return; // vertical scroll
      if(!dragging && Math.abs(dx) > 8) dragging = true;
      if(!dragging) return;
      e.preventDefault();
      const pct = (dx / container.offsetWidth) * 100;
      const inner = document.getElementById('mat-swipe-inner');
      inner.style.transition = 'none';
      inner.style.transform = `translateX(${-startIdx * 20 + pct/5}%)`;
    }, {passive: false});

    container.addEventListener('touchend', e => {
      if(!dragging) return;
      const dx = e.changedTouches[0].clientX - startX;
      const inner = document.getElementById('mat-swipe-inner');
      inner.style.transition = '';
      if(Math.abs(dx) > 50) {
        const newIdx = dx < 0
          ? Math.min(startIdx + 1, this.MAT_SUBS.length - 1)
          : Math.max(startIdx - 1, 0);
        this.switchMat(this.MAT_SUBS[newIdx]);
      } else {
        this._applySlide(startIdx);
      }
      dragging = false;
    }, {passive: true});
  },


  // ── Swipe down to close any open modal ──
  bindModalSwipe() {
    document.querySelectorAll('.modal-sheet').forEach(sheet => {
      let startY = 0, dragging = false;
      const modal = sheet.closest('.modal-bd');
      if(!modal) return;
      const modalId = modal.id;

      sheet.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        dragging = false;
      }, {passive: true});

      sheet.addEventListener('touchmove', e => {
        const dy = e.touches[0].clientY - startY;
        if(dy > 10) {
          dragging = true;
          sheet.style.transform = `translateY(${Math.max(0,dy)}px)`;
          sheet.style.transition = 'none';
        }
      }, {passive: true});

      sheet.addEventListener('touchend', e => {
        const dy = e.changedTouches[0].clientY - startY;
        sheet.style.transition = '';
        if(dy > 80) {
          sheet.style.transform = '';
          APP.closeModal(modalId);
        } else {
          sheet.style.transform = '';
        }
        dragging = false;
      }, {passive: true});
    });
  },

  switchSx(sub) {
    this.subSx = sub;
    this._clearStore();
    document.querySelectorAll('#sub-sx .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub===sub));
    document.querySelectorAll('#pg-surgery .sub-page').forEach(p => p.style.display='none');
    document.getElementById(sub==='sxList'?'pg-sx-list':'pg-track').style.display = 'flex';
    document.getElementById('fab').style.display = 'flex';
    if(sub==='sxList') this.loadSurgery();
    else this.loadTrack();
  },

  fabClick() {
    if(this.tab==='surgery') {
      if(this.subSx==='sxList') this.openModal('modal-op');
      else this.openModal('modal-track');
    } else if(this.tab==='material') {
      if(this.subMat==='matRec') this.openModal('modal-mat');
      else if(this.subMat==='codeRec') this.openModal('modal-code');
    }
  },

  // ── Search ──
  toggleSearch() {
    this.searchActive = !this.searchActive;
    const bar = document.getElementById('search-bar');
    bar.style.display = this.searchActive ? 'flex' : 'none';
    if(this.searchActive) document.getElementById('search-input').focus();
    else { this.searchQuery=''; this.refresh(); }
  },
  onSearch(v) {
    this.searchQuery = v.toLowerCase();
    this.refresh();
  },

  // ── Refresh ──
  refresh() {
    const cacheMap = { sxList:'op', track:'track', matRec:'matRec', selfPay:'matProd', opCode:'opCode', codeRec:'codeRec', estimate:'estimate', clinic:'clinic' };
    const key = this.tab==='surgery' ? this.subSx : this.tab==='material' ? this.subMat : this.tab;
    const cacheKey = cacheMap[key];
    if(cacheKey) localStorage.removeItem('ortho_'+cacheKey);
    if(this.tab==='surgery') this.switchSx(this.subSx);
    else if(this.tab==='material') this.switchMat(this.subMat);
    else this.loadClinic();
  },

  filterBySearch(recs, fields) {
    if(!this.searchQuery) return recs;
    return recs.filter(r => fields.some(f => (r[f]||'').toLowerCase().includes(this.searchQuery)));
  },

  // ── Surgery ──
  async loadSurgery() {
    const el = document.getElementById('sx-list-body');
    el.innerHTML = this.loading();
    try {
      let recs = await SHEETS.loadOpRecords();
      recs = this.filterBySearch(recs, ['name','type','opName','location','implant','area']);
      const sorted = [...recs].sort((a,b) => {
        const ma=this.getMonth(a.date), mb=this.getMonth(b.date);
        if(ma!==mb) return mb.localeCompare(ma);
        const aZ=a.area==='中正'?0:a.area==='右昌'?1:2;
        const bZ=b.area==='中正'?0:b.area==='右昌'?1:2;
        if(aZ!==bZ) return aZ-bZ;
        return this.dateNum(b.date)-this.dateNum(a.date);
      });
      if(!sorted.length) { el.innerHTML = `<tr><td colspan="8">${this.empty()}</td></tr>`; return; }
      let rows = '', lastM = '';
      sorted.forEach(r => {
        const m = this.getMonth(r.date);
        if(m!==lastM) {
          lastM=m;
          const ms=sorted.filter(x=>this.getMonth(x.date)===m);
          const zh=ms.filter(x=>x.area==='中正').length, yc=ms.filter(x=>x.area==='右昌').length;
          rows += `<tr class="sx-month-row"><td colspan="8">${m} <span class="month-badge">${ms.length}（${zh}/${yc}）</span></td></tr>`;
        }
        const p=r.date.split('/');
        const day=p.length>=3?p[1].padStart(2,'0')+'/'+p[2].padStart(2,'0'):r.date.substring(5);
        const _si=APP._storeRow(r);
        rows += `<tr class="sx-data-row" onclick="APP.openDetailS('sx',${_si})">
          <td class="sx-date">${day}</td>
          <td class="sx-area">${r.area}</td>
          <td class="sx-name">${r.name}</td>
          <td><span class="badge badge-${r.type}">${r.type||'-'}</span></td>
          <td class="sx-opname">${r.opName}</td>
          <td class="sx-loc" title="${r.location}">${r.location}</td>
          <td class="sx-implant">${r.implant}</td>
          <td class="sx-note">${r.note}</td>
        </tr>`;
      });
      el.innerHTML = rows;
    } catch(e) { el.innerHTML = `<tr><td colspan="8">${this.err(e)}</td></tr>`; }
  },

  // ── Track ──
  async loadTrack() {
    const el = document.getElementById('track-list-body');
    el.innerHTML = this.loading();
    try {
      let recs = await SHEETS.loadTrackRecords();
      recs = this.filterBySearch(recs, ['name','type','opName','location','area','mrn']);
      if(!recs.length) { el.innerHTML = `<tr><td colspan="8">${this.empty()}</td></tr>`; return; }
      let rows = '', lastM = '';
      const sorted = [...recs].sort((a,b)=>b.date.localeCompare(a.date));
      sorted.forEach(r => {
        const m = this.getMonth(r.date);
        if(m!==lastM) {
          lastM=m;
          rows += `<tr class="sx-month-row"><td colspan="8">${m}</td></tr>`;
        }
        const _si=APP._storeRow(r);
        rows += `<tr class="sx-data-row" onclick="APP.openDetailS('track',${_si})">
          <td class="sx-date">${r.date.substring(5)}</td>
          <td class="sx-area">${r.area}</td>
          <td class="sx-name">${r.name}</td>
          <td><span class="badge badge-${r.type}">${r.type||'-'}</span></td>
          <td class="sx-opname">${r.opName}</td>
          <td class="sx-loc" title="${r.location}">${r.location}</td>
          <td class="sx-implant">${r.implant}</td>
          <td class="sx-note">${r.note}</td>
        </tr>`;
      });
      el.innerHTML = rows;
    } catch(e) { el.innerHTML = `<tr><td colspan="8">${this.err(e)}</td></tr>`; }
  },

  // ── Material Records ──
  async loadMatRec() {
    const el = document.getElementById('mat-rec-list');
    el.innerHTML = this.loading();
    try {
      let recs = await SHEETS.loadMatRecords();
      recs = this.filterBySearch(recs, ['brand','product']);
      if(!recs.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      this.groupByMonth(recs).forEach(([m, rows]) => {
        const total = rows.reduce((s,r)=>s+(parseFloat(String(r.price).replace(/,/g,''))||0)*(parseInt(r.qty)||1),0);
        html += `<div class="list-month-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        const sorted = [...rows].sort((a,b)=>{
          const aN=a.todayNew?.toString().toUpperCase()==='TRUE';
          const bN=b.todayNew?.toString().toUpperCase()==='TRUE';
          if(aN&&!bN) return -1; if(!aN&&bN) return 1;
          return this.sortBrands(a.brand||'',b.brand||'');
        });
        sorted.forEach(r => {
          const isNew=r.todayNew?.toString().toUpperCase()==='TRUE';
          const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const qty=parseInt(r.qty)||1;
          const sub=cleanP&&qty>1?`<span class="sub-total">×${qty}=$${(cleanP*qty).toLocaleString()}</span>`:'';
          const _si=APP._storeRow(r);
          const isDone=r.done?.toLowerCase()==='true';
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetailS('mat',${_si})">
            ${isNew?'<span class="new-dot"></span>':'<span class="dot-ph"></span>'}
            <span class="col-brand">${r.brand}</span>
            <span class="col-product">${r.product}${sub}</span>
            <span class="col-qty">${r.qty}</span>
            <span class="col-price">${cleanP?'$'+cleanP.toLocaleString():''}</span>
            ${isDone ? '<span class="done-ph"></span>' : `<button class="done-btn" onclick="event.stopPropagation();APP.markDone(${r._row})" title="標記完成">☑</button>`}
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Self-pay ──
  async loadSelfPay() {
    const el = document.getElementById('selfpay-list');
    el.innerHTML = this.loading();
    try {
      let items = await SHEETS.loadMatProducts();
      items = this.filterBySearch(items, ['brand','product']);
      if(!items.length) { el.innerHTML = this.empty(); return; }
      const groups = {};
      items.forEach(r => { (groups[r.brand]=groups[r.brand]||[]).push(r); });
      let html = '';
      Object.entries(groups).sort((a,b)=>this.sortBrands(a[0],b[0])).forEach(([brand,rows]) => {
        html += `<div class="list-group-hdr">${brand}</div>`;
        rows.forEach(r => {
          const cleanP = String(r.price||'').replace(/,/g,'').trim();
          const _si=APP._storeRow(r);
          html += `<div class="list-row" onclick="APP.openDetailS('selfpay',${_si})">
            <span class="col-brand">${r.brand}</span>
            <span class="col-product">${r.product}</span>
            <button class="add-center-btn" onclick="event.stopPropagation();APP.qAddMat('${r.brand.replace(/'/g,"\\'")}','${r.product.replace(/'/g,"\\'")}','${cleanP}')" title="新增到骨材記錄">＋</button>
            <span class="col-price">${cleanP?'$'+Number(cleanP).toLocaleString():'-'}</span>
            <span class="col-hosp">${r.hospital||''}</span>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── OP Code ──
  async loadOpCode() {
    const el = document.getElementById('opcode-list');
    el.innerHTML = this.loading();
    try {
      let items = await SHEETS.loadOpCodes();
      items = this.filterBySearch(items, ['code','name','area']);
      if(!items.length) { el.innerHTML = this.empty(); return; }
      const areaOrder = ['中正','右昌'];
      const groups = {};
      items.forEach(r => { const a=r.area||'通用'; (groups[a]=groups[a]||[]).push(r); });
      const sortedAreas = Object.keys(groups).sort((a,b)=>{
        const ai=areaOrder.indexOf(a), bi=areaOrder.indexOf(b);
        if(ai>=0&&bi>=0) return ai-bi;
        if(ai>=0) return -1; if(bi>=0) return 1;
        return a.localeCompare(b,'zh-TW');
      });
      let html = '';
      sortedAreas.forEach(area => {
        const rows = groups[area].sort((a,b)=>parseInt(a.code||0)-parseInt(b.code||0));
        html += `<div class="list-group-hdr">${area}</div>`;
        rows.forEach(r => {
          const cleanP = parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const _si=APP._storeRow(r);
          html += `<div class="list-row" onclick="APP.openDetailS('opcode',${_si})">
            <span class="col-code">${r.code}</span>
            <span class="col-product" title="${r.name}">${r.name}</span>
            <button class="add-center-btn" onclick="event.stopPropagation();APP.qAddCode('${r.name.replace(/'/g,"\\'")}','${r.code}','${r.price}','${r.area}')" title="新增到代碼紀錄">＋</button>
            <span class="col-price">${cleanP?'$'+cleanP.toLocaleString():''}</span>
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
      let recs = await SHEETS.loadCodeRecords();
      recs = this.filterBySearch(recs, ['name','code','area']);
      if(!recs.length) { el.innerHTML = this.empty(); return; }
      let html = '';
      this.groupByMonth(recs).forEach(([m,rows]) => {
        const total = rows.reduce((s,r)=>s+(parseFloat(String(r.price).replace(/,/g,''))||0)*(parseInt(r.qty)||1),0);
        html += `<div class="list-month-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        const areaOrd=['中正','右昌'];
        const sorted=[...rows].sort((a,b)=>{
          const aN=a.todayNew?.toString().toUpperCase()==='TRUE';
          const bN=b.todayNew?.toString().toUpperCase()==='TRUE';
          if(aN&&!bN) return -1; if(!aN&&bN) return 1;
          const ai=areaOrd.indexOf(a.area),bi=areaOrd.indexOf(b.area);
          if(ai>=0&&bi>=0&&ai!==bi) return ai-bi;
          return parseInt(a.code||0)-parseInt(b.code||0);
        });
        sorted.forEach(r => {
          const isNew=r.todayNew?.toString().toUpperCase()==='TRUE';
          const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const _si=APP._storeRow(r);
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetailS('coderec',${_si})">
            ${isNew?'<span class="new-dot"></span>':'<span class="dot-ph"></span>'}
            <span class="col-product" title="${r.name}">${r.name}</span>
            <span class="col-code">${r.code}</span>
            <span class="col-price">${cleanP?'$'+cleanP.toLocaleString():''}</span>
            <span class="col-qty">${r.qty}</span>
            <span class="col-area">${r.area}</span>
          </div>`;
        });
      });
      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Estimate — transposed: rows=labels, cols=months ──
  async loadEstimate() {
    const thead = document.getElementById('est-thead');
    const tbody = document.getElementById('est-tbody');
    tbody.innerHTML = `<tr><td colspan="10" class="load-msg">載入中...</td></tr>`;
    try {
      const recs = await SHEETS.loadEstimate();
      if(!recs.length) { tbody.innerHTML = `<tr><td>${this.empty()}</td></tr>`; return; }
      // Column order: next month first, this month second, rest ascending
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      const thisYM = `${now.getFullYear()}/${pad(now.getMonth()+1)}`;
      const nxt = new Date(now.getFullYear(), now.getMonth()+1, 1);
      const nextYM = `${nxt.getFullYear()}/${pad(nxt.getMonth()+1)}`;
      const sorted = [...recs].sort((a,b) => {
        const score = m => m===nextYM ? 0 : m===thisYM ? 1 : 2;
        const s = score(a.month) - score(b.month);
        return s !== 0 ? s : a.month.localeCompare(b.month);
      });
      // Header: only MM, no year
      const mLabel = m => { const p=m.split('/'); return p.length>=2 ? p[1].replace(/^0/,'')+' 月' : m; };
      thead.innerHTML = '<tr><th>項目</th>' +
        sorted.map(r=>`<th>${mLabel(r.month)}</th>`).join('') + '</tr>';
      // Row labels
      const labels = [
        { key:'estimate', label:'預估' },
        { key:'material', label:'醫材' },
        { key:'zhongzheng', label:'中正' },
        { key:'clinic', label:'門診' },
        { key:'youchang', label:'右昌' },
      ];
      tbody.innerHTML = labels.map((lb,li) => {
        const isTotal = li===0;
        return `<tr class="${isTotal?'est-total-row':''}">
          <td>${lb.label}</td>
          ${sorted.map(r=>{
            const v=r[lb.key];
            return `<td>${v&&v!=='0'?Number(String(v).replace(/,/g,'')).toLocaleString():'-'}</td>`;
          }).join('')}
        </tr>`;
      }).join('');
    } catch(e) { tbody.innerHTML = `<tr><td>${this.err(e)}</td></tr>`; }
  },

  // ── Clinic — sorted by clinicProducts order ──
  async loadClinic() {
    const el = document.getElementById('clinic-content');
    el.innerHTML = this.loading();
    try {
      const [products, records] = await Promise.all([SHEETS.loadClinicProducts(), SHEETS.loadClinicRecords()]);
      this._clinicProds = products;
      // Build product order map for sorting records
      const prodOrder = {};
      products.forEach((p,i) => { prodOrder[p.name] = i; });

      let html = '';
      // Self-pay price list
      html += `<div class="clinic-section-hdr">自費項目</div>`;
      products.forEach(r => {
        const cleanP = String(r.price||'').replace(/,/g,'').trim();
        html += `<div class="list-row">
          <span class="col-product" style="font-weight:600">${r.name}</span>
          <button class="add-center-btn" onclick="APP.qAddClinic('${r.name.replace(/'/g,"\\'")}','${cleanP}')" title="快速新增門診記錄" style="margin-left:auto;margin-right:auto;flex-shrink:0">＋</button>
          <span class="col-price">${cleanP?'$'+Number(cleanP).toLocaleString():'免費'}</span>
        </div>`;
      });

      // Records section
      html += `<div class="clinic-section-hdr">門診記錄</div>`;
      let filteredRecs = this.filterBySearch(records, ['product','date']);
      this.groupByMonth(filteredRecs).forEach(([m,rows]) => {
        const mTotal = rows.reduce((s,r)=>{
          return s+(parseFloat(String(r.price||0).replace(/,/g,''))||0)*(parseInt(r.qty)||1);
        },0);
        html += `<div class="list-month-hdr" style="top:44px">${m} <span class="month-badge">$${mTotal.toLocaleString()}</span></div>`;
        // Sort by product order in self-pay list
        const sortedRows = [...rows].sort((a,b)=>{
          const oa = prodOrder[a.product]??999, ob = prodOrder[b.product]??999;
          return oa!==ob ? oa-ob : b.date.localeCompare(a.date);
        });
        sortedRows.forEach(r => {
          const isNew=r.todayNew?.toString().toUpperCase()==='TRUE';
          const _si=APP._storeRow(r);
          const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const rowTotal=cleanP*(parseInt(r.qty)||1);
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetailS('clinic',${_si})">
            ${isNew?'<span class="new-dot"></span>':'<span class="dot-ph"></span>'}
            <span class="col-date">${r.date.substring(5)}</span>
            <span class="col-product">${r.product}</span>
            <span class="col-qty">${r.qty}</span>
            <span class="col-price">${rowTotal?'$'+rowTotal.toLocaleString():''}</span>
          </div>`;
        });
      });

      el.innerHTML = html;
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Quick adds ──
  async qAddMat(brand, product, price) {
    try { await SHEETS.quickAddMat(brand, product, price); this.toast(`✅ 已新增 ${product}`); }
    catch(e) { this.toast('❌ '+e.message); }
  },
  async qAddCode(name, code, price, area) {
    try { await SHEETS.quickAddCode({name,code,price,area}); this.toast(`✅ 已新增 ${name}`); }
    catch(e) { this.toast('❌ '+e.message); }
  },
  async qAddClinic(name, price) {
    try { await SHEETS.quickAddClinic(name, price); this.toast(`✅ 已新增 ${name}`); this.loadClinic(); }
    catch(e) { this.toast('❌ '+e.message); }
  },
  async markDone(row) {
    try { await SHEETS.setDone(row); this.toast('✅ 已標記完成'); this.loadMatRec(); }
    catch(e) { this.toast('❌ '+e.message); }
  },

  // ── Detail Modal via store index (avoids HTML encoding issues) ──
  openDetailS(type, idx) {
    const r = this._getRow(idx);
    if(!r) return;
    this._detailType = type;
    this._detailData = r;
    this._renderDetail(type, r);
  },

  // ── Detail Modal — hide _row / internal IDs ──
  openDetail(type, encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._detailType = type;
    this._detailData = r;
    this._renderDetail(type, r);
  },

  _renderDetail(type, r) {    const titles = { sx:'手術紀錄', track:'追蹤', mat:'骨材記錄', selfpay:'自費醫材', opcode:'OP代碼', coderec:'代碼紀錄', clinic:'門診記錄' };
    document.getElementById('detail-title').textContent = titles[type] || '詳情';

    const field = (label, val) => val ? `<div class="detail-field"><div class="detail-label">${label}</div><div class="detail-val">${val}</div></div>` : '';

    let content = '';
    if(type==='sx'||type==='track') {
      content = field('日期',r.date)+field('院區',r.area)+(type==='track'?field('病歷號',r.mrn)+field('診所ID',r.clinicId):'')+field('姓名',r.name)+field('類型',r.type)+field('手術名稱',r.opName)+field('部位',r.location)+field('骨材',r.implant)+field('備註',r.note);
    } else if(type==='mat') {
      const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
      const total=cleanP*(parseInt(r.qty)||1);
      content = field('廠牌',r.brand)+field('產品',r.product)+field('日期',r.date)+field('單價',cleanP?'$'+cleanP.toLocaleString():'')+field('數量',r.qty)+field('總價',total?'$'+total.toLocaleString():'')+field('狀態',r.done?.toLowerCase()==='true'?'已完成':'未完成');
    } else if(type==='selfpay') {
      content = field('廠牌',r.brand)+field('產品',r.product)+field('類型',r.type)+field('單價',r.price?'$'+Number(String(r.price).replace(/,/g,'')).toLocaleString():'')+field('醫院',r.hospital);
    } else if(type==='opcode') {
      content = field('代碼',r.code)+field('術式',r.name)+field('單價',r.price?'$'+Number(String(r.price).replace(/,/g,'')).toLocaleString():'')+field('院區',r.area);
    } else if(type==='coderec') {
      const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
      content = field('術式',r.name)+field('代碼',r.code)+field('日期',r.date)+field('單價',cleanP?'$'+cleanP.toLocaleString():'')+field('數量',r.qty)+field('院區',r.area);
    } else if(type==='clinic') {
      const cleanP2=parseFloat(String(r.price||0).replace(/,/g,''))||0;
      const rowTot=cleanP2*(parseInt(r.qty)||1);
      content = field('日期',r.date)+field('產品',r.product)+field('單價',cleanP2?'$'+cleanP2.toLocaleString():'')+field('數量',r.qty)+field('總價',rowTot?'$'+rowTot.toLocaleString():'');
    }
    document.getElementById('detail-body').innerHTML = content;
    document.getElementById('detail-edit-btn').style.display = '';
    document.getElementById('modal-detail').classList.add('open');
  
  },
  openEdit() {
    const type = this._detailType, r = this._detailData;
    this.closeModal('modal-detail');
    const editModalMap = { sx:'modal-edit-sx', track:'modal-edit-track', mat:'modal-edit-mat', selfpay:'modal-edit-selfpay', opcode:'modal-edit-opcode', coderec:'modal-edit-coderec', clinic:'modal-edit-clinic' };
    const m = editModalMap[type];
    if(!m) return;
    if(type==='sx'||type==='track') {
      const pfx = type==='sx'?'es':'et';
      document.getElementById(pfx+'-date').value   = r.date||'';
      document.getElementById(pfx+'-area').value   = r.area||'';
      document.getElementById(pfx+'-name').value   = r.name||'';
      document.getElementById(pfx+'-type').value   = r.type||'';
      document.getElementById(pfx+'-opname').value = r.opName||'';
      document.getElementById(pfx+'-loc').value    = r.location||'';
      document.getElementById(pfx+'-implant').value= r.implant||'';
      document.getElementById(pfx+'-note').value   = r.note||'';
      if(type==='track') {
        document.getElementById('et-mrn').value      = r.mrn||'';
        document.getElementById('et-clinicid').value = r.clinicId||'';
      }
    } else if(type==='mat') {
      document.getElementById('em-brand').value   = r.brand||'';
      document.getElementById('em-product').value = r.product||'';
      document.getElementById('em-date').value    = r.date||'';
      document.getElementById('em-price').value   = String(r.price||'').replace(/,/g,'');
      document.getElementById('em-qty').value     = r.qty||'1';
      const isDone = r.done?.toLowerCase()==='true';
      document.getElementById('em-done-val').value = isDone?'true':'false';
      document.getElementById('em-done-y').classList.toggle('on',isDone);
      document.getElementById('em-done-n').classList.toggle('on',!isDone);
    } else if(type==='selfpay') {
      document.getElementById('esp-brand').value   = r.brand||'';
      document.getElementById('esp-product').value = r.product||'';
      document.getElementById('esp-price').value   = String(r.price||'').replace(/,/g,'');
      document.getElementById('esp-hosp').value    = r.hospital||'';
    } else if(type==='opcode') {
      document.getElementById('eoc-code').value  = r.code||'';
      document.getElementById('eoc-name').value  = r.name||'';
      document.getElementById('eoc-price').value = String(r.price||'').replace(/,/g,'');
      document.getElementById('eoc-area').value  = r.area||'';
    } else if(type==='coderec') {
      document.getElementById('ecr-name').value  = r.name||'';
      document.getElementById('ecr-code').value  = r.code||'';
      document.getElementById('ecr-date').value  = r.date||'';
      document.getElementById('ecr-price').value = String(r.price||'').replace(/,/g,'');
      document.getElementById('ecr-qty').value   = r.qty||'1';
      document.getElementById('ecr-area').value  = r.area||'';
    } else if(type==='clinic') {
      document.getElementById('ecl-date').value    = r.date||'';
      document.getElementById('ecl-product').value = r.product||'';
      document.getElementById('ecl-price').value   = String(r.price||'').replace(/,/g,'');
      document.getElementById('ecl-qty').value     = r.qty||'1';
    }
    this.openModal(m);
  },

  async saveEdit() {
    const type=this._detailType, r=this._detailData;
    try {
      if(type==='sx') {
        await SHEETS.updateSurgery(r._row,{date:document.getElementById('es-date').value,area:document.getElementById('es-area').value,name:document.getElementById('es-name').value,type:document.getElementById('es-type').value,opName:document.getElementById('es-opname').value,location:document.getElementById('es-loc').value,implant:document.getElementById('es-implant').value,note:document.getElementById('es-note').value});
        this.closeModal('modal-edit-sx'); this.loadSurgery();
      } else if(type==='track') {
        await SHEETS.updateTrack(r._row,{date:document.getElementById('et-date').value,area:document.getElementById('et-area').value,mrn:document.getElementById('et-mrn').value,clinicId:document.getElementById('et-clinicid').value,name:document.getElementById('et-name').value,type:document.getElementById('et-type').value,opName:document.getElementById('et-opname').value,location:document.getElementById('et-loc').value,implant:document.getElementById('et-implant').value,note:document.getElementById('et-note').value});
        this.closeModal('modal-edit-track'); this.loadTrack();
      } else if(type==='mat') {
        await SHEETS.updateMatRow(r._row,{brand:document.getElementById('em-brand').value,product:document.getElementById('em-product').value,date:document.getElementById('em-date').value,price:document.getElementById('em-price').value,qty:document.getElementById('em-qty').value,done:document.getElementById('em-done-val').value});
        this.closeModal('modal-edit-mat'); this.loadMatRec();
      } else if(type==='selfpay') {
        await SHEETS.updateSelfPay(r._row,{brand:document.getElementById('esp-brand').value,product:document.getElementById('esp-product').value,price:document.getElementById('esp-price').value,hospital:document.getElementById('esp-hosp').value});
        this.closeModal('modal-edit-selfpay'); this.loadSelfPay();
      } else if(type==='opcode') {
        await SHEETS.updateOpCode(r._row,{code:document.getElementById('eoc-code').value,name:document.getElementById('eoc-name').value,price:document.getElementById('eoc-price').value,area:document.getElementById('eoc-area').value});
        this.closeModal('modal-edit-opcode'); this.loadOpCode();
      } else if(type==='coderec') {
        await SHEETS.updateCodeRec(r._row,{name:document.getElementById('ecr-name').value,code:document.getElementById('ecr-code').value,date:document.getElementById('ecr-date').value,price:document.getElementById('ecr-price').value,qty:document.getElementById('ecr-qty').value,area:document.getElementById('ecr-area').value});
        this.closeModal('modal-edit-coderec'); this.loadCodeRec();
      } else if(type==='clinic') {
        await SHEETS.updateClinicRec(r._row,{date:document.getElementById('ecl-date').value,product:document.getElementById('ecl-product').value,price:document.getElementById('ecl-price').value,qty:document.getElementById('ecl-qty').value});
        this.closeModal('modal-edit-clinic'); this.loadClinic();
      }
      this.toast('✅ 已更新');
    } catch(e) { this.toast('❌ '+e.message); }
  },

  async deleteDetail() {
    const type=this._detailType, r=this._detailData;
    if(!confirm('確定刪除？')) return;
    const tabMap={sx:'op',track:'track',mat:'matRec',selfpay:'matProd',opcode:'opCode',coderec:'codeRec',clinic:'clinic'};
    const colMap={sx:['A','H'],track:['A','K'],mat:['A','H'],selfpay:['A','F'],opcode:['A','E'],coderec:['A','H'],clinic:['A','F']};
    const cacheMap={sx:'op',track:'track',mat:'matRec',selfpay:'matProd',opcode:'opCode',coderec:'codeRec',clinic:'clinic'};
    try {
      const tab=SHEETS.T[tabMap[type]],cols=colMap[type];
      await SHEETS.deleteRow(tab,r._row,cols[0],cols[1],cacheMap[type]);
      this.closeModal('modal-detail');
      this.toast('🗑 已刪除');
      this.refresh();
    } catch(e) { this.toast('❌ '+e.message); }
  },

  toggleDone(val) {
    document.getElementById('em-done-val').value=val;
    document.getElementById('em-done-y').classList.toggle('on',val==='true');
    document.getElementById('em-done-n').classList.toggle('on',val==='false');
  },

  // ── New record save ──
  async saveOp() {
    const d={date:document.getElementById('s-date').value.replace(/-/g,'/'),area:document.getElementById('s-area-val').value,name:document.getElementById('s-name').value.trim(),type:document.getElementById('s-type-val').value,opName:document.getElementById('s-opname').value,location:document.getElementById('s-location').value.trim(),implant:document.getElementById('s-bone-val').value,note:document.getElementById('s-note').value.trim()};
    if(!d.date||!d.name){this.toast('請填入日期和姓名');return;}
    try{await SHEETS.addOp(d);this.closeModal('modal-op');this.toast('✅ 已儲存');this.loadSurgery();}
    catch(e){this.toast('❌ '+e.message);}
  },
  async saveTrack() {
    const d={date:document.getElementById('tk-date').value.replace(/-/g,'/'),area:document.getElementById('tk-area').value,mrn:document.getElementById('tk-mrn').value.trim(),clinicId:document.getElementById('tk-clinicid').value.trim(),name:document.getElementById('tk-name').value.trim(),type:document.getElementById('tk-type').value,opName:document.getElementById('tk-opname').value.trim(),location:document.getElementById('tk-loc').value.trim(),implant:document.getElementById('tk-implant').value.trim(),note:document.getElementById('tk-note').value.trim()};
    if(!d.date||!d.name){this.toast('請填入日期和姓名');return;}
    try{await SHEETS.addTrack(d);this.closeModal('modal-track');this.toast('✅ 已儲存');this.loadTrack();}
    catch(e){this.toast('❌ '+e.message);}
  },
  async saveMat() {
    const d={date:document.getElementById('m-date').value.replace(/-/g,'/'),brand:document.getElementById('m-brand').value.trim(),product:document.getElementById('m-product').value.trim(),qty:document.getElementById('m-qty').value,price:document.getElementById('m-price').value};
    if(!d.date||!d.product){this.toast('請填入日期和產品');return;}
    try{await SHEETS.addMat(d);this.closeModal('modal-mat');this.toast('✅ 已儲存');this.loadMatRec();}
    catch(e){this.toast('❌ '+e.message);}
  },
  async saveCode() {
    const d={date:document.getElementById('c-date').value.replace(/-/g,'/'),name:document.getElementById('c-name').value.trim(),code:document.getElementById('c-code').value.trim(),price:document.getElementById('c-price').value,qty:document.getElementById('c-qty').value,area:document.getElementById('c-area').value};
    if(!d.date||!d.code){this.toast('請填入日期和代碼');return;}
    try{await SHEETS.addCode(d);this.closeModal('modal-code');this.toast('✅ 已儲存');this.loadCodeRec();}
    catch(e){this.toast('❌ '+e.message);}
  },
  async saveCli() {
    const d={date:document.getElementById('cl-date').value.replace(/-/g,'/'),product:document.getElementById('cl-product').value,price:document.getElementById('cl-price').value,qty:document.getElementById('cl-qty').value};
    if(!d.date||!d.product){this.toast('請填入日期和產品');return;}
    try{await SHEETS.addClinic(d);this.closeModal('modal-cli');this.toast('✅ 已儲存');this.loadClinic();}
    catch(e){this.toast('❌ '+e.message);}
  },

  // Surgery modal chips
  selectArea(el,v){document.querySelectorAll('[onclick*="selectArea"]').forEach(c=>c.classList.remove('on'));el.classList.add('on');document.getElementById('s-area-val').value=v;},
  selectType(el,type){
    document.querySelectorAll('[onclick*="selectType"]').forEach(c=>c.classList.remove('on'));el.classList.add('on');
    document.getElementById('s-type-val').value=type;
    this.updateOpDropdowns(type);
  },
  updateOpDropdowns(type){
    const sel=document.getElementById('s-opname');
    const names=(SHEETS.opCats||[]).filter(c=>c.type.trim()===type).map(c=>c.name);
    sel.innerHTML='<option value="">選擇手術名稱</option>'+names.map(n=>`<option value="${n}">${n}</option>`).join('');
    const wrap=document.getElementById('s-bone-wrap');
    const main=(SHEETS.boneCats||[]).filter(c=>c.type.trim()===type).map(c=>c.bone);
    const growth=(SHEETS.growthFactors&&SHEETS.growthFactors.length)?SHEETS.growthFactors:['漢森柏0.5','PRP 15K','PRP 36K','羊膜22S','瑟若美'];
    let h=main.map(b=>`<label class="bone-chip"><input type="checkbox" value="${b}" onchange="APP.updateBoneVal()"><span>${b}</span></label>`).join('');
    h+=`<div class="bone-section">生長因子</div>`;
    h+=growth.map(b=>`<label class="bone-chip"><input type="checkbox" value="${b}" onchange="APP.updateBoneVal()"><span>${b}</span></label>`).join('');
    wrap.innerHTML=h; this.updateBoneVal();
  },
  updateBoneVal(){document.getElementById('s-bone-val').value=[...document.querySelectorAll('#s-bone-wrap input:checked')].map(c=>c.value).join(' , ');},

  openModal(id){
    document.getElementById(id).classList.add('open');
    document.querySelectorAll(`#${id} input[type="date"]`).forEach(el=>el.value=this.todayISO());
  },
  closeModal(id){document.getElementById(id).classList.remove('open');},

  toast(msg){
    const el=document.getElementById('toast');
    el.textContent=msg; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2600);
  },
};

document.addEventListener('DOMContentLoaded',()=>{
  APP.init();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
});
