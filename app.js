/**
 * People Management 2.0
 * Gestão contemporânea de pessoas — Bússola Executiva
 *
 * SUPABASE: Autenticação, controle de acesso e isolamento por company_id
 * serão implementados nas funções marcadas com [SUPABASE]
 */

const STORAGE_KEY = 'pm20_data';
const ONBOARDING_KEY = 'pm20_onboarding_done';
const CHARTS = {};

function getOnboardingKey() {
  if (typeof Auth !== 'undefined' && Auth.user?.id) {
    return `${ONBOARDING_KEY}_${Auth.user.id}`;
  }
  return ONBOARDING_KEY;
}

const LABELS = {
  status: {
    alta_performance: 'Alta Performance', desenvolvimento: 'Em Desenvolvimento',
    atencao: 'Atenção', suporte: 'Necessita Suporte', talento: 'Talento'
  },
  inputType: {
    performance: 'Performance', comportamento: 'Comportamento', desenvolvimento: 'Desenvolvimento',
    reconhecimento: 'Reconhecimento', atencao: 'Atenção', oportunidade: 'Oportunidade',
    risco_sobrecarga: 'Risco de Sobrecarga', feedback: 'Feedback', alinhamento: 'Alinhamento',
    plano_acao: 'Plano de Ação'
  },
  eventType: {
    '1_1_realizada': '1:1 Realizada', feedback_aplicado: 'Feedback Aplicado',
    entrega_relevante: 'Entrega Relevante', mudanca_comportamento: 'Mudança de Comportamento',
    treinamento_recomendado: 'Treinamento Recomendado', reconhecimento: 'Reconhecimento',
    alerta_risco: 'Alerta de Risco', plano_acao_criado: 'Plano de Ação Criado',
    evolucao_observada: 'Evolução Observada', reuniao_alinhamento: 'Reunião de Alinhamento',
    follow_up_pendente: 'Follow-up Pendente', material_bussola: 'Material Biblioteca BE Recomendado'
  },
  challengeCategory: {
    ponto_desenvolvimento: 'Ponto de Desenvolvimento', oportunidade_carreira: 'Oportunidade de Carreira',
    risco_organizacional: 'Risco Organizacional', barreira_performance: 'Barreira de Performance',
    necessidade_treinamento: 'Necessidade de Treinamento', lacuna_processo: 'Lacuna de Processo',
    conflito_desalinhamento: 'Conflito/Desalinhamento', recomendacao_gestor: 'Recomendação do Gestor'
  },
  materialTheme: {
    lideranca: 'Liderança', comunicacao: 'Comunicação', influencia: 'Influência',
    gestao_conflitos: 'Gestão de Conflitos', tomada_decisao: 'Tomada de Decisão',
    performance: 'Performance', cultura: 'Cultura', feedback: 'Feedback',
    inteligencia_emocional: 'Inteligência Emocional', gestao_mudanca: 'Gestão de Mudança',
    produtividade: 'Produtividade', estrategia: 'Estratégia'
  },
  materialType: { texto: 'Texto', pdf: 'PDF', link: 'Link', video: 'Vídeo', framework: 'Framework', anotacao: 'Anotação' }
};

const BEHAVIORAL_TAGS = [
  'Comunicação', 'Autonomia', 'Entrega', 'Colaboração', 'Liderança', 'Organização',
  'Pressão', 'Aprendizado', 'Postura', 'Protagonismo', 'Resolução de problemas',
  'Relacionamento', 'Visão sistêmica', 'Execução'
];

const GOVERNANCE_ITEMS = [
  { icon: '📋', title: 'Registrar fatos, não julgamentos', text: 'Baseie registros em comportamentos e resultados observáveis, não em interpretações pessoais.' },
  { icon: '🔍', title: 'Evitar opiniões sem evidência', text: 'Toda avaliação deve ser sustentada por exemplos concretos e contexto verificável.' },
  { icon: '🏥', title: 'Não registrar informações médicas', text: 'Evite dados de saúde, diagnósticos ou informações clínicas sensíveis.' },
  { icon: '🤝', title: 'Não usar termos discriminatórios', text: 'Mantenha linguagem respeitosa, inclusiva e profissional em todos os registros.' },
  { icon: '🔒', title: 'Não expor informações desnecessárias', text: 'Registre apenas o necessário para desenvolvimento e gestão do time.' },
  { icon: '🌱', title: 'Ferramenta de desenvolvimento', text: 'Use para crescimento e apoio, nunca como instrumento de punição.' },
  { icon: '🛡️', title: 'Proteger dados pessoais', text: 'Em conformidade com a LGPD, trate dados com responsabilidade e sigilo.' },
  { icon: '📤', title: 'Exportação autorizada', text: 'Exporte informações apenas para uso interno autorizado pela empresa.' },
  { icon: '🏢', title: 'Segregação de acesso', text: 'Futuramente, dados serão isolados por empresa, time e perfil de acesso via Supabase.' }
];

let state = { company: {}, employees: [], manager_inputs: [], timeline: [], challenges: [], compass_materials: [] };

// ─── Persistência ───────────────────────────────────────────────

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowISO() { return new Date().toISOString(); }

function metaFields(overrides = {}) {
  const userId = (typeof Auth !== 'undefined' && Auth.user?.id) || state.company?.user_id || 'user-local';
  const companyId = (typeof Auth !== 'undefined' && Auth.profile?.company_id) || state.company?.company_id || 'comp-local';
  const role = (typeof Auth !== 'undefined' && Auth.profile?.role) || state.company?.role || 'company_manager';
  return {
    company_id: companyId,
    user_id: userId,
    role,
    manager_id: state.company?.user_id || 'user-local',
    team_id: state.company?.team_id || 'team-local',
    created_by: state.company?.user_id || 'user-local',
    updated_by: state.company?.user_id || 'user-local',
    created_at: nowISO(),
    updated_at: nowISO(),
    ...overrides
  };
}

let saveCloudTimer;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('Erro ao salvar dados. Espaço insuficiente?', 'error');
  }
  if (typeof Auth !== 'undefined' && Auth.isApproved?.()) {
    clearTimeout(saveCloudTimer);
    saveCloudTimer = setTimeout(() => Auth.saveAppData(state), 1500);
  }
}

async function loadStateForUser() {
  if (typeof Auth !== 'undefined' && Auth.isApproved?.() && Auth.profile?.company_id) {
    const cloud = await Auth.loadAppData();
    if (cloud) {
      state = cloud;
      normalizeState();
      return;
    }
  }
  await loadState();
  if (typeof Auth !== 'undefined' && Auth.user) {
    if (!state.company) state.company = {};
    state.company.user_id = Auth.user.id;
    if (Auth.profile?.company_id) {
      state.company.company_id = Auth.profile.company_id;
      state.company.supabase_id = Auth.profile.company_id;
    }
    if (Auth.profile?.role) state.company.role = Auth.profile.role;
  }
}

async function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { state = JSON.parse(stored); return; } catch (e) { /* fallback */ }
  }
  state = { company: {}, employees: [], manager_inputs: [], timeline: [], challenges: [], compass_materials: [] };
}

async function loadDemoData() {
  try {
    const res = await fetch('data.json');
    if (res.ok) state = await res.json();
  } catch (e) {
    console.warn('data.json não carregado.');
  }
}

function isOnboardingComplete() {
  return localStorage.getItem(getOnboardingKey()) === 'true';
}

function normalizeState() {
  if (!state.company) state.company = {};
  if (!state.employees) state.employees = [];
  if (!state.manager_inputs) state.manager_inputs = [];
  if (!state.timeline) state.timeline = [];
  if (!state.challenges) state.challenges = [];
  if (!state.compass_materials) state.compass_materials = [];
}

// [SUPABASE] Filtrar todos os dados por company_id do usuário autenticado
function getCompanyData(collection) {
  const cid = state.company?.company_id;
  if (!cid) return state[collection] || [];
  return (state[collection] || []).filter(i => !i.company_id || i.company_id === cid);
}

// ─── Utilitários ────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function getEmployee(id) {
  return getCompanyData('employees').find(e => e.id === id);
}

function getEmployeeName(id) {
  const e = getEmployee(id);
  return e ? e.name : '—';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch { return d; }
}

