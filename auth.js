/**
 * People Management 2.0 — Autenticação Supabase
 * Novos usuários requerem aprovação de laercio_wasques@yahoo.com.br
 */

const ADMIN_EMAIL = 'laercio_wasques@yahoo.com.br';

const Auth = {
  client: null,
  user: null,
  profile: null,

  isConfigured() {
    const url = (window.SUPABASE_URL || '').trim();
    const key = (window.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return false;

    const invalid = /project url|settings → api|chave anon|seu-projeto|sua-anon/i;
    if (invalid.test(url) || invalid.test(key)) return false;
    if (key.startsWith('http')) return false;

    const urlOk = /^https:\/\/[\w-]+\.supabase\.co\/?$/i.test(url);
    const keyOk = key.startsWith('eyJ') || key.startsWith('sb_publishable_') || key.length >= 32;
    return urlOk && keyOk;
  },

  init() {
    if (!this.isConfigured() || !window.supabase) return false;
    this.client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return true;
  },

  isAdmin() {
    return this.profile?.role === 'admin' && this.profile?.status === 'approved';
  },

  isApproved() {
    return this.profile?.status === 'approved';
  },

  async getSession() {
    if (!this.client) return null;
    const { data: { session } } = await this.client.auth.getSession();
    return session;
  },

  async loadProfile() {
    if (!this.client || !this.user) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', this.user.id)
      .single();
    if (error) {
      console.error('Erro ao carregar perfil:', error.message);
      return null;
    }
    this.profile = data;
    return data;
  },

  async refresh() {
    const session = await this.getSession();
    if (!session) {
      this.user = null;
      this.profile = null;
      return null;
    }
    this.user = session.user;
    await this.loadProfile();
    return { user: this.user, profile: this.profile };
  },

  async signUp(email, password, fullName) {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    this.user = data.user;
    await this.loadProfile();
    return data;
  },

  async signOut() {
    if (this.client) await this.client.auth.signOut();
    this.user = null;
    this.profile = null;
  },

  async listPendingUsers() {
    if (!this.isAdmin()) throw new Error('Sem permissão');
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, full_name, role, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listAllUsers() {
    if (!this.isAdmin()) throw new Error('Sem permissão');
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, full_name, role, status, created_at, approved_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async approveUser(userId) {
    if (!this.isAdmin()) throw new Error('Sem permissão');
    const { data, error } = await this.client
      .from('profiles')
      .update({
        status: 'approved',
        approved_by: this.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;

    try {
      await this.client.from('audit_logs').insert({
        company_id: this.profile?.company_id || null,
        user_id: this.user.id,
        action: 'user_approved',
        entity: 'profiles',
        entity_id: userId,
        metadata: { approved_by: ADMIN_EMAIL }
      });
    } catch (_) { /* auditoria opcional */ }

    return data;
  },

  async rejectUser(userId, reason = '') {
    if (!this.isAdmin()) throw new Error('Sem permissão');
    const { data, error } = await this.client
      .from('profiles')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        approved_by: this.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async linkProfileToCompany(companyId) {
    if (!this.user) return;
    const { error } = await this.client
      .from('profiles')
      .update({ company_id: companyId, updated_at: new Date().toISOString() })
      .eq('id', this.user.id);
    if (error) console.error('Erro ao vincular empresa:', error.message);
    await this.loadProfile();
  },

  async saveCompanyToSupabase(company) {
    if (!this.client || !this.isApproved()) return null;

    const row = {
      name: company.name,
      logo: company.logo,
      primary_color: company.primary_color,
      manager_name: company.manager_name,
      team_name: company.team_name,
      updated_by: this.user.id,
      updated_at: new Date().toISOString()
    };

    if (company.supabase_id) {
      const { data, error } = await this.client
        .from('companies')
        .update(row)
        .eq('id', company.supabase_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.client
      .from('companies')
      .insert({ ...row, created_by: this.user.id })
      .select()
      .single();
    if (error) throw error;

    await this.linkProfileToCompany(data.id);
    return data;
  },

  async loadAppData() {
    if (!this.client || !this.isApproved() || !this.profile?.company_id) return null;
    const { data, error } = await this.client
      .from('app_data')
      .select('payload')
      .eq('user_id', this.user.id)
      .eq('company_id', this.profile.company_id)
      .maybeSingle();
    if (error) {
      console.error('Erro ao carregar dados:', error.message);
      return null;
    }
    return data?.payload || null;
  },

  async saveAppData(payload) {
    if (!this.client || !this.isApproved() || !this.profile?.company_id) return;
    const { error } = await this.client.from('app_data').upsert({
      user_id: this.user.id,
      company_id: this.profile.company_id,
      payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'company_id,user_id' });
    if (error) console.error('Erro ao salvar na nuvem:', error.message);
  },

  onAuthStateChange(callback) {
    if (!this.client) return () => {};
    const { data: { subscription } } = this.client.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }
};

// ─── UI de autenticação ─────────────────────────────────────────

function showScreen(id) {
  ['auth-screen', 'pending-screen', 'rejected-screen', 'onboarding-screen', 'app'].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    if (s === id) {
      el.hidden = false;
      el.classList?.remove('app-hidden');
    } else {
      el.hidden = true;
      if (s === 'app') el.classList.add('app-hidden');
    }
  });
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg || '';
    el.hidden = !msg;
  }
}

function initAuthUI() {
  const tabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      loginForm.hidden = target !== 'login';
      signupForm.hidden = target !== 'signup';
      setAuthError('');
    });
  });

  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    setAuthError('');
    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    try {
      await Auth.signIn(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value
      );
      await handleAuthSuccess();
    } catch (err) {
      setAuthError(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : (err.message || 'Erro ao entrar.'));
    } finally {
      btn.disabled = false;
    }
  });

  signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    setAuthError('');
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value.trim();
    if (password.length < 6) {
      setAuthError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    const btn = document.getElementById('btn-signup');
    btn.disabled = true;
    try {
      const { user, session } = await Auth.signUp(email, password, name);
      if (user && !session) {
        setAuthError('');
        showPendingScreen('Cadastro realizado! Verifique seu e-mail e aguarde aprovação do administrador.');
        return;
      }
      await Auth.refresh();
      await handleAuthSuccess();
    } catch (err) {
      setAuthError(err.message || 'Erro ao cadastrar.');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await Auth.signOut();
    location.reload();
  });

  document.getElementById('btn-pending-logout')?.addEventListener('click', async () => {
    await Auth.signOut();
    location.reload();
  });

  document.getElementById('btn-rejected-logout')?.addEventListener('click', async () => {
    await Auth.signOut();
    location.reload();
  });
}

