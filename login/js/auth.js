/* ==========================================================================
   js/auth.js
   Lógica de autenticação compartilhada entre index.html (login) e painel.html.
   Cria o cliente Supabase UMA única vez e expõe window.Auth com as
   funções usadas pelas páginas: login, logout, checkAuth e recuperarSenha.

   Requer que <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   seja carregado ANTES deste arquivo.
   ========================================================================== */

// Credenciais públicas do projeto Supabase (a chave "anon" é segura para
// ficar no front-end: o acesso real é controlado pelas policies de RLS).
const SUPABASE_URL = 'https://hfaftvzvbvvkpfjtzfxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYWZ0dnp2YnZ2a3BmanR6Znh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTI5NDYsImV4cCI6MjA5OTU4ODk0Nn0.kUTdXKhKFFLw9tRyqD5GDDkD9VuIrzfpip47RHCBQ2Q';

// Cliente Supabase único, compartilhado por toda a aplicação.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.Auth = {
  /**
   * Faz login com e-mail e senha.
   * Retorna o usuário autenticado ou lança um Error com mensagem amigável.
   */
  async login(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('E-mail ou senha incorretos.');
      }
      throw new Error(error.message);
    }

    return data.user;
  },

  /**
   * Verifica se há uma sessão ativa. É o "guarda" que deve rodar no topo
   * de toda página protegida. Se não houver sessão, redireciona para o
   * login e retorna null; se houver, retorna o usuário logado.
   */
  async checkAuth() {
    const { data, error } = await sb.auth.getSession();

    if (error || !data.session) {
      window.location.href = 'index.html';
      return null;
    }

    return data.session.user;
  },

  /**
   * Encerra a sessão e volta para a tela de login.
   */
  async logout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  },

  /**
   * Envia o e-mail de recuperação de senha.
   */
  async recuperarSenha(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) {
      throw new Error(error.message);
    }
  },
};