function avg(arr) {
  const v = arr.filter(n => typeof n === 'number' && !isNaN(n));
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '0.0';
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function applyTheme() {
  const color = state.company?.primary_color || '#3b82f6';
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--blue-deep', color);
  const logo = document.getElementById('header-logo');
  if (state.company?.logo) {
    logo.src = state.company.logo;
    logo.hidden = false;
  } else { logo.hidden = true; }
  document.getElementById('header-company-name').textContent =
    state.company?.name || 'People Management 2.0';
  const mgr = state.company?.manager_name || '';
  const team = state.company?.team_name || '';
  document.getElementById('header-team-info').textContent =
    mgr && team ? `${team} · Gestor: ${mgr}` : (mgr || team || 'Configure sua empresa para começar');
  document.getElementById('dashboard-subtitle').textContent =
    team ? `Visão consolidada — ${team}` : 'Visão consolidada do time';
}

// ─── Navegação ──────────────────────────────────────────────────

const NAV_CATEGORIES_KEY = 'pm20_nav_categories';

function navigateToSection(sec) {
  const item = document.querySelector(`.nav-item[data-section="${sec}"]`);
  if (!item) return;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  item.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${sec}`).classList.add('active');
  renderSection(sec);
  expandCategoryForSection(sec);
  saveNavCategoriesState();
  document.getElementById('sidebar').classList.remove('open');
}

function setCategoryExpanded(categoryEl, expanded) {
  if (!categoryEl) return;
  categoryEl.classList.toggle('expanded', expanded);
  const btn = categoryEl.querySelector('.nav-category-btn');
  if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function expandCategoryForSection(sec) {
  const item = document.querySelector(`.nav-item[data-section="${sec}"]`);
  const category = item?.closest('.nav-category');
  if (category) setCategoryExpanded(category, true);
}

function saveNavCategoriesState() {
  const state = {};
  document.querySelectorAll('.nav-category').forEach(cat => {
    state[cat.dataset.category] = cat.classList.contains('expanded');
  });
  try { localStorage.setItem(NAV_CATEGORIES_KEY, JSON.stringify(state)); } catch (_) {}
}

function loadNavCategoriesState() {
  try {
    const raw = localStorage.getItem(NAV_CATEGORIES_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    document.querySelectorAll('.nav-category').forEach(cat => {
      const key = cat.dataset.category;
      if (key in state) setCategoryExpanded(cat, state[key]);
    });
    return true;
  } catch { return false; }
}

function initNavigation() {
  document.querySelectorAll('.nav-category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.closest('.nav-category');
      const willExpand = !category.classList.contains('expanded');
      setCategoryExpanded(category, willExpand);
      saveNavCategoriesState();
    });
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateToSection(item.dataset.section);
    });
  });

  loadNavCategoriesState();

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('btn-quick-summary').addEventListener('click', () => {
    navigateToSection('summary');
    generateExecutiveSummary();
  });
}

function renderSection(sec) {
  const map = {
    dashboard: renderDashboard, company: renderCompany, employees: renderEmployees,
    gallery: renderGallery, inputs: renderInputs, timeline: renderTimeline,
    challenges: renderChallenges, compass: renderCompass, nr1: renderNR1,
    summary: () => {}, governance: renderGovernance, data: () => {},
    access: () => { if (typeof loadAccessAdminPanel === 'function') loadAccessAdminPanel(); }
  };
  if (map[sec]) map[sec]();
}

// ─── Modal ─────────────────────────────────────────────────────

function openModal(title, bodyHTML, footerHTML = '', large = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  document.getElementById('modal').classList.toggle('modal-lg', large);
  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  Object.values(CHARTS).forEach(c => { if (c._pmModal) { c.destroy(); delete CHARTS[c.canvas.id]; } });
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── Empresa ───────────────────────────────────────────────────

function renderCompany() {
  const c = state.company || {};
  document.getElementById('company-name').value = c.name || '';
  document.getElementById('manager-name').value = c.manager_name || '';
  document.getElementById('team-name').value = c.team_name || '';
  document.getElementById('primary-color').value = c.primary_color || '#1a3a5c';
  const prev = document.getElementById('logo-preview');
  prev.innerHTML = c.logo ? `<img src="${c.logo}" alt="Logo">` : '';
}

function initCompanyForm() {
  const fields = ['company-name', 'manager-name', 'team-name', 'primary-color'];
  fields.forEach(id => {
    document.getElementById(id).addEventListener('input', saveCompany);
    document.getElementById(id).addEventListener('change', saveCompany);
  });
  document.getElementById('company-logo').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (!state.company) state.company = {};
      state.company.logo = ev.target.result;
      saveState();
      applyTheme();
      renderCompany();
      showToast('Logo atualizado!');
    };
    reader.readAsDataURL(file);
  });
}

function saveCompany() {
  if (!state.company) state.company = metaFields({ company_id: generateId('comp') });
  state.company.name = document.getElementById('company-name').value;
  state.company.manager_name = document.getElementById('manager-name').value;
  state.company.team_name = document.getElementById('team-name').value;
  state.company.primary_color = document.getElementById('primary-color').value;
  state.company.updated_at = nowISO();
  saveState();
  applyTheme();
  if (typeof Auth !== 'undefined' && Auth.isApproved?.()) {
    Auth.saveCompanyToSupabase(state.company).then(row => {
      if (row?.id) {
        state.company.supabase_id = row.id;
        state.company.company_id = row.id;
      }
    }).catch(err => console.warn('Sync empresa:', err.message));
  }
}

// ─── Dashboard ─────────────────────────────────────────────────

function renderDashboard() {
  const emps = getCompanyData('employees');
  const inputs = getCompanyData('manager_inputs');
  const now = new Date();
  const monthInputs = inputs.filter(i => {
    const d = new Date(i.date || i.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const openActions = inputs.filter(i => i.status === 'aberto' || i.status === 'em_andamento');
  const doneActions = inputs.filter(i => i.status === 'concluido');

  const kpis = [
    { label: 'Colaboradores', value: emps.length, cls: '' },
    { label: 'Alta Performance', value: emps.filter(e => e.status === 'alta_performance').length, cls: 'green' },
    { label: 'Em Desenvolvimento', value: emps.filter(e => e.status === 'desenvolvimento').length, cls: 'blue' },
    { label: 'Em Atenção', value: emps.filter(e => e.status === 'atencao').length, cls: 'amber' },
    { label: 'Necessita Suporte', value: emps.filter(e => e.status === 'suporte').length, cls: 'red' },
    { label: 'Média Técnica', value: avg(emps.map(e => e.technical_level)), cls: '' },
    { label: 'Média Comportamental', value: avg(emps.map(e => e.behavioral_level)), cls: '' },
    { label: 'Média Autonomia', value: avg(emps.map(e => e.autonomy_level)), cls: '' },
    { label: 'Média Colaboração', value: avg(emps.map(e => e.collaboration_level)), cls: '' },
    { label: 'Inputs no Mês', value: monthInputs.length, cls: '' },
    { label: 'Planos em Aberto', value: openActions.length, cls: 'amber' },
    { label: 'Planos Concluídos', value: doneActions.length, cls: 'green' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>`).join('');

  renderCharts(emps, inputs);
}

function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
}