function showAuthScreen() {
  showScreen('auth-screen');
}

function showPendingScreen(msg) {
  const el = document.getElementById('pending-message');
  if (el && msg) el.textContent = msg;
  showScreen('pending-screen');
}

function showRejectedScreen(reason) {
  const el = document.getElementById('rejected-reason');
  if (el) el.textContent = reason || 'Seu acesso não foi autorizado. Entre em contato com o administrador.';
  showScreen('rejected-screen');
}

async function handleAuthSuccess() {
  await Auth.refresh();
  const p = Auth.profile;

  if (!p) {
    setAuthError('Perfil não encontrado. Aguarde alguns segundos e tente novamente.');
    return;
  }

  if (p.status === 'pending') {
    showPendingScreen();
    return;
  }

  if (p.status === 'rejected' || p.status === 'suspended') {
    showRejectedScreen(p.rejection_reason);
    return;
  }

  if (typeof window.onAuthReady === 'function') {
    await window.onAuthReady();
  }
}

function renderAccessAdmin() {
  const section = document.getElementById('section-access');
  const navItem = document.getElementById('nav-access-admin');
  if (!Auth.isAdmin()) {
    if (section) section.style.display = 'none';
    if (navItem) navItem.hidden = true;
    return;
  }
  if (section) section.style.display = '';
  if (navItem) navItem.hidden = false;
  loadAccessAdminPanel();
}

async function loadAccessAdminPanel() {
  const container = document.getElementById('access-admin-list');
  if (!container || !Auth.isAdmin()) return;

  container.innerHTML = '<p class="empty-state">Carregando solicitações...</p>';

  try {
    const users = await Auth.listAllUsers();
    const pending = users.filter(u => u.status === 'pending');

    if (!users.length) {
      container.innerHTML = '<p class="empty-state">Nenhum usuário cadastrado.</p>';
      return;
    }

    container.innerHTML = `
      <p style="margin-bottom:16px;font-size:13px;color:var(--gray-text)">
        <strong>${pending.length}</strong> solicitação(ões) pendente(s) · Administrador: ${ADMIN_EMAIL}
      </p>
      ${users.map(u => `
        <div class="access-user-card ${u.status}">
          <div>
            <strong>${esc(u.full_name || u.email)}</strong>
            <div class="access-user-meta">${esc(u.email)} · ${u.role} · ${formatAccessDate(u.created_at)}</div>
          </div>
          <div class="access-user-actions">
            <span class="badge badge-${u.status === 'approved' ? 'verde' : u.status === 'pending' ? 'amarelo' : 'vermelho'}">${u.status}</span>
            ${u.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="approveUserAccess('${u.id}')">Aprovar</button>
              <button class="btn btn-danger btn-sm" onclick="rejectUserAccess('${u.id}')">Recusar</button>
            ` : ''}
          </div>
        </div>
      `).join('')}`;
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Erro: ${esc(err.message)}</p>`;
  }
}

function formatAccessDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

window.approveUserAccess = async function(userId) {
  try {
    await Auth.approveUser(userId);
    showToast('Usuário aprovado!');
    loadAccessAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.rejectUserAccess = async function(userId) {
  const reason = prompt('Motivo da recusa (opcional):') || '';
  try {
    await Auth.rejectUser(userId, reason);
    showToast('Acesso recusado.');
    loadAccessAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function initAuth() {
  try {
    if (!Auth.isConfigured()) {
      document.getElementById('auth-config-warning').hidden = false;
      showAuthScreen();
      setAuthError('Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no Vercel.');
      return false;
    }

    if (!Auth.init()) {
      showAuthScreen();
      setAuthError('Erro ao inicializar Supabase.');
      return false;
    }

    initAuthUI();

    const session = await Auth.getSession();
    if (session) {
      Auth.user = session.user;
      await handleAuthSuccess();
      return true;
    }

    showAuthScreen();
    return false;
  } catch (err) {
    console.error('initAuth:', err);
    showAuthScreen();
    setAuthError('Erro ao conectar ao Supabase. Verifique URL e chave no Vercel.');
    return false;
  }
}
