/* ==========================================================================
   js/banco.js
   Guarda o endereço e a chave pública do Supabase, uma vez só, e cria o
   cliente que TODAS as páginas usam: login, admin e o site público.

   A chave abaixo é a chave "anon", pública. Ela é segura para ficar aqui,
   visível no navegador: ela sozinha não dá acesso a nada, quem controla o
   que pode ser lido ou escrito é a trava de segurança (RLS) configurada no
   banco.sql. Nunca coloque a chave "secreta"/"service_role" em nenhum
   arquivo do site, essa sim precisa ficar em segredo.

   Requer que <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   seja carregado ANTES deste arquivo.
   ========================================================================== */

const SUPABASE_URL = 'https://hfaftvzvbvvkpfjtzfxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYWZ0dnp2YnZ2a3BmanR6Znh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTI5NDYsImV4cCI6MjA5OTU4ODk0Nn0.kUTdXKhKFFLw9tRyqD5GDDkD9VuIrzfpip47RHCBQ2Q';

// Cliente Supabase único, compartilhado por login, admin e site público.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.Banco = {
  sb,

  /**
   * Faz login com e-mail e senha. Devolve o usuário ou lança um erro com
   * uma mensagem em português, pronta pra mostrar na tela.
   */
  async login(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('E-mail ou senha incorretos');
      }
      throw new Error(error.message);
    }

    return data.user;
  },

  /**
   * O "guarda" que roda no topo de toda página protegida (o admin). Sem
   * sessão, manda pro login e devolve null. Com sessão, devolve o usuário.
   */
  async checkAuth() {
    const { data, error } = await sb.auth.getSession();

    if (error || !data.session) {
      window.location.href = '/login/';
      return null;
    }

    return data.session.user;
  },

  /**
   * Encerra a sessão e volta pro login.
   */
  async logout() {
    await sb.auth.signOut();
    window.location.href = '/login/';
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