function renderCharts(emps, inputs) {
  const color = state.company?.primary_color || '#3b82f6';
  const names = emps.map(e => e.name.split(' ')[0]);
  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(56,189,248,0.08)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(56,189,248,0.08)' } }
    }
  };

  destroyChart('chart-technical');
  CHARTS['chart-technical'] = new Chart(document.getElementById('chart-technical'), {
    type: 'bar',
    data: { labels: names, datasets: [{ label: 'Técnico', data: emps.map(e => e.technical_level || 0), backgroundColor: color }] },
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, min: 0, max: 5 } }, plugins: { legend: { display: false } } }
  });

  destroyChart('chart-behavioral');
  CHARTS['chart-behavioral'] = new Chart(document.getElementById('chart-behavioral'), {
    type: 'bar',
    data: { labels: names, datasets: [{ label: 'Comportamental', data: emps.map(e => e.behavioral_level || 0), backgroundColor: '#38bdf8' }] },
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, min: 0, max: 5 } }, plugins: { legend: { display: false } } }
  });

  const statusCounts = {};
  emps.forEach(e => { const s = e.status || 'outro'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  destroyChart('chart-status');
  CHARTS['chart-status'] = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts).map(k => LABELS.status[k] || k),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#34d399','#fbbf24','#f87171','#60a5fa','#64748b'] }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
  });

  const areaCounts = {};
  emps.forEach(e => { const a = e.area || 'Sem área'; areaCounts[a] = (areaCounts[a] || 0) + 1; });
  destroyChart('chart-area');
  CHARTS['chart-area'] = new Chart(document.getElementById('chart-area'), {
    type: 'pie',
    data: { labels: Object.keys(areaCounts), datasets: [{ data: Object.values(areaCounts), backgroundColor: ['#3b82f6','#38bdf8','#34d399','#fbbf24','#f87171'] }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
  });

  const open = inputs.filter(i => i.status !== 'concluido').length;
  const done = inputs.filter(i => i.status === 'concluido').length;
  destroyChart('chart-actions');
  CHARTS['chart-actions'] = new Chart(document.getElementById('chart-actions'), {
    type: 'bar',
    data: { labels: ['Abertas', 'Concluídas'], datasets: [{ data: [open, done], backgroundColor: ['#fbbf24', '#34d399'] }] },
    options: { ...chartOpts, plugins: { legend: { display: false } } }
  });

  const tagCounts = {};
  emps.forEach(e => (e.behavioral_tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  destroyChart('chart-opportunities');
  CHARTS['chart-opportunities'] = new Chart(document.getElementById('chart-opportunities'), {
    type: 'bar',
    data: { labels: sorted.map(s => s[0]), datasets: [{ label: 'Frequência', data: sorted.map(s => s[1]), backgroundColor: '#60a5fa' }] },
    options: { indexAxis: 'y', ...chartOpts, plugins: { legend: { display: false } } }
  });
}

// ─── Colaboradores ─────────────────────────────────────────────

function populateEmployeeFilters() {
  const emps = getCompanyData('employees');
  const areas = [...new Set(emps.map(e => e.area).filter(Boolean))];
  const areaSel = document.getElementById('filter-area');
  areaSel.innerHTML = '<option value="">Todas as áreas</option>' +
    areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  const statusSel = document.getElementById('filter-status');
  statusSel.innerHTML = '<option value="">Todos os status</option>' +
    Object.entries(LABELS.status).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}

function getFilteredEmployees() {
  const search = document.getElementById('employee-search')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-status')?.value || '';
  const area = document.getElementById('filter-area')?.value || '';
  const risk = document.getElementById('filter-risk')?.value || '';
  const exec = document.getElementById('filter-exec-status')?.value || '';
  return getCompanyData('employees').filter(e => {
    if (search && !e.name.toLowerCase().includes(search) && !(e.role_title || '').toLowerCase().includes(search)) return false;
    if (status && e.status !== status) return false;
    if (area && e.area !== area) return false;
    if (risk && e.overload_risk !== risk) return false;
    if (exec && e.executive_status !== exec) return false;
    return true;
  });
}

function renderEmployees() {
  populateEmployeeFilters();
  const emps = getFilteredEmployees();
  document.getElementById('employees-tbody').innerHTML = emps.length ? emps.map(e => `
    <tr>
      <td><strong>${esc(e.name)}</strong></td>
      <td>${esc(e.role_title)}</td>
      <td>${esc(e.area)}</td>
      <td><span class="badge badge-${e.status}">${LABELS.status[e.status] || e.status}</span></td>
      <td>${e.technical_level || '—'}</td>
      <td>${e.behavioral_level || '—'}</td>
      <td><span class="semaphore semaphore-${e.executive_status}"></span></td>
      <td class="actions">
        <button class="btn-icon" onclick="viewEmployee('${e.id}')" title="Ver perfil">👁️</button>
        <button class="btn-icon" onclick="editEmployee('${e.id}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="deleteEmployee('${e.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty-state">Nenhum colaborador encontrado.</td></tr>';
}

function employeeFormHTML(emp = {}) {
  const tags = BEHAVIORAL_TAGS.map(t => {
    const checked = (emp.behavioral_tags || []).includes(t) ? 'checked' : '';
    return `<label class="tag-checkbox"><input type="checkbox" name="tags" value="${t}" ${checked}> ${t}</label>`;
  }).join('');
  return `
    <div class="form-grid">
      <div class="form-group"><label>Nome *</label><input id="ef-name" value="${esc(emp.name || '')}" required></div>
      <div class="form-group"><label>Cargo</label><input id="ef-role" value="${esc(emp.role_title || '')}"></div>
      <div class="form-group"><label>Área/Célula</label><input id="ef-area" value="${esc(emp.area || '')}"></div>
      <div class="form-group"><label>Gestor</label><input id="ef-manager" value="${esc(emp.manager || state.company?.manager_name || '')}"></div>
      <div class="form-group"><label>Data de Entrada</label><input type="date" id="ef-entry" value="${emp.entry_date || ''}"></div>
      <div class="form-group"><label>Status</label><select id="ef-status">${Object.entries(LABELS.status).map(([k,v]) => `<option value="${k}" ${emp.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-group"><label>Semáforo Executivo</label><select id="ef-exec"><option value="verde" ${emp.executive_status==='verde'?'selected':''}>Verde</option><option value="amarelo" ${emp.executive_status==='amarelo'?'selected':''}>Amarelo</option><option value="vermelho" ${emp.executive_status==='vermelho'?'selected':''}>Vermelho</option><option value="azul" ${emp.executive_status==='azul'?'selected':''}>Azul</option></select></div>
      <div class="form-group"><label>Risco Sobrecarga</label><select id="ef-risk"><option value="baixo" ${emp.overload_risk==='baixo'?'selected':''}>Baixo</option><option value="medio" ${emp.overload_risk==='medio'?'selected':''}>Médio</option><option value="alto" ${emp.overload_risk==='alto'?'selected':''}>Alto</option></select></div>
    </div>
    <div class="form-row" style="margin-top:16px">
      ${['technical_level','behavioral_level','autonomy_level','collaboration_level','growth_potential','communication_level','delivery_level'].map(f => {
        const labels = { technical_level:'Técnico', behavioral_level:'Comport.', autonomy_level:'Autonomia', collaboration_level:'Colaboração', growth_potential:'Potencial', communication_level:'Comunicação', delivery_level:'Entrega' };
        return `<div class="form-group"><label>${labels[f]} (1-5)</label><input type="number" id="ef-${f}" min="1" max="5" value="${emp[f] || 3}"></div>`;
      }).join('')}
    </div>
    <div class="form-group full-width" style="margin-top:12px"><label>Pontos Fortes</label><textarea id="ef-strengths">${esc(emp.strengths || '')}</textarea></div>
    <div class="form-group full-width"><label>Pontos de Desenvolvimento</label><textarea id="ef-dev">${esc(emp.development_points || '')}</textarea></div>
    <div class="form-group full-width"><label>Oportunidades</label><textarea id="ef-opp">${esc(emp.opportunities || '')}</textarea></div>
    <div class="form-group full-width"><label>Resumo Executivo</label><textarea id="ef-summary">${esc(emp.executive_summary || '')}</textarea></div>
    <div class="form-group full-width"><label>Desafios Atuais</label><textarea id="ef-challenges">${esc(emp.current_challenges || '')}</textarea></div>
    <div class="form-group full-width"><label>Próximos Passos</label><textarea id="ef-next">${esc(emp.next_steps || '')}</textarea></div>
    <div class="form-group full-width"><label>Observações</label><textarea id="ef-obs">${esc(emp.observations || '')}</textarea></div>
    <div class="form-group full-width"><label>Tags Comportamentais</label><div class="tags-grid">${tags}</div></div>`;
}

function collectEmployeeForm() {
  const tags = [...document.querySelectorAll('input[name="tags"]:checked')].map(c => c.value);
  const data = {
    name: document.getElementById('ef-name').value.trim(),
    role_title: document.getElementById('ef-role').value.trim(),
    area: document.getElementById('ef-area').value.trim(),
    manager: document.getElementById('ef-manager').value.trim(),
    entry_date: document.getElementById('ef-entry').value,
    status: document.getElementById('ef-status').value,
    executive_status: document.getElementById('ef-exec').value,
    overload_risk: document.getElementById('ef-risk').value,
    strengths: document.getElementById('ef-strengths').value,
    development_points: document.getElementById('ef-dev').value,
    opportunities: document.getElementById('ef-opp').value,
    executive_summary: document.getElementById('ef-summary').value,
    current_challenges: document.getElementById('ef-challenges').value,
    next_steps: document.getElementById('ef-next').value,
    observations: document.getElementById('ef-obs').value,
    behavioral_tags: tags
  };
  ['technical_level','behavioral_level','autonomy_level','collaboration_level','growth_potential','communication_level','delivery_level'].forEach(f => {
    data[f] = parseInt(document.getElementById(`ef-${f}`).value) || 3;
  });
  return data;
}

window.editEmployee = function(id) {
  const emp = getEmployee(id);
  openModal('Editar Colaborador', employeeFormHTML(emp),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveEmployee('${id}')">Salvar</button>`, true);
};

window.saveEmployee = function(id) {
  const data = collectEmployeeForm();
  if (!data.name) { showToast('Nome é obrigatório.', 'error'); return; }
  const idx = state.employees.findIndex(e => e.id === id);
  if (idx >= 0) {
    state.employees[idx] = { ...state.employees[idx], ...data, updated_at: nowISO() };
  } else {
    state.employees.push({ id: generateId('emp'), ...metaFields(), ...data });
  }
  saveState(); closeModal(); renderEmployees();
  showToast(id ? 'Colaborador atualizado!' : 'Colaborador criado!');
};

window.deleteEmployee = function(id) {
  if (!confirm('Excluir este colaborador e seus vínculos?')) return;
  state.employees = state.employees.filter(e => e.id !== id);
  ['manager_inputs','timeline','challenges'].forEach(col => {
    state[col] = (state[col] || []).filter(i => i.employee_id !== id);
  });
  state.compass_materials = (state.compass_materials || []).map(m => ({
    ...m, associated_employees: (m.associated_employees || []).filter(eid => eid !== id)
  }));
  saveState(); renderEmployees();
  showToast('Colaborador excluído.');
};

window.viewEmployee = function(id) {
  const e = getEmployee(id);
  if (!e) return;
  const empInputs = getCompanyData('manager_inputs').filter(i => i.employee_id === id);
  const empTimeline = getCompanyData('timeline').filter(t => t.employee_id === id);
  const empMaterials = getCompanyData('compass_materials').filter(m => (m.associated_employees || []).includes(id));
  const tags = (e.behavioral_tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

  openModal(`Perfil — ${e.name}`, `
    <div class="profile-header">
      <div class="avatar profile-avatar">${getInitials(e.name)}</div>
      <div class="profile-info">
        <h3>${esc(e.name)}</h3>
        <p>${esc(e.role_title)} · ${esc(e.area)}</p>
        <span class="badge badge-${e.status}">${LABELS.status[e.status] || e.status}</span>
        <span class="semaphore semaphore-${e.executive_status}" style="margin-left:8px"></span>
      </div>
    </div>
    <div class="profile-grid">
      <div>
        <div class="profile-section"><h4>Resumo Executivo</h4><p>${esc(e.executive_summary) || '—'}</p></div>
        <div class="profile-section"><h4>Pontos Fortes</h4><p>${esc(e.strengths) || '—'}</p></div>
        <div class="profile-section"><h4>Desenvolvimento</h4><p>${esc(e.development_points) || '—'}</p></div>
        <div class="profile-section"><h4>Oportunidades</h4><p>${esc(e.opportunities) || '—'}</p></div>
        <div class="profile-section"><h4>Desafios Atuais</h4><p>${esc(e.current_challenges) || '—'}</p></div>
        <div class="profile-section"><h4>Próximos Passos</h4><p>${esc(e.next_steps) || '—'}</p></div>
        <div class="profile-section"><h4>Tags</h4><div class="profile-tags">${tags || '—'}</div></div>
      </div>
      <div>
        <div class="profile-section"><h4>Indicadores</h4>
          <p>Técnico: ${e.technical_level}/5 · Comportamental: ${e.behavioral_level}/5<br>
          Autonomia: ${e.autonomy_level}/5 · Colaboração: ${e.collaboration_level}/5<br>
          Potencial: ${e.growth_potential}/5 · Risco: ${e.overload_risk}</p>
        </div>
        <div class="profile-section radar-container"><h4>Radar Individual</h4><canvas id="profile-radar"></canvas></div>
        <div class="profile-section"><h4>Últimos Inputs (${empInputs.length})</h4>
          ${empInputs.slice(0,3).map(i => `<p style="font-size:12px;margin-bottom:6px"><strong>${formatDate(i.date)}</strong> — ${esc(i.description?.slice(0,80))}</p>`).join('') || '<p>—</p>'}
        </div>
        <div class="profile-section"><h4>Materiais Recomendados</h4>
          ${empMaterials.map(m => `<p style="font-size:12px">📚 ${esc(m.title)}</p>`).join('') || '<p>—</p>'}
        </div>
      </div>
    </div>
    <div class="profile-section" style="margin-top:16px"><h4>Timeline (${empTimeline.length} eventos)</h4>
      ${empTimeline.slice(0,5).map(t => `<p style="font-size:12px;margin-bottom:4px"><strong>${formatDate(t.date)}</strong> — ${LABELS.eventType[t.event_type] || t.event_type}: ${esc(t.description?.slice(0,60))}</p>`).join('') || '<p>—</p>'}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="closeModal();editEmployee('${id}')">Editar</button>`, true);

  setTimeout(() => {
    const canvas = document.getElementById('profile-radar');
    if (!canvas) return;
    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Técnica','Comportamento','Autonomia','Colaboração','Comunicação','Entrega'],
        datasets: [{ data: [e.technical_level||0, e.behavioral_level||0, e.autonomy_level||0, e.collaboration_level||0, e.communication_level||0, e.delivery_level||0], backgroundColor: 'rgba(26,58,92,0.2)', borderColor: state.company?.primary_color || '#1a3a5c' }]
      },
      options: { scales: { r: { min: 0, max: 5 } }, plugins: { legend: { display: false } } }
    });
    chart._pmModal = true;
    CHARTS['profile-radar'] = chart;
  }, 100);
};

document.getElementById('btn-new-employee').addEventListener('click', () => {
  openModal('Novo Colaborador', employeeFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveEmployee()">Criar</button>`, true);
});

['employee-search','filter-status','filter-area','filter-risk','filter-exec-status'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderEmployees);
  document.getElementById(id).addEventListener('change', renderEmployees);
});

// ─── Galeria ───────────────────────────────────────────────────

function renderGallery() {
  const emps = getCompanyData('employees');
  const inputs = getCompanyData('manager_inputs');
  document.getElementById('gallery-grid').innerHTML = emps.length ? emps.map(e => {
    const lastInput = inputs.filter(i => i.employee_id === e.id).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
    return `
    <div class="gallery-card ${e.executive_status}" onclick="viewEmployee('${e.id}')">
      <div class="gallery-header">
        <div class="avatar">${getInitials(e.name)}</div>
        <div>
          <div class="gallery-name">${esc(e.name)}</div>
          <div class="gallery-role">${esc(e.role_title)} · ${esc(e.area)}</div>
        </div>
        <span class="semaphore semaphore-${e.executive_status}" style="margin-left:auto"></span>
      </div>
      <div class="gallery-meta">
        <div><strong>Último input:</strong> ${lastInput ? formatDate(lastInput.date) + ' — ' + esc((lastInput.description||'').slice(0,50)) : 'Nenhum'}</div>
        <div style="margin-top:6px"><strong>Próxima ação:</strong> ${esc(e.next_steps?.slice(0,60)) || '—'}</div>
      </div>
      <div class="gallery-levels">
        <div class="level-bar"><label>Técnico ${e.technical_level}/5</label><div class="level-track"><div class="level-fill" style="width:${(e.technical_level||0)*20}%"></div></div></div>
        <div class="level-bar"><label>Comport. ${e.behavioral_level}/5</label><div class="level-track"><div class="level-fill" style="width:${(e.behavioral_level||0)*20}%;background:#4a9fd4"></div></div></div>
      </div>
    </div>`;
  }).join('') : '<p class="empty-state">Nenhum colaborador cadastrado.</p>';
}

// ─── Inputs do Gestor ──────────────────────────────────────────

function populateInputFilters() {
  const emps = getCompanyData('employees');
  const empOpts = emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  document.getElementById('filter-input-employee').innerHTML = '<option value="">Todos</option>' + empOpts;
  document.getElementById('filter-input-type').innerHTML = '<option value="">Todos os tipos</option>' +
    Object.entries(LABELS.inputType).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
}

function renderInputs() {
  populateInputFilters();
  const empF = document.getElementById('filter-input-employee')?.value;
  const typeF = document.getElementById('filter-input-type')?.value;
  const statusF = document.getElementById('filter-input-status')?.value;
  const items = getCompanyData('manager_inputs').filter(i => {
    if (empF && i.employee_id !== empF) return false;
    if (typeF && i.type !== typeF) return false;
    if (statusF && i.status !== statusF) return false;
    return true;
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  document.getElementById('inputs-list').innerHTML = items.length ? items.map(i => `
    <div class="input-card ${i.impact || 'neutro'}">
      <div class="input-card-header">
        <div>
          <div class="input-card-title">${LABELS.inputType[i.type] || i.type} — ${esc(getEmployeeName(i.employee_id))}</div>
          <div class="input-card-meta">${formatDate(i.date)} · Status: ${i.status?.replace('_',' ')}</div>
        </div>
      </div>
      <div class="input-card-body">${esc(i.description)}</div>
      ${i.evidence ? `<div class="input-card-body" style="margin-top:6px;font-size:12px;color:#636e72"><em>Evidência:</em> ${esc(i.evidence)}</div>` : ''}
      <div class="input-card-footer">
        ${i.recommendation ? `<span>💡 ${esc(i.recommendation)}</span>` : ''}
        ${i.next_step ? `<span>➡️ ${esc(i.next_step)}</span>` : ''}
        ${i.deadline ? `<span>📅 ${formatDate(i.deadline)}</span>` : ''}
      </div>
      <div class="input-card-actions">
        <button class="btn-icon" onclick="editInput('${i.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteInput('${i.id}')">🗑️</button>
      </div>
    </div>`).join('') : '<p class="empty-state">Nenhum input registrado.</p>';
}

function inputFormHTML(item = {}) {
  const emps = getCompanyData('employees');
  return `
    <div class="form-grid">
      <div class="form-group"><label>Colaborador *</label><select id="if-employee" required>
        ${emps.map(e => `<option value="${e.id}" ${item.employee_id===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Tipo *</label><select id="if-type">
        ${Object.entries(LABELS.inputType).map(([k,v]) => `<option value="${k}" ${item.type===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Data</label><input type="date" id="if-date" value="${item.date || new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label>Impacto</label><select id="if-impact"><option value="positivo" ${item.impact==='positivo'?'selected':''}>Positivo</option><option value="neutro" ${item.impact==='neutro'?'selected':''}>Neutro</option><option value="negativo" ${item.impact==='negativo'?'selected':''}>Negativo</option></select></div>
      <div class="form-group"><label>Status</label><select id="if-status"><option value="aberto" ${item.status==='aberto'?'selected':''}>Aberto</option><option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Em andamento</option><option value="concluido" ${item.status==='concluido'?'selected':''}>Concluído</option></select></div>
      <div class="form-group"><label>Prazo</label><input type="date" id="if-deadline" value="${item.deadline || ''}"></div>
    </div>
    <div class="form-group full-width" style="margin-top:12px"><label>Descrição objetiva *</label><textarea id="if-desc" required>${esc(item.description || '')}</textarea></div>
    <div class="form-group full-width"><label>Evidência/Contexto</label><textarea id="if-evidence">${esc(item.evidence || '')}</textarea></div>
    <div class="form-group full-width"><label>Recomendação</label><textarea id="if-rec">${esc(item.recommendation || '')}</textarea></div>
    <div class="form-group full-width"><label>Próximo passo</label><textarea id="if-next">${esc(item.next_step || '')}</textarea></div>`;
}

window.editInput = function(id) {
  const item = getCompanyData('manager_inputs').find(i => i.id === id);
  openModal('Editar Input', inputFormHTML(item),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveInput('${id}')">Salvar</button>`, true);
};

window.saveInput = function(id) {
  const desc = document.getElementById('if-desc').value.trim();
  if (!desc) { showToast('Descrição é obrigatória.', 'error'); return; }
  const data = {
    employee_id: document.getElementById('if-employee').value,
    type: document.getElementById('if-type').value,
    date: document.getElementById('if-date').value,
    impact: document.getElementById('if-impact').value,
    status: document.getElementById('if-status').value,
    deadline: document.getElementById('if-deadline').value,
    description: desc,
    evidence: document.getElementById('if-evidence').value,
    recommendation: document.getElementById('if-rec').value,
    next_step: document.getElementById('if-next').value
  };
  const idx = (state.manager_inputs || []).findIndex(i => i.id === id);
  if (idx >= 0) state.manager_inputs[idx] = { ...state.manager_inputs[idx], ...data, updated_at: nowISO() };
  else state.manager_inputs.push({ id: generateId('input'), ...metaFields(), ...data });
  saveState(); closeModal(); renderInputs();
  showToast(id ? 'Input atualizado!' : 'Input registrado!');
};

window.deleteInput = function(id) {
  if (!confirm('Excluir este input?')) return;
  state.manager_inputs = (state.manager_inputs || []).filter(i => i.id !== id);
  saveState(); renderInputs(); showToast('Input excluído.');
};

document.getElementById('btn-new-input').addEventListener('click', () => {
  if (!getCompanyData('employees').length) { showToast('Cadastre colaboradores primeiro.', 'error'); return; }
  openModal('Novo Input do Gestor', inputFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveInput()">Registrar</button>`, true);
});

['filter-input-employee','filter-input-type','filter-input-status'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderInputs);
});

// ─── Timeline ──────────────────────────────────────────────────

function renderTimeline() {
  const emps = getCompanyData('employees');
  document.getElementById('filter-timeline-employee').innerHTML = '<option value="">Todos</option>' +
    emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  document.getElementById('filter-timeline-type').innerHTML = '<option value="">Todos os tipos</option>' +
    Object.entries(LABELS.eventType).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

  const empF = document.getElementById('filter-timeline-employee')?.value;
  const typeF = document.getElementById('filter-timeline-type')?.value;
  const items = getCompanyData('timeline').filter(t => {
    if (empF && t.employee_id !== empF) return false;
    if (typeF && t.event_type !== typeF) return false;
    return true;
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  document.getElementById('timeline-container').innerHTML = items.length ? items.map(t => `
    <div class="timeline-item ${t.status}">
      <div class="timeline-employee">${esc(getEmployeeName(t.employee_id))}</div>
      <div class="timeline-date">${formatDate(t.date)}</div>
      <span class="timeline-type">${LABELS.eventType[t.event_type] || t.event_type}</span>
      <div class="timeline-desc">${esc(t.description)}</div>
      <div class="timeline-footer">
        <span>Impacto: ${esc(t.impact) || '—'}</span>
        <span>Próxima ação: ${esc(t.next_action) || '—'}</span>
        <span>Responsável: ${esc(t.responsible) || '—'}</span>
        <span>Status: ${t.status?.replace('_',' ')}</span>
        <button class="btn-icon" onclick="editTimeline('${t.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteTimeline('${t.id}')">🗑️</button>
      </div>
    </div>`).join('') : '<p class="empty-state">Nenhum evento na timeline.</p>';
}

function timelineFormHTML(item = {}) {
  const emps = getCompanyData('employees');
  return `
    <div class="form-grid">
      <div class="form-group"><label>Colaborador *</label><select id="tf-employee">${emps.map(e => `<option value="${e.id}" ${item.employee_id===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Data</label><input type="date" id="tf-date" value="${item.date || new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label>Tipo de Evento</label><select id="tf-type">${Object.entries(LABELS.eventType).map(([k,v]) => `<option value="${k}" ${item.event_type===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select id="tf-status"><option value="aberto" ${item.status==='aberto'?'selected':''}>Aberto</option><option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Em andamento</option><option value="concluido" ${item.status==='concluido'?'selected':''}>Concluído</option></select></div>
      <div class="form-group"><label>Responsável</label><input id="tf-responsible" value="${esc(item.responsible || state.company?.manager_name || '')}"></div>
    </div>
    <div class="form-group full-width" style="margin-top:12px"><label>Descrição *</label><textarea id="tf-desc" required>${esc(item.description || '')}</textarea></div>
    <div class="form-group full-width"><label>Impacto percebido</label><textarea id="tf-impact">${esc(item.impact || '')}</textarea></div>
    <div class="form-group full-width"><label>Próxima ação</label><textarea id="tf-next">${esc(item.next_action || '')}</textarea></div>`;
}

window.editTimeline = function(id) {
  const item = getCompanyData('timeline').find(t => t.id === id);
  openModal('Editar Evento', timelineFormHTML(item),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveTimeline('${id}')">Salvar</button>`, true);
};

window.saveTimeline = function(id) {
  const desc = document.getElementById('tf-desc').value.trim();
  if (!desc) { showToast('Descrição é obrigatória.', 'error'); return; }
  const data = {
    employee_id: document.getElementById('tf-employee').value,
    date: document.getElementById('tf-date').value,
    event_type: document.getElementById('tf-type').value,
    status: document.getElementById('tf-status').value,
    responsible: document.getElementById('tf-responsible').value,
    description: desc,
    impact: document.getElementById('tf-impact').value,
    next_action: document.getElementById('tf-next').value
  };
  const idx = (state.timeline || []).findIndex(t => t.id === id);
  if (idx >= 0) state.timeline[idx] = { ...state.timeline[idx], ...data, updated_at: nowISO() };
  else state.timeline.push({ id: generateId('tl'), ...metaFields(), ...data });
  saveState(); closeModal(); renderTimeline();
  showToast(id ? 'Evento atualizado!' : 'Evento criado!');
};

window.deleteTimeline = function(id) {
  if (!confirm('Excluir este evento?')) return;
  state.timeline = (state.timeline || []).filter(t => t.id !== id);
  saveState(); renderTimeline(); showToast('Evento excluído.');
};

document.getElementById('btn-new-timeline').addEventListener('click', () => {
  if (!getCompanyData('employees').length) { showToast('Cadastre colaboradores primeiro.', 'error'); return; }
  openModal('Novo Evento na Timeline', timelineFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveTimeline()">Criar</button>`, true);
});

['filter-timeline-employee','filter-timeline-type'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderTimeline);
});

// ─── Desafios ──────────────────────────────────────────────────

function renderChallenges() {
  const items = getCompanyData('challenges');
  document.getElementById('challenges-grid').innerHTML = items.length ? items.map(c => `
    <div class="challenge-card">
      <h4>${LABELS.challengeCategory[c.category] || c.category}</h4>
      <div class="challenge-meta">${esc(getEmployeeName(c.employee_id))} · Urgência: <span class="urgency-${c.urgency}">${c.urgency}</span></div>
      <div class="challenge-desc">${esc(c.description)}</div>
      <p style="font-size:12px;margin-bottom:8px"><strong>Impacto:</strong> ${esc(c.impact)}</p>
      <p style="font-size:12px;margin-bottom:8px"><strong>Plano:</strong> ${esc(c.action_plan)}</p>
      <div class="challenge-footer">
        <span>${esc(c.responsible)} · ${formatDate(c.deadline)}</span>
        <span class="badge badge-${c.status==='concluido'?'verde':c.status==='aberto'?'vermelho':'amarelo'}">${c.status?.replace('_',' ')}</span>
      </div>
      <div style="margin-top:10px">
        <button class="btn-icon" onclick="editChallenge('${c.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteChallenge('${c.id}')">🗑️</button>
      </div>
    </div>`).join('') : '<p class="empty-state">Nenhum desafio mapeado.</p>';
}

function challengeFormHTML(item = {}) {
  const emps = getCompanyData('employees');
  return `
    <div class="form-grid">
      <div class="form-group"><label>Colaborador</label><select id="cf-employee">${emps.map(e => `<option value="${e.id}" ${item.employee_id===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Categoria</label><select id="cf-category">${Object.entries(LABELS.challengeCategory).map(([k,v]) => `<option value="${k}" ${item.category===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-group"><label>Urgência</label><select id="cf-urgency"><option value="alta" ${item.urgency==='alta'?'selected':''}>Alta</option><option value="media" ${item.urgency==='media'?'selected':''}>Média</option><option value="baixa" ${item.urgency==='baixa'?'selected':''}>Baixa</option></select></div>
      <div class="form-group"><label>Status</label><select id="cf-status"><option value="aberto" ${item.status==='aberto'?'selected':''}>Aberto</option><option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Em andamento</option><option value="concluido" ${item.status==='concluido'?'selected':''}>Concluído</option></select></div>
      <div class="form-group"><label>Responsável</label><input id="cf-responsible" value="${esc(item.responsible || '')}"></div>
      <div class="form-group"><label>Prazo</label><input type="date" id="cf-deadline" value="${item.deadline || ''}"></div>
    </div>
    <div class="form-group full-width" style="margin-top:12px"><label>Descrição *</label><textarea id="cf-desc" required>${esc(item.description || '')}</textarea></div>
    <div class="form-group full-width"><label>Impacto</label><textarea id="cf-impact">${esc(item.impact || '')}</textarea></div>
    <div class="form-group full-width"><label>Plano de ação / Mitigação</label><textarea id="cf-plan">${esc(item.action_plan || '')}</textarea></div>`;
}

window.editChallenge = function(id) {
  const item = getCompanyData('challenges').find(c => c.id === id);
  openModal('Editar Desafio', challengeFormHTML(item),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveChallenge('${id}')">Salvar</button>`, true);
};

window.saveChallenge = function(id) {
  const desc = document.getElementById('cf-desc').value.trim();
  if (!desc) { showToast('Descrição é obrigatória.', 'error'); return; }
  const data = {
    employee_id: document.getElementById('cf-employee').value,
    category: document.getElementById('cf-category').value,
    urgency: document.getElementById('cf-urgency').value,
    status: document.getElementById('cf-status').value,
    responsible: document.getElementById('cf-responsible').value,
    deadline: document.getElementById('cf-deadline').value,
    description: desc,
    impact: document.getElementById('cf-impact').value,
    action_plan: document.getElementById('cf-plan').value
  };
  const idx = (state.challenges || []).findIndex(c => c.id === id);
  if (idx >= 0) state.challenges[idx] = { ...state.challenges[idx], ...data, updated_at: nowISO() };
  else state.challenges.push({ id: generateId('chal'), ...metaFields(), ...data });
  saveState(); closeModal(); renderChallenges();
  showToast(id ? 'Desafio atualizado!' : 'Desafio criado!');
};

window.deleteChallenge = function(id) {
  if (!confirm('Excluir este desafio?')) return;
  state.challenges = (state.challenges || []).filter(c => c.id !== id);
  saveState(); renderChallenges(); showToast('Desafio excluído.');
};

document.getElementById('btn-new-challenge').addEventListener('click', () => {
  openModal('Novo Desafio/Oportunidade', challengeFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveChallenge()">Criar</button>`, true);
});

// ─── Biblioteca do Conhecimento BE ─────────────────────────────

function renderCompass() {
  document.getElementById('filter-material-theme').innerHTML = '<option value="">Todos os temas</option>' +
    Object.entries(LABELS.materialTheme).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

  const search = (document.getElementById('material-search')?.value || '').toLowerCase();
  const theme = document.getElementById('filter-material-theme')?.value || '';
  const items = getCompanyData('compass_materials').filter(m => {
    if (search && !(m.title||'').toLowerCase().includes(search) && !(m.description||'').toLowerCase().includes(search)) return false;
    if (theme && m.theme !== theme) return false;
    return true;
  });

  document.getElementById('materials-grid').innerHTML = items.length ? items.map(m => `
    <div class="material-card">
      <span class="material-theme">${LABELS.materialTheme[m.theme] || m.theme} · ${LABELS.materialType[m.type] || m.type}</span>
      <h4>${esc(m.title)}</h4>
      <div class="material-desc">${esc(m.description)}</div>
      ${m.link ? `<a class="material-link" href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.link)}</a>` : ''}
      <p style="font-size:11px;margin-top:8px;color:#636e72">${esc(m.applicability)}</p>
      <p style="font-size:11px;margin-top:4px">Associados: ${(m.associated_employees||[]).map(id => esc(getEmployeeName(id))).join(', ') || '—'}</p>
      <div style="margin-top:10px">
        <button class="btn-icon" onclick="editMaterial('${m.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteMaterial('${m.id}')">🗑️</button>
      </div>
    </div>`).join('') : '<p class="empty-state">Nenhum material cadastrado.</p>';
}

function materialFormHTML(item = {}) {
  const emps = getCompanyData('employees');
  const chals = getCompanyData('challenges');
  const assocEmps = (item.associated_employees || []);
  const assocChals = (item.associated_challenges || []);
  return `
    <div class="form-grid">
      <div class="form-group"><label>Título *</label><input id="mf-title" value="${esc(item.title || '')}" required></div>
      <div class="form-group"><label>Tema</label><select id="mf-theme">${Object.entries(LABELS.materialTheme).map(([k,v]) => `<option value="${k}" ${item.theme===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-group"><label>Tipo</label><select id="mf-type">${Object.entries(LABELS.materialType).map(([k,v]) => `<option value="${k}" ${item.type===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-group"><label>Data inclusão</label><input type="date" id="mf-date" value="${item.inclusion_date || new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="form-group full-width" style="margin-top:12px"><label>Descrição</label><textarea id="mf-desc">${esc(item.description || '')}</textarea></div>
    <div class="form-group full-width"><label>Link</label><input id="mf-link" value="${esc(item.link || '')}" placeholder="https://..."></div>
    <div class="form-group full-width"><label>Aplicabilidade</label><textarea id="mf-app">${esc(item.applicability || '')}</textarea></div>
    <div class="form-group full-width"><label>Colaboradores associados</label>
      <div class="tags-grid">${emps.map(e => `<label class="tag-checkbox"><input type="checkbox" name="mf-emp" value="${e.id}" ${assocEmps.includes(e.id)?'checked':''}> ${esc(e.name)}</label>`).join('')}</div>
    </div>
    <div class="form-group full-width"><label>Desafios associados</label>
      <div class="tags-grid">${chals.map(c => `<label class="tag-checkbox"><input type="checkbox" name="mf-chal" value="${c.id}" ${assocChals.includes(c.id)?'checked':''}> ${esc(c.description?.slice(0,40))}</label>`).join('') || '<span>Nenhum desafio</span>'}</div>
    </div>`;
}

window.editMaterial = function(id) {
  const item = getCompanyData('compass_materials').find(m => m.id === id);
  openModal('Editar Material', materialFormHTML(item),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveMaterial('${id}')">Salvar</button>`, true);
};

window.saveMaterial = function(id) {
  const title = document.getElementById('mf-title').value.trim();
  if (!title) { showToast('Título é obrigatório.', 'error'); return; }
  const data = {
    title, theme: document.getElementById('mf-theme').value,
    type: document.getElementById('mf-type').value,
    inclusion_date: document.getElementById('mf-date').value,
    description: document.getElementById('mf-desc').value,
    link: document.getElementById('mf-link').value,
    applicability: document.getElementById('mf-app').value,
    associated_employees: [...document.querySelectorAll('input[name="mf-emp"]:checked')].map(c => c.value),
    associated_challenges: [...document.querySelectorAll('input[name="mf-chal"]:checked')].map(c => c.value)
  };
  const idx = (state.compass_materials || []).findIndex(m => m.id === id);
  if (idx >= 0) state.compass_materials[idx] = { ...state.compass_materials[idx], ...data, updated_at: nowISO() };
  else state.compass_materials.push({ id: generateId('mat'), ...metaFields(), ...data });
  saveState(); closeModal(); renderCompass();
  showToast(id ? 'Material atualizado!' : 'Material cadastrado!');
};

window.deleteMaterial = function(id) {
  if (!confirm('Excluir este material?')) return;
  state.compass_materials = (state.compass_materials || []).filter(m => m.id !== id);
  saveState(); renderCompass(); showToast('Material excluído.');
};

document.getElementById('btn-new-material').addEventListener('click', () => {
  openModal('Novo Material — Biblioteca BE', materialFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="saveMaterial()">Cadastrar</button>`, true);
});

document.getElementById('material-search').addEventListener('input', renderCompass);
document.getElementById('filter-material-theme').addEventListener('change', renderCompass);

// ─── NR-1 ──────────────────────────────────────────────────────

function renderNR1() {
  const emps = getCompanyData('employees');
  const inputs = getCompanyData('manager_inputs');
  const attentionInputs = inputs.filter(i => i.type === 'atencao' || i.type === 'risco_sobrecarga');
  const pending = inputs.filter(i => i.status === 'aberto' || i.status === 'em_andamento');
  const highRisk = emps.filter(e => e.overload_risk === 'alto');
  const perfDrop = emps.filter(e => (e.technical_level || 5) <= 2 || (e.behavioral_level || 5) <= 2);
  const conflict = inputs.filter(i => i.type === 'comportamento' && i.impact === 'negativo');

  const kpis = [
    { label: 'Risco Sobrecarga Alto', value: highRisk.length, cls: 'red' },
    { label: 'Inputs de Atenção', value: attentionInputs.length, cls: 'amber' },
    { label: 'Ações Pendentes', value: pending.length, cls: 'amber' },
    { label: 'Queda Performance', value: perfDrop.length, cls: 'red' },
    { label: 'Sinais de Conflito', value: conflict.length, cls: 'amber' },
    { label: 'Redistribuição Necessária', value: highRisk.length, cls: 'red' },
    { label: 'Conversa com RH', value: emps.filter(e => e.executive_status === 'vermelho').length, cls: 'red' },
    { label: 'Revisão Prioridades', value: emps.filter(e => e.executive_status === 'amarelo').length, cls: 'amber' }
  ];

  document.getElementById('nr1-kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join('');

  const alerts = [];
  highRisk.forEach(e => alerts.push({ critical: true, icon: '⚠️', title: `Sobrecarga: ${e.name}`, text: `Risco alto identificado. Revisar carga de trabalho e prioridades.` }));
  perfDrop.forEach(e => alerts.push({ critical: false, icon: '📉', title: `Performance: ${e.name}`, text: `Indicadores técnicos ou comportamentais abaixo do esperado.` }));
  conflict.forEach(i => alerts.push({ critical: false, icon: '🤝', title: `Conflito: ${getEmployeeName(i.employee_id)}`, text: esc(i.description?.slice(0,100)) }));

  document.getElementById('nr1-alerts').innerHTML = alerts.length ? alerts.map(a => `
    <div class="nr1-alert ${a.critical?'critical':''}">
      <span class="nr1-alert-icon">${a.icon}</span>
      <div class="nr1-alert-text"><strong>${esc(a.title)}</strong>${a.text}</div>
    </div>`).join('') : '<p class="empty-state">Nenhum alerta preventivo no momento.</p>';
}

// ─── Síntese Executiva ─────────────────────────────────────────

function generateExecutiveSummary() {
  const emps = getCompanyData('employees');
  const inputs = getCompanyData('manager_inputs');
  const challenges = getCompanyData('challenges');
  const materials = getCompanyData('compass_materials');
  const company = state.company || {};
  const openActions = inputs.filter(i => i.status !== 'concluido');
  const doneActions = inputs.filter(i => i.status === 'concluido');
  const highlights = emps.filter(e => e.executive_status === 'verde' || e.executive_status === 'azul');
  const attention = emps.filter(e => e.executive_status === 'amarelo' || e.executive_status === 'vermelho');
  const risks = challenges.filter(c => c.urgency === 'alta' && c.status !== 'concluido');

  const date = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  let text = `SÍNTESE EXECUTIVA — PEOPLE MANAGEMENT 2.0\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `Empresa: ${company.name || '—'}\n`;
  text += `Time: ${company.team_name || '—'}\n`;
  text += `Gestor: ${company.manager_name || '—'}\n`;
  text += `Data: ${date}\n\n`;

  text += `STATUS GERAL DO TIME\n${'-'.repeat(30)}\n`;
  text += `Total de colaboradores: ${emps.length}\n`;
  text += `Alta performance: ${emps.filter(e=>e.status==='alta_performance').length} | Desenvolvimento: ${emps.filter(e=>e.status==='desenvolvimento').length}\n`;
  text += `Atenção: ${emps.filter(e=>e.status==='atencao').length} | Suporte: ${emps.filter(e=>e.status==='suporte').length} | Talentos: ${emps.filter(e=>e.status==='talento').length}\n`;
  text += `Médias — Técnica: ${avg(emps.map(e=>e.technical_level))} | Comportamental: ${avg(emps.map(e=>e.behavioral_level))} | Autonomia: ${avg(emps.map(e=>e.autonomy_level))} | Colaboração: ${avg(emps.map(e=>e.collaboration_level))}\n\n`;

  text += `PRINCIPAIS EVOLUÇÕES\n${'-'.repeat(30)}\n`;
  highlights.forEach(e => { text += `• ${e.name} (${e.role_title}): ${e.executive_summary || e.strengths?.slice(0,80) || 'Evolução positiva'}\n`; });
  if (!highlights.length) text += `• Nenhuma evolução destacada no período.\n`;
  text += `\n`;

  text += `PRINCIPAIS RISCOS\n${'-'.repeat(30)}\n`;
  risks.forEach(c => { text += `• [${c.urgency?.toUpperCase()}] ${getEmployeeName(c.employee_id)}: ${c.description?.slice(0,80)}\n`; });
  attention.forEach(e => { text += `• ${e.name} (${e.executive_status}): ${e.current_challenges?.slice(0,80) || 'Requer acompanhamento'}\n`; });
  if (!risks.length && !attention.length) text += `• Nenhum risco crítico identificado.\n`;
  text += `\n`;

  text += `COLABORADORES EM DESTAQUE\n${'-'.repeat(30)}\n`;
  emps.filter(e => e.executive_status === 'azul' || e.status === 'talento' || e.status === 'alta_performance').forEach(e => {
    text += `• ${e.name} — ${e.role_title}: ${e.opportunities?.slice(0,80) || 'Alto potencial'}\n`;
  });
  text += `\n`;

  text += `COLABORADORES QUE EXIGEM ATENÇÃO\n${'-'.repeat(30)}\n`;
  attention.forEach(e => { text += `• ${e.name} — ${e.role_title}: ${e.next_steps?.slice(0,80) || 'Definir plano de ação'}\n`; });
  if (!attention.length) text += `• Nenhum colaborador em estado de atenção.\n`;
  text += `\n`;

  text += `AÇÕES PENDENTES (${openActions.length})\n${'-'.repeat(30)}\n`;
  openActions.slice(0,10).forEach(i => { text += `• ${getEmployeeName(i.employee_id)}: ${i.next_step || i.description?.slice(0,60)} [${i.status}]\n`; });
  text += `\n`;

  text += `AÇÕES CONCLUÍDAS (${doneActions.length})\n${'-'.repeat(30)}\n`;
  doneActions.slice(0,5).forEach(i => { text += `• ${getEmployeeName(i.employee_id)}: ${i.description?.slice(0,60)}\n`; });
  text += `\n`;

  text += `MATERIAIS RECOMENDADOS\n${'-'.repeat(30)}\n`;
  materials.slice(0,5).forEach(m => { text += `• ${m.title} (${LABELS.materialTheme[m.theme] || m.theme})\n`; });
  text += `\n`;

  text += `RECOMENDAÇÕES — PRÓXIMOS 30 DIAS\n${'-'.repeat(30)}\n`;
  text += `1. Realizar 1:1s com colaboradores em atenção (${attention.length} pendentes).\n`;
  text += `2. Revisar planos de ação abertos (${openActions.length} em andamento).\n`;
  text += `3. Reconhecer publicamente evoluções de ${highlights.map(e=>e.name.split(' ')[0]).join(', ') || 'colaboradores em destaque'}.\n`;
  text += `4. Endereçar ${risks.length} risco(s) de alta urgência.\n`;
  text += `5. Aplicar materiais da Biblioteca do Conhecimento BE conforme mapeamento individual.\n\n`;

  text += `MENSAGEM EXECUTIVA\n${'-'.repeat(30)}\n`;
  text += `O time ${company.team_name || ''} apresenta ${emps.length} colaboradores com média técnica de ${avg(emps.map(e=>e.technical_level))} e comportamental de ${avg(emps.map(e=>e.behavioral_level))}. `;
  text += `${highlights.length} profissional(is) em trajetória positiva e ${attention.length} requerendo acompanhamento direcionado. `;
  text += `Recomenda-se priorizar ${openActions.length} ação(ões) em aberto e alinhar com RH/People Partner os casos de risco organizacional identificados. `;
  text += `Os registros desta síntese são baseados em fatos observáveis e têm finalidade exclusivamente gerencial e de desenvolvimento.\n`;

  const html = text.split('\n').map(line => {
    if (line.startsWith('SÍNTESE') || line.startsWith('STATUS') || line.startsWith('PRINCIPAIS') || line.startsWith('COLABORADORES') || line.startsWith('AÇÕES') || line.startsWith('MATERIAIS') || line.startsWith('RECOMENDAÇÕES') || line.startsWith('MENSAGEM')) {
      if (line.includes('=') || line.includes('-')) return `<p style="color:#636e72;font-size:12px">${esc(line)}</p>`;
      return `<h3>${esc(line)}</h3>`;
    }
    return `<p>${esc(line)}</p>`;
  }).join('');

  document.getElementById('summary-content').innerHTML = html;
  document.getElementById('summary-content').dataset.raw = text;
  showToast('Síntese executiva gerada!');
}

document.getElementById('btn-generate-summary').addEventListener('click', generateExecutiveSummary);

document.getElementById('btn-copy-summary').addEventListener('click', () => {
  const raw = document.getElementById('summary-content').dataset.raw;
  if (!raw) { showToast('Gere a síntese primeiro.', 'error'); return; }
  navigator.clipboard.writeText(raw).then(() => showToast('Síntese copiada!')).catch(() => showToast('Erro ao copiar.', 'error'));
});

document.getElementById('btn-export-txt').addEventListener('click', () => {
  const raw = document.getElementById('summary-content').dataset.raw;
  if (!raw) { showToast('Gere a síntese primeiro.', 'error'); return; }
  downloadFile(`sintese-executiva-${Date.now()}.txt`, raw, 'text/plain');
  showToast('TXT exportado!');
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
  const raw = document.getElementById('summary-content').dataset.raw;
  if (!raw) { showToast('Gere a síntese primeiro.', 'error'); return; }
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Síntese Executiva</title><style>body{font-family:Inter,sans-serif;padding:40px;line-height:1.8;font-size:13px}h3{color:#1a3a5c;margin-top:20px}</style></head><body><pre style="white-space:pre-wrap;font-family:inherit">${raw.replace(/</g,'&lt;')}</pre></body></html>`);
  w.document.close();
  w.print();
  showToast('PDF gerado via impressão!');
});

// ─── Governança ────────────────────────────────────────────────

function renderGovernance() {
  document.getElementById('governance-grid').innerHTML = GOVERNANCE_ITEMS.map(g => `
    <div class="governance-item"><h4>${g.icon} ${g.title}</h4><p>${g.text}</p></div>`).join('');
}

// ─── Dados & Backup ────────────────────────────────────────────

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('btn-export-json').addEventListener('click', () => {
  downloadFile(`pm20-backup-${Date.now()}.json`, JSON.stringify(state, null, 2), 'application/json');
  showToast('JSON exportado!');
});

document.getElementById('btn-backup').addEventListener('click', () => {
  const date = new Date().toISOString().slice(0,10);
  downloadFile(`pm20-backup-${date}.json`, JSON.stringify(state, null, 2), 'application/json');
  showToast('Backup criado!');
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  document.getElementById('import-json').click();
});

document.getElementById('import-json').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      state = JSON.parse(ev.target.result);
      saveState(); applyTheme();
      renderSection(document.querySelector('.nav-item.active').dataset.section);
      showToast('Dados importados com sucesso!');
    } catch { showToast('Arquivo JSON inválido.', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-clear-data').addEventListener('click', () => {
  if (!confirm('ATENÇÃO: Isso apagará TODOS os dados do navegador. Deseja continuar?')) return;
  if (!confirm('Confirma a exclusão permanente?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
  location.reload();
});

document.getElementById('btn-restore-demo').addEventListener('click', async () => {
  if (!confirm('Restaurar dados de demonstração? Dados atuais serão substituídos.')) return;
  localStorage.removeItem(STORAGE_KEY);
  await loadDemoData();
  normalizeState();
  localStorage.setItem(ONBOARDING_KEY, 'true');
  saveState(); applyTheme();
  renderSection(document.querySelector('.nav-item.active').dataset.section);
  showToast('Dados de demonstração restaurados!');
});

// ─── Onboarding / Cadastro inicial ─────────────────────────────

function showOnboarding() {
  document.getElementById('onboarding-screen').hidden = false;
  document.getElementById('app').classList.add('app-hidden');
}

function hideOnboarding() {
  document.getElementById('onboarding-screen').hidden = true;
  document.getElementById('app').classList.remove('app-hidden');
}

function finishOnboarding() {
  localStorage.setItem(getOnboardingKey(), 'true');
  hideOnboarding();
  launchApp();
  showToast('Cadastro concluído! Bem-vindo ao People Management 2.0.');
}

function updateUserHeader() {
  const wrap = document.getElementById('header-user');
  const emailEl = document.getElementById('header-user-email');
  if (!wrap || typeof Auth === 'undefined' || !Auth.user) return;
  wrap.hidden = false;
  if (emailEl) emailEl.textContent = Auth.profile?.full_name || Auth.user.email;
}

function launchApp() {
  document.getElementById('app')?.classList.remove('app-hidden');
  startApp();
  if (typeof renderAccessAdmin === 'function') renderAccessAdmin();
  updateUserHeader();
}

function initOnboarding() {
  document.getElementById('ob-company-logo')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('ob-logo-preview').innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('onboarding-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('ob-company-name').value.trim();
    const manager = document.getElementById('ob-manager-name').value.trim();
    if (!name || !manager) {
      showToast('Preencha empresa e gestor responsável.', 'error');
      return;
    }
    if (!state.company) state.company = {};
    state.company = {
      ...metaFields({ company_id: generateId('comp') }),
      name,
      manager_name: manager,
      team_name: document.getElementById('ob-team-name').value.trim(),
      primary_color: document.getElementById('ob-primary-color').value,
      logo: document.getElementById('ob-logo-preview').querySelector('img')?.src || null,
      onboarding_complete: true
    };
    saveState();
    if (typeof Auth !== 'undefined' && Auth.isApproved?.()) {
      try {
        const row = await Auth.saveCompanyToSupabase(state.company);
        if (row?.id) {
          state.company.supabase_id = row.id;
          state.company.company_id = row.id;
          saveState();
        }
      } catch (err) {
        showToast('Empresa salva localmente. Erro na nuvem: ' + err.message, 'error');
      }
    }
    finishOnboarding();
  });

  document.getElementById('btn-onboarding-demo').addEventListener('click', async () => {
    await loadDemoData();
    normalizeState();
    saveState();
    finishOnboarding();
  });
}

function startApp() {
  applyTheme();
  initNavigation();
  initCompanyForm();
  renderDashboard();
  renderGovernance();
}

// ─── Inicialização ─────────────────────────────────────────────

async function continueAfterAuth() {
  await loadStateForUser();
  normalizeState();
  initOnboarding();

  if (!isOnboardingComplete()) {
    showOnboarding();
    return;
  }

  launchApp();
}

async function continueWithoutAuth() {
  await loadState();
  normalizeState();
  initOnboarding();

  if (!isOnboardingComplete()) {
    showOnboarding();
    console.log('People Management 2.0 — Aguardando cadastro inicial.');
    return;
  }

  launchApp();
  console.log('People Management 2.0 — Pronto (modo local).');
}

async function init() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(56, 189, 248, 0.1)';
  }

  initTechBackground();

  if (typeof Auth === 'undefined' || !Auth.isConfigured()) {
    console.warn('Supabase não configurado — modo local sem login.');
    await continueWithoutAuth();
    return;
  }

  window.onAuthReady = continueAfterAuth;
  await initAuth();
}

/** Rede de partículas conectadas — efeito tech no fundo */
function initTechBackground() {
  const canvas = document.getElementById('tech-canvas');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let w, h, particles = [], animId;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticles() {
    const count = Math.min(Math.floor((w * h) / 18000), 90);
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const linkDist = 130;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.hypot(dx, dy);
        if (dist < linkDist) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.14 * (1 - dist / linkDist)})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    resize();
    createParticles();
    draw();
  });
}

document.addEventListener('DOMContentLoaded', init);

