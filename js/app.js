// ── Ortho Record App v2 ──
const APP = {
  tab: 'surgery',
  subMat: 'matRec',
  subSx: 'sxList',   // sxList | track
  searchActive: false,
  searchQuery: '',

  // ── Init ──
  async init() {
    document.getElementById('loading').style.display = 'flex';
    await AUTH.init();
    this.bindTabs();
    this.bindSubTabs();
    document.getElementById('fab').addEventListener('click', () => this.fabClick());
    document.getElementById('loading').style.display = 'none';
    if (!AUTH.ok) {
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  },

  onAuthSuccess() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    SHEETS.loadCategories();
    this.switchTab('surgery');
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

  // ── Tab routing ──
  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
  },

  switchTab(tab) {
    this.tab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
    document.getElementById('sub-mat').style.display  = tab==='material' ? 'flex' : 'none';
    document.getElementById('sub-sx').style.display   = tab==='surgery'  ? 'flex' : 'none';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('fab').style.display = tab==='surgery' ? 'flex' : 'none';
    document.getElementById('hdr-add-btn').style.display = 'none';
    if (tab==='surgery')  { document.getElementById('pg-surgery').classList.add('active');  this.switchSx(this.subSx); }
    else if(tab==='material') this.switchMat(this.subMat);
    else if(tab==='clinic') { document.getElementById('pg-clinic').classList.add('active'); this.loadClinic(); }
  },

  bindSubTabs() {
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.addEventListener('click', ()=>this.switchMat(b.dataset.sub)));
    document.querySelectorAll('#sub-sx .sub-tab').forEach(b => b.addEventListener('click', ()=>this.switchSx(b.dataset.sub)));
  },

  switchMat(sub) {
    this.subMat = sub;
    document.querySelectorAll('#sub-mat .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub===sub));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pgMap = { matRec:'pg-mat-rec', selfPay:'pg-selfpay', opCode:'pg-opcode', codeRec:'pg-code-rec', estimate:'pg-estimate' };
    document.getElementById(pgMap[sub])?.classList.add('active');
    document.getElementById('fab').style.display = 'none';
    document.getElementById('hdr-add-btn').style.display = 'none';
    const loaders = { matRec:()=>this.loadMatRec(), selfPay:()=>this.loadSelfPay(), opCode:()=>this.loadOpCode(), codeRec:()=>this.loadCodeRec(), estimate:()=>this.loadEstimate() };
    loaders[sub]?.();
  },

  switchSx(sub) {
    this.subSx = sub;
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
    }  // clinic FAB removed
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
    if(this.tab==='surgery') this.switchSx(this.subSx);
    else if(this.tab==='material') this.switchMat(this.subMat);
    else if(this.tab==='clinic') this.loadClinic();
    // Invalidate cache for current section
    const cacheMap = { surgery:'op', track:'track', matRec:'matRec', selfPay:'matProd', opCode:'opCode', codeRec:'codeRec', estimate:'estimate', clinic:'clinic' };
    const key = this.tab==='surgery' ? this.subSx : this.subMat;
    const cacheKey = cacheMap[key] || cacheMap[this.tab];
    if(cacheKey) localStorage.removeItem('ortho_'+cacheKey);
    // Re-run load
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
      if(!sorted.length) { el.innerHTML = this.empty(); return; }
      let rows = '';
      let lastM = '';
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
        const enc=encodeURIComponent(JSON.stringify(r));
        rows += `<tr class="sx-data-row" onclick="APP.openDetail('sx',${JSON.stringify(enc)})">
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
      if(!recs.length) { el.innerHTML = this.empty(); return; }
      let rows = '';
      recs.forEach(r => {
        const enc=encodeURIComponent(JSON.stringify(r));
        rows += `<tr class="sx-data-row" onclick="APP.openDetail('track',${JSON.stringify(enc)})">
          <td class="sx-date">${r.date}</td>
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
        html += `<div class="list-group-hdr sticky-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        const sorted = [...rows].sort((a,b)=>{
          const aN=a.todayNew?.toString().toUpperCase()==='TRUE';
          const bN=b.todayNew?.toString().toUpperCase()==='TRUE';
          if(aN&&!bN) return -1; if(!aN&&bN) return 1;
          return this.sortBrands(a.brand||'',b.brand||'');
        });
        sorted.forEach(r => {
          const isNew=r.todayNew?.toString().toUpperCase()==='TRUE';
          const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const sub=cleanP&&parseInt(r.qty)>1?`<span class="sub-total">×${r.qty}=$${(cleanP*parseInt(r.qty)).toLocaleString()}</span>`:'';
          const enc=encodeURIComponent(JSON.stringify(r));
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetail('mat',${JSON.stringify(enc)})">
            ${isNew?'<span class="new-dot"></span>':'<span class="dot-ph"></span>'}
            <span class="col-brand">${r.brand}</span>
            <span class="col-product">${r.product}${sub}</span>
            <span class="col-qty">${r.qty}</span>
            <span class="col-price">${cleanP?'$'+cleanP.toLocaleString():''}</span>
            ${r.done?.toLowerCase()==='true' ? '' : `<button class="done-btn" onclick="event.stopPropagation();APP.markDone(${r._row})" title="標記完成">☑</button>`}
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
          const enc = encodeURIComponent(JSON.stringify(r));
          html += `<div class="list-row" onclick="APP.openDetail('selfpay',${JSON.stringify(enc)})">
            <span class="col-brand">${r.brand}</span>
            <span class="col-product">${r.product}</span>
            <button class="add-center-btn" onclick="event.stopPropagation();APP.qAddMat('${r.brand.replace(/'/g,"\\'")}','${r.product.replace(/'/g,"\\'")}','${cleanP}')" title="新增到骨材記錄">＋</button>
            <span class="col-price">${cleanP?'$'+Number(cleanP).toLocaleString():'-'}</span>
            <span class="col-hosp">${r.hospital}</span>
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
          const enc = encodeURIComponent(JSON.stringify(r));
          html += `<div class="list-row" onclick="APP.openDetail('opcode',${JSON.stringify(enc)})">
            <span class="col-code">${r.code}</span>
            <span class="col-product">${r.name}</span>
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
        html += `<div class="list-group-hdr sticky-hdr">${m} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
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
          const enc=encodeURIComponent(JSON.stringify(r));
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetail('coderec',${JSON.stringify(enc)})">
            ${isNew?'<span class="new-dot"></span>':'<span class="dot-ph"></span>'}
            <span class="col-product">${r.name}</span>
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

  // ── Estimate ──
  async loadEstimate() {
    const el = document.getElementById('estimate-list');
    el.innerHTML = this.loading();
    try {
      const recs = await SHEETS.loadEstimate();
      if(!recs.length) { el.innerHTML = this.empty(); return; }
      // Order: 月份 預估 醫材 中正 門診 右昌
      el.innerHTML = recs.map(r => `<div class="est-row">
        <span class="est-month">${r.month}</span>
        <span class="est-total">${r.estimate?Number(String(r.estimate).replace(/,/g,'')).toLocaleString():'-'}</span>
        <span class="est-val">${r.material?Number(String(r.material).replace(/,/g,'')).toLocaleString():'-'}</span>
        <span class="est-val">${r.zhongzheng?Number(String(r.zhongzheng).replace(/,/g,'')).toLocaleString():'-'}</span>
        <span class="est-val">${r.clinic?Number(String(r.clinic).replace(/,/g,'')).toLocaleString():'-'}</span>
        <span class="est-val">${r.youchang?Number(String(r.youchang).replace(/,/g,'')).toLocaleString():'-'}</span>
      </div>`).join('');
    } catch(e) { el.innerHTML = this.err(e); }
  },

  // ── Clinic (unified scroll) ──
  async loadClinic() {
    const el = document.getElementById('clinic-content');
    el.innerHTML = this.loading();
    try {
      const [products, records] = await Promise.all([SHEETS.loadClinicProducts(), SHEETS.loadClinicRecords()]);
      this._clinicProds = products;
      let html = '';

      // Price list section
      html += `<div class="clinic-section-hdr">自費項目</div>`;
      products.forEach(r => {
        const cleanP = String(r.price||'').replace(/,/g,'').trim();
        html += `<div class="list-row">
          <span class="col-product" style="font-weight:600">${r.name}</span>
          <button class="add-center-btn" onclick="APP.qAddClinic('${r.name.replace(/'/g,"\\'")}','${cleanP}')" title="快速新增門診記錄">＋</button>
          <span class="col-price">${cleanP?'$'+Number(cleanP).toLocaleString():'免費'}</span>
        </div>`;
      });

      // Records section
      html += `<div class="clinic-section-hdr">門診記錄</div>`;
      let filteredRecs = this.filterBySearch(records, ['product','date']);
      this.groupByMonth(filteredRecs).forEach(([m,rows]) => {
        const mTotal = rows.reduce((s,r)=>{
          const p=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const q=parseInt(r.qty)||1;
          return s+p*q;
        },0);
        html += `<div class="list-group-hdr sticky-hdr">${m} <span class="month-badge">$${mTotal.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          const isNew=r.todayNew?.toString().toUpperCase()==='TRUE';
          const enc=encodeURIComponent(JSON.stringify(r));
          const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
          const rowTotal=cleanP*(parseInt(r.qty)||1);
          html += `<div class="list-row${isNew?' row-new':''}" onclick="APP.openDetail('clinic',${JSON.stringify(enc)})">
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

  // ── Universal Detail Modal ──
  openDetail(type, encoded) {
    const r = JSON.parse(decodeURIComponent(encoded));
    this._detailType = type;
    this._detailData = r;
    const modal = document.getElementById('modal-detail');
    const title = document.getElementById('detail-title');
    const body = document.getElementById('detail-body');
    const editBtn = document.getElementById('detail-edit-btn');

    const titles = { sx:'手術紀錄', track:'追蹤', mat:'骨材記錄', selfpay:'自費醫材', opcode:'OP代碼', coderec:'代碼紀錄', clinic:'門診記錄' };
    title.textContent = titles[type] || '詳情';

    const field = (label, val) => val ? `<div class="detail-field"><div class="detail-label">${label}</div><div class="detail-val">${val}</div></div>` : '';

    let content = '';
    if(type==='sx'||type==='track') {
      content = field('日期',r.date)+field('院區',r.area)+(type==='track'?field('病歷號',r.mrn)+field('診所ID',r.clinicId):'')+field('姓名',r.name)+field('類型',r.type)+field('手術名稱',r.opName)+field('部位',r.location)+field('骨材',r.implant)+field('備註',r.note);
    } else if(type==='mat') {
      const cleanP=parseFloat(String(r.price||0).replace(/,/g,''))||0;
      const total=cleanP*(parseInt(r.qty)||1);
      content = field('廠牌',r.brand)+field('產品',r.product)+field('日期',r.date)+field('單價',cleanP?'$'+cleanP.toLocaleString():'')+field('數量',r.qty)+field('總價',total?'$'+total.toLocaleString():'')+field('Done',r.done);
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
    body.innerHTML = content;
    editBtn.style.display = '';
    modal.classList.add('open');
  },

  openEdit() {
    const type = this._detailType;
    const r = this._detailData;
    this.closeModal('modal-detail');
    const editModalMap = { sx:'modal-edit-sx', track:'modal-edit-track', mat:'modal-edit-mat', selfpay:'modal-edit-selfpay', opcode:'modal-edit-opcode', coderec:'modal-edit-coderec', clinic:'modal-edit-clinic' };
    const m = editModalMap[type];
    if(!m) return;

    // Populate fields
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
        document.getElementById('et-mrn').value     = r.mrn||'';
        document.getElementById('et-clinicid').value= r.clinicId||'';
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
    // clinic: A=日期,B=產品,C=單價,D=數量,E=UsageID,F=今日新增
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

  // ── New record modals ──
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
  selectArea(el,v){document.querySelectorAll('.area-chip').forEach(c=>c.classList.remove('on'));el.classList.add('on');document.getElementById('s-area-val').value=v;},
  selectType(el,type){
    document.querySelectorAll('.type-chip').forEach(c=>c.classList.remove('on'));el.classList.add('on');
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

  // ── Modal helpers ──
  openModal(id){
    document.getElementById(id).classList.add('open');
    document.querySelectorAll(`#${id} input[type="date"]`).forEach(el=>el.value=this.todayISO());
  },
  closeModal(id){document.getElementById(id).classList.remove('open');},

  // ── Toast ──
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
