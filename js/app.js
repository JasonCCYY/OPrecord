// ── Ortho Record App ──
const APP = {
  currentTab: 'surgery',      // surgery | material | clinic
  currentSubTab: {
    material: 'matRecord',    // matRecord | selfPay | opCode | codeRecord | estimate
    clinic: 'clinicPrice',    // clinicPrice | clinicRecord
  },
  data: {},
  currentMonth: null,

  // ── Init ──
  async init() {
    this.showLoading(true);
    await AUTH.init();
    this.bindBottomTabs();
    this.bindSubTabs();
    this.bindFAB();
    this.showLoading(false);

    if (!AUTH.isSignedIn()) {
      this.showAuthScreen();
    }
  },

  onAuthSuccess() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.updateMonth();
    this.switchTab('surgery');
  },

  showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  showLoading(v) {
    document.getElementById('loading').style.display = v ? 'flex' : 'none';
  },

  updateMonth() {
    const now = new Date();
    const m = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    document.getElementById('header-month').textContent = m;
    this.currentMonth = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
  },

  today() {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
  },

  // ── Tab Switching ──
  bindBottomTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    // Header title
    const titles = { surgery: '手術紀錄', material: '醫材管理', clinic: '門診' };
    document.getElementById('header-title').textContent = titles[tab];

    // Sub tabs visibility
    document.getElementById('sub-material').style.display = tab === 'material' ? 'flex' : 'none';
    document.getElementById('sub-clinic').style.display = tab === 'clinic' ? 'flex' : 'none';

    // Pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    if (tab === 'surgery') {
      document.getElementById('page-surgery').classList.add('active');
      this.loadSurgery();
    } else if (tab === 'material') {
      this.switchMaterialTab(this.currentSubTab.material);
    } else if (tab === 'clinic') {
      this.switchClinicTab(this.currentSubTab.clinic);
    }

    // FAB visibility
    document.getElementById('fab').style.display =
      (tab === 'surgery' || tab === 'material' || tab === 'clinic') ? 'flex' : 'none';
  },

  bindSubTabs() {
    document.querySelectorAll('#sub-material .sub-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchMaterialTab(btn.dataset.sub));
    });
    document.querySelectorAll('#sub-clinic .sub-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchClinicTab(btn.dataset.sub));
    });
  },

  switchMaterialTab(sub) {
    this.currentSubTab.material = sub;
    document.querySelectorAll('#sub-material .sub-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.sub === sub));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const pageMap = {
      matRecord: 'page-mat-record',
      selfPay: 'page-selfpay',
      opCode: 'page-opcode',
      codeRecord: 'page-code-record',
      estimate: 'page-estimate'
    };
    document.getElementById(pageMap[sub])?.classList.add('active');

    const loaders = {
      matRecord: () => this.loadMatRecords(),
      selfPay: () => this.loadSelfPay(),
      opCode: () => this.loadOpCodes(),
      codeRecord: () => this.loadCodeRecords(),
      estimate: () => this.loadEstimate()
    };
    loaders[sub]?.();
  },

  switchClinicTab(sub) {
    this.currentSubTab.clinic = sub;
    document.querySelectorAll('#sub-clinic .sub-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.sub === sub));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    if (sub === 'clinicPrice') {
      document.getElementById('page-clinic-price').classList.add('active');
      this.loadClinicProducts();
    } else {
      document.getElementById('page-clinic-record').classList.add('active');
      this.loadClinicRecords();
    }
  },

  // ── FAB ──
  bindFAB() {
    document.getElementById('fab').addEventListener('click', () => {
      if (this.currentTab === 'surgery') this.openAddSurgery();
      else if (this.currentTab === 'material') {
        const sub = this.currentSubTab.material;
        if (sub === 'matRecord') this.openAddMatRecord();
        else if (sub === 'codeRecord') this.openAddCodeRecord();
      } else if (this.currentTab === 'clinic') {
        this.openAddClinicRecord();
      }
    });
  },

  // ── Surgery ──
  async loadSurgery() {
    const el = document.getElementById('surgery-list');
    el.innerHTML = '<div class="loading-text" style="padding:20px;text-align:center;color:var(--text-muted)">載入中...</div>';
    try {
      const records = await SHEETS.loadOpRecords();
      this.data.surgery = records;
      el.innerHTML = '';
      if (!records.length) { el.innerHTML = this.emptyHTML(); return; }
      let lastMonth = '';
      records.forEach(r => {
        const month = r.date.substring(0, 7);
        if (month !== lastMonth) {
          lastMonth = month;
          // count
          const cnt = records.filter(x => x.date.startsWith(month)).length;
          el.innerHTML += this.monthHeaderHTML(month, cnt);
        }
        el.innerHTML += this.surgeryCardHTML(r);
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  monthHeaderHTML(month, count) {
    return `<div class="month-header">${month} <span class="month-badge">${count}</span></div>`;
  },

  surgeryCardHTML(r) {
    const day = r.date.substring(5);
    return `
    <div class="record-card">
      <div class="record-date">${day}</div>
      <div class="record-info">
        <div class="record-name">${r.name}</div>
        <div class="record-sub">${r.area}${r.procedure ? ' · ' + r.procedure : ''}</div>
      </div>
      <span class="type-badge type-${r.type}">${r.type}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </div>`;
  },

  emptyHTML() {
    return `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">尚無紀錄</div></div>`;
  },

  // ── Material Records ──
  async loadMatRecords() {
    const el = document.getElementById('mat-record-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const records = await SHEETS.loadMatRecords();
      this.data.matRecords = records;
      el.innerHTML = '';
      if (!records.length) { el.innerHTML = this.emptyHTML(); return; }

      let lastMonth = '';
      let monthTotal = 0;
      let monthStartIdx = 0;

      // Group by month with totals
      const groups = {};
      records.forEach(r => {
        const month = r.date.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(r);
      });

      Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).forEach(([month, rows]) => {
        const total = rows.reduce((s, r) => s + (parseFloat(r.price) * parseInt(r.qty || 1) || 0), 0);
        el.innerHTML += `<div class="month-header">${month} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          el.innerHTML += `
          <div class="item-row">
            <div class="item-brand">${r.brand}</div>
            <div class="item-product">${r.product}</div>
            <div class="item-qty">${r.qty}</div>
            <div class="item-price">${r.price ? '$'+Number(r.price).toLocaleString() : ''}</div>
            <div class="item-action">⬇</div>
          </div>`;
        });
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Self-pay ──
  async loadSelfPay() {
    const el = document.getElementById('selfpay-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const items = await SHEETS.loadSelfPay();
      this.data.selfPay = items;
      el.innerHTML = '';
      if (!items.length) { el.innerHTML = this.emptyHTML(); return; }

      // Group by brand
      const groups = {};
      items.forEach(r => {
        if (!groups[r.brand]) groups[r.brand] = [];
        groups[r.brand].push(r);
      });

      Object.entries(groups).forEach(([brand, rows]) => {
        el.innerHTML += `<div class="month-header">${brand} <span class="month-badge">${rows.length}</span></div>`;
        rows.forEach(r => {
          el.innerHTML += `
          <div class="selfpay-row">
            <div style="font-size:0.78rem;color:var(--text-muted)">${r.brand}</div>
            <div style="font-size:0.9rem;color:var(--text-primary)">${r.product}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:var(--accent-2);text-align:right">$${Number(r.price).toLocaleString()}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);text-align:right">${r.hospital}</div>
          </div>`;
        });
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── OP Codes ──
  async loadOpCodes() {
    const el = document.getElementById('opcode-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const items = await SHEETS.loadOpCodes();
      this.data.opCodes = items;
      el.innerHTML = '';
      if (!items.length) { el.innerHTML = this.emptyHTML(); return; }

      const groups = {};
      items.forEach(r => {
        if (!groups[r.area]) groups[r.area] = [];
        groups[r.area].push(r);
      });

      Object.entries(groups).forEach(([area, rows]) => {
        el.innerHTML += `<div class="month-header">${area || '通用'}</div>`;
        rows.forEach(r => {
          el.innerHTML += `
          <div class="item-row">
            <div class="item-brand" style="font-family:'JetBrains Mono',monospace;font-size:0.78rem">${r.code}</div>
            <div class="item-product">${r.name}</div>
            <div class="item-price">$${Number(r.price).toLocaleString()}</div>
          </div>`;
        });
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Code Records ──
  async loadCodeRecords() {
    const el = document.getElementById('code-record-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const records = await SHEETS.loadCodeRecords();
      this.data.codeRecords = records;
      el.innerHTML = '';
      if (!records.length) { el.innerHTML = this.emptyHTML(); return; }

      const groups = {};
      records.forEach(r => {
        const month = r.date.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(r);
      });

      Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).forEach(([month, rows]) => {
        const total = rows.reduce((s,r) => s + (parseFloat(r.price) * parseInt(r.qty||1) || 0), 0);
        el.innerHTML += `<div class="month-header">${month} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          el.innerHTML += `
          <div class="code-row">
            <div class="code-name">${r.name}</div>
            <div class="code-id">${r.code}</div>
            <div class="code-price">$${Number(r.price).toLocaleString()}</div>
            <div class="code-qty">${r.qty}</div>
            <div class="code-area">${r.area}</div>
          </div>`;
        });
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Estimate ──
  async loadEstimate() {
    const el = document.getElementById('estimate-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const records = await SHEETS.loadEstimate();
      el.innerHTML = '';
      if (!records.length) { el.innerHTML = this.emptyHTML(); return; }
      records.forEach(r => {
        el.innerHTML += `
        <div class="estimate-row">
          <div class="est-month">${r.month}</div>
          <div class="est-total">${r.estimate ? Number(r.estimate).toLocaleString() : '-'}</div>
          <div class="est-val">${r.material ? Number(r.material).toLocaleString() : '-'}</div>
          <div class="est-val">${r.zhongzheng ? Number(r.zhongzheng).toLocaleString() : '-'}</div>
        </div>`;
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Clinic Products (price list) ──
  async loadClinicProducts() {
    const el = document.getElementById('clinic-price-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const items = await SHEETS.loadClinicProducts();
      this.data.clinicProducts = items;
      el.innerHTML = '';
      if (!items.length) { el.innerHTML = this.emptyHTML(); return; }
      items.forEach(r => {
        el.innerHTML += `
        <div class="clinic-price-item">
          <div class="clinic-item-name">${r.name}</div>
          <div class="clinic-item-price">${r.price ? '$'+Number(r.price).toLocaleString() : '免費'}</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>`;
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Clinic Records ──
  async loadClinicRecords() {
    const el = document.getElementById('clinic-record-list');
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">載入中...</div>';
    try {
      const records = await SHEETS.loadClinicRecords();
      el.innerHTML = '';
      if (!records.length) { el.innerHTML = this.emptyHTML(); return; }

      const groups = {};
      records.forEach(r => {
        const month = r.date.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(r);
      });

      Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).forEach(([month, rows]) => {
        const total = rows.reduce((s,r) => s + (parseFloat(r.total) || 0), 0);
        el.innerHTML += `<div class="month-header">${month} <span class="month-badge">$${total.toLocaleString()}</span></div>`;
        rows.forEach(r => {
          el.innerHTML += `
          <div class="item-row">
            <div class="item-brand" style="width:52px;font-size:0.75rem;color:var(--text-muted)">${r.date.substring(5)}</div>
            <div class="item-product">${r.product}</div>
            <div class="item-qty">${r.qty}</div>
            <div class="item-price">${r.total ? '$'+Number(r.total).toLocaleString() : ''}</div>
          </div>`;
        });
      });
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">${e.message}</div></div>`;
    }
  },

  // ── Modals ──
  openModal(id) { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  openAddSurgery() { this.openModal('modal-surgery'); },
  openAddMatRecord() { this.openModal('modal-mat'); },
  openAddCodeRecord() { this.openModal('modal-code'); },
  openAddClinicRecord() { this.openModal('modal-clinic'); },

  async saveSurgery() {
    const data = {
      date: document.getElementById('s-date').value.replace(/-/g, '/'),
      area: document.getElementById('s-area').value,
      name: document.getElementById('s-name').value,
      type: document.getElementById('s-type').value,
      procedure: document.getElementById('s-procedure').value,
      note: document.getElementById('s-note').value
    };
    if (!data.date || !data.name) { this.toast('請填入日期和姓名'); return; }
    try {
      await SHEETS.addOpRecord(data);
      this.closeModal('modal-surgery');
      this.toast('✅ 手術紀錄已儲存');
      this.loadSurgery();
    } catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveMat() {
    const data = {
      date: document.getElementById('m-date').value.replace(/-/g, '/'),
      brand: document.getElementById('m-brand').value,
      product: document.getElementById('m-product').value,
      qty: document.getElementById('m-qty').value,
      price: document.getElementById('m-price').value
    };
    if (!data.date || !data.product) { this.toast('請填入日期和產品'); return; }
    try {
      await SHEETS.addMatRecord(data);
      this.closeModal('modal-mat');
      this.toast('✅ 醫材紀錄已儲存');
      this.loadMatRecords();
    } catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveCode() {
    const data = {
      date: document.getElementById('c-date').value.replace(/-/g, '/'),
      name: document.getElementById('c-name').value,
      code: document.getElementById('c-code').value,
      price: document.getElementById('c-price').value,
      qty: document.getElementById('c-qty').value,
      area: document.getElementById('c-area').value
    };
    if (!data.date || !data.code) { this.toast('請填入日期和代碼'); return; }
    try {
      await SHEETS.addCodeRecord(data);
      this.closeModal('modal-code');
      this.toast('✅ 代碼紀錄已儲存');
      this.loadCodeRecords();
    } catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  async saveClinic() {
    const data = {
      date: document.getElementById('cl-date').value.replace(/-/g, '/'),
      product: document.getElementById('cl-product').value,
      qty: document.getElementById('cl-qty').value,
      total: document.getElementById('cl-total').value
    };
    if (!data.date || !data.product) { this.toast('請填入日期和產品'); return; }
    try {
      await SHEETS.addClinicRecord(data);
      this.closeModal('modal-clinic');
      this.toast('✅ 門診紀錄已儲存');
      this.loadClinicRecords();
    } catch(e) { this.toast('❌ 儲存失敗: ' + e.message); }
  },

  // Auto calculate clinic total
  calcClinicTotal() {
    const prod = document.getElementById('cl-product').value;
    const qty = parseInt(document.getElementById('cl-qty').value) || 1;
    if (this.data.clinicProducts) {
      const found = this.data.clinicProducts.find(p => p.name === prod);
      if (found) {
        document.getElementById('cl-total').value = (parseFloat(found.price) * qty) || 0;
      }
    }
  },

  // ── Toast ──
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  },

  // ── Refresh ──
  refresh() {
    const tab = this.currentTab;
    if (tab === 'surgery') this.loadSurgery();
    else if (tab === 'material') this.switchMaterialTab(this.currentSubTab.material);
    else if (tab === 'clinic') this.switchClinicTab(this.currentSubTab.clinic);
    this.toast('🔄 重新載入');
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date in all date inputs
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => el.value = today);

  APP.init();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
});
