/* ==========================================================================
   admin/script.js
   Lógica do painel novo: Portfólio, Marcas, Calendário, Campanhas e
   Checklist. Depende de js/banco.js (já carregado antes deste arquivo).
   ========================================================================== */

// "sb" já existe como variável global, criada pelo js/banco.js (que é
// carregado antes deste arquivo). Não precisa criar de novo aqui.

/* ---------------------------------------------------------------------
   Estado em memória (carregado uma vez, refiltrado/redesenhado na tela).
   --------------------------------------------------------------------- */
let todosVideos = [];
let todasVisitas = [];
let todasMarcas = [];
let todoCalendario = [];
let todasCampanhas = [];
let marcadosSet = new Set();

let buscaMarcasAtual = '';
let filtroSituacaoAtual = 'todas';

let mesCalAtual = new Date().getMonth();
let anoCalAtual = new Date().getFullYear();
let filtroTipoCalendario = 'todos';
let dataPreenchidaCalendario = null;

let filtroCampanhasAtual = 'todas';
let buscaCampanhasAtual = '';
let ordemCampanhasCampo = 'prazo';
let ordemCampanhasAsc = true;

let modalTipoAtual = null;
let modalIdEdicao = null;

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const STATUS_CAMPANHA = ['Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue'];
const SITUACAO_LABEL = { lead: 'Lead', conversando: 'Conversando', cliente: 'Cliente', parada: 'Parada' };
const SITUACAO_CLASSE = { lead: 'sit-lead', conversando: 'sit-conversando', cliente: 'sit-cliente', parada: 'sit-parada' };

/* ---------------------------------------------------------------------
   Funções utilitárias.
   --------------------------------------------------------------------- */

// Busca todas as linhas de uma tabela, contornando o limite de 1000 linhas
// por consulta do Supabase, buscando em blocos até acabar.
async function buscarTudo(tabela, colunaOrdem) {
  const TAMANHO_BLOCO = 1000;
  let resultado = [];
  let inicio = 0;
  while (true) {
    let consulta = sb.from(tabela).select('*').range(inicio, inicio + TAMANHO_BLOCO - 1);
    if (colunaOrdem) consulta = consulta.order(colunaOrdem, { ascending: true });
    const { data, error } = await consulta;
    if (error) throw error;
    resultado = resultado.concat(data);
    if (data.length < TAMANHO_BLOCO) break;
    inicio += TAMANHO_BLOCO;
  }
  return resultado;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarNumero(n) {
  return (n === null || n === undefined || n === '') ? '-' : Number(n).toLocaleString('pt-BR');
}
function formatarDataISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatarDataCompleta(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
function formatarDataHoraCompleta(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// Escapa texto antes de colocar em innerHTML, importante porque "marcas" e
// "visitas" recebem dados de qualquer visitante pelo site público.
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : String(texto);
  return div.innerHTML;
}
function normalizarClasse(texto) {
  return (texto || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}
function extrairIdYoutube(valor) {
  if (!valor) return valor;
  const v = valor.trim();
  const padroes = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /shorts\/([a-zA-Z0-9_-]{6,})/,
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /embed\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const p of padroes) {
    const m = v.match(p);
    if (m) return m[1];
  }
  return v;
}

async function apagarRegistro(tabela, id, aoTerminar) {
  if (!confirm('Tem certeza que deseja apagar?')) return;
  try {
    const { error } = await sb.from(tabela).delete().eq('id', id);
    if (error) throw error;
    if (aoTerminar) await aoTerminar();
  } catch (erro) {
    alert('Não foi possível apagar. Tente novamente.');
    console.error(erro);
  }
}

function baixarCsv(nomeArquivo, cabecalhos, linhas) {
  const escaparCampo = (v) => {
    const texto = String(v === null || v === undefined ? '' : v);
    if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };
  const conteudo = [cabecalhos, ...linhas].map((linha) => linha.map(escaparCampo).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================================================
   MODAL GENÉRICO (vídeo, marca, item de calendário, campanha)
   ======================================================================== */
const CAMPOS_MODAL = {
  video: [
    { nome: 'titulo', rotulo: 'Título', tipo: 'text' },
    { nome: 'link', rotulo: 'Link do YouTube (ou só o ID)', tipo: 'text' },
    { nome: 'nicho', rotulo: 'Nicho', tipo: 'text' },
    { nome: 'formato', rotulo: 'Formato', tipo: 'text' },
    { nome: 'marca', rotulo: 'Marca (opcional)', tipo: 'text' },
    { nome: 'destaque', rotulo: 'Destaque (opcional, ex: 2,4M views)', tipo: 'text' },
    { nome: 'visivel', rotulo: 'Visível no site', tipo: 'checkbox' },
  ],
  marca: [
    { nome: 'nome', rotulo: 'Marca', tipo: 'text' },
    { nome: 'instagram', rotulo: 'Instagram (@usuario)', tipo: 'text' },
    { nome: 'email', rotulo: 'E-mail', tipo: 'text' },
    { nome: 'telefone', rotulo: 'Telefone (com DDD)', tipo: 'text' },
    { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: [['lead', 'Lead'], ['conversando', 'Conversando'], ['cliente', 'Cliente'], ['parada', 'Parada']] },
    { nome: 'obs', rotulo: 'Observação', tipo: 'textarea' },
    { nome: 'ultimo_contato', rotulo: 'Último contato', tipo: 'date' },
  ],
  item_calendario: [
    { nome: 'titulo', rotulo: 'Título', tipo: 'text' },
    { nome: 'marca', rotulo: 'Marca (opcional)', tipo: 'text' },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['gravar', 'Gravar'], ['editar', 'Editar'], ['postar', 'Postar']] },
    { nome: 'data', rotulo: 'Data', tipo: 'date' },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: [['a_fazer', 'A fazer'], ['feito', 'Feito']] },
  ],
  campanha: [
    { nome: 'campanha', rotulo: 'Campanha', tipo: 'text' },
    { nome: 'cliente', rotulo: 'Cliente', tipo: 'text' },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['Conteúdo', 'Conteúdo'], ['Publicidade', 'Publicidade']] },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: STATUS_CAMPANHA.map((s) => [s, s]) },
    { nome: 'qtd', rotulo: 'Quantidade', tipo: 'number' },
    { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number' },
    { nome: 'prazo', rotulo: 'Prazo', tipo: 'date' },
    { nome: 'pagamento', rotulo: 'Pagamento', tipo: 'select', opcoes: [['pendente', 'Pendente'], ['pago', 'Pago']] },
    { nome: 'ativa', rotulo: 'Campanha ativa', tipo: 'checkbox' },
    { nome: 'favorita', rotulo: 'Favorita (com estrela)', tipo: 'checkbox' },
  ],
};
const TITULOS_MODAL = { video: 'vídeo', marca: 'marca', item_calendario: 'item', campanha: 'campanha' };
const TABELAS_MODAL = { video: 'videos', marca: 'marcas', item_calendario: 'calendario', campanha: 'campanhas' };

function abrirModal(tipo, itemExistente) {
  modalTipoAtual = tipo;
  modalIdEdicao = itemExistente && itemExistente.id ? itemExistente.id : null;

  document.getElementById('modal-titulo').textContent = (modalIdEdicao ? 'Editar ' : 'Novo(a) ') + TITULOS_MODAL[tipo];

  document.getElementById('modal-campos').innerHTML = CAMPOS_MODAL[tipo].map((campo) => {
    let valorAtual = itemExistente ? (itemExistente[campo.nome] ?? '') : '';
    if (!itemExistente && campo.nome === 'data' && dataPreenchidaCalendario) valorAtual = dataPreenchidaCalendario;
    if (!itemExistente && campo.tipo === 'checkbox' && (campo.nome === 'visivel' || campo.nome === 'ativa')) valorAtual = true;
    if (!itemExistente && campo.nome === 'qtd') valorAtual = 1;

    if (campo.tipo === 'select') {
      return `<div class="campo"><label for="campo-${campo.nome}">${campo.rotulo}</label>
        <select id="campo-${campo.nome}" name="${campo.nome}">
          ${campo.opcoes.map(([v, t]) => `<option value="${escaparHtml(v)}" ${valorAtual === v ? 'selected' : ''}>${escaparHtml(t)}</option>`).join('')}
        </select></div>`;
    }
    if (campo.tipo === 'checkbox') {
      return `<div class="campo campo-checkbox"><input type="checkbox" id="campo-${campo.nome}" name="${campo.nome}" ${valorAtual ? 'checked' : ''} /><label for="campo-${campo.nome}">${campo.rotulo}</label></div>`;
    }
    if (campo.tipo === 'textarea') {
      return `<div class="campo"><label for="campo-${campo.nome}">${campo.rotulo}</label><textarea id="campo-${campo.nome}" name="${campo.nome}" rows="3">${escaparHtml(valorAtual)}</textarea></div>`;
    }
    const passo = campo.tipo === 'number' ? 'step="0.01"' : '';
    return `<div class="campo"><label for="campo-${campo.nome}">${campo.rotulo}</label><input type="${campo.tipo}" id="campo-${campo.nome}" name="${campo.nome}" value="${escaparHtml(valorAtual)}" ${passo} /></div>`;
  }).join('');

  document.getElementById('modal-overlay').classList.remove('oculto');
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('oculto');
  modalTipoAtual = null;
  modalIdEdicao = null;
  dataPreenchidaCalendario = null;
}

function configurarModal() {
  document.getElementById('modal-cancelar').addEventListener('click', fecharModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') fecharModal();
  });

  document.getElementById('modal-form').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const campos = CAMPOS_MODAL[modalTipoAtual];
    const dados = {};
    campos.forEach((campo) => {
      const el = document.getElementById(`campo-${campo.nome}`);
      if (campo.tipo === 'checkbox') dados[campo.nome] = el.checked;
      else if (campo.tipo === 'number') dados[campo.nome] = el.value === '' ? 0 : Number(el.value);
      else dados[campo.nome] = el.value || null;
    });

    if (modalTipoAtual === 'video' && dados.link) dados.link = extrairIdYoutube(dados.link);

    const tabela = TABELAS_MODAL[modalTipoAtual];
    const botaoSalvar = document.getElementById('modal-salvar');
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';

    try {
      if (modalIdEdicao) {
        const { error } = await sb.from(tabela).update(dados).eq('id', modalIdEdicao);
        if (error) throw error;
      } else {
        if (modalTipoAtual === 'video') {
          const maiorOrdem = todosVideos.reduce((m, v) => Math.max(m, v.ordem || 0), -1);
          dados.ordem = maiorOrdem + 1;
        }
        const { error } = await sb.from(tabela).insert(dados);
        if (error) throw error;
      }
      fecharModal();
      if (modalTipoAtual === 'video') await recarregarPortfolio();
      else if (modalTipoAtual === 'marca') await recarregarMarcas();
      else if (modalTipoAtual === 'item_calendario') await recarregarCalendario();
      else if (modalTipoAtual === 'campanha') await recarregarCampanhas();
    } catch (erro) {
      alert('Não foi possível salvar. Tente novamente.');
      console.error(erro);
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar';
    }
  });
}

/* ========================================================================
   ABA PORTFÓLIO
   ======================================================================== */
async function recarregarPortfolio() {
  try {
    [todosVideos, todasVisitas] = await Promise.all([
      buscarTudo('videos', 'ordem'),
      buscarTudo('visitas'),
    ]);
    document.getElementById('aviso-erro-portfolio').classList.add('oculto');
  } catch (erro) {
    console.error('Erro ao carregar portfólio:', erro);
    const aviso = document.getElementById('aviso-erro-portfolio');
    aviso.textContent = 'Não foi possível carregar os dados do portfólio. Confira se o banco.sql já foi executado no Supabase.';
    aviso.classList.remove('oculto');
  }
  renderizarPortfolio();
}

function renderizarPortfolio() {
  const hojeISO = formatarDataISO(new Date());
  const limite14 = new Date();
  limite14.setDate(limite14.getDate() - 13);
  limite14.setHours(0, 0, 0, 0);

  const visitas14 = todasVisitas.filter((v) => new Date(v.created_at) >= limite14);
  const visitasHoje = todasVisitas.filter((v) => (v.created_at || '').slice(0, 10) === hojeISO);
  const videosAr = todosVideos.filter((v) => v.visivel);

  const contagemNicho = {};
  videosAr.forEach((v) => { const n = v.nicho || 'Sem nicho'; contagemNicho[n] = (contagemNicho[n] || 0) + 1; });
  const nichoForte = Object.entries(contagemNicho).sort((a, b) => b[1] - a[1])[0];

  const contagemOrigem = {};
  todasVisitas.forEach((v) => { const o = v.origem || 'Direto'; contagemOrigem[o] = (contagemOrigem[o] || 0) + 1; });
  const origemForte = Object.entries(contagemOrigem).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('m-visitas-14d').textContent = visitas14.length;
  document.getElementById('m-visitas-hoje').textContent = visitasHoje.length;
  document.getElementById('m-videos-ar').textContent = videosAr.length;
  document.getElementById('m-nicho-forte').textContent = nichoForte ? nichoForte[0] : 'Sem dados ainda';
  document.getElementById('m-origem-forte').textContent = origemForte ? origemForte[0] : 'Sem dados ainda';

  desenharGraficoVisitas(todasVisitas);
  renderizarOrigens(contagemOrigem, todasVisitas.length);
  renderizarTabelaVideos();
}

function desenharGraficoVisitas(visitas) {
  const container = document.getElementById('grafico-visitas');
  if (visitas.length === 0) {
    container.innerHTML = '<p class="estado-vazio">Assim que as pessoas começarem a visitar o seu portfólio, este gráfico vai mostrar quantas visitas você teve em cada um dos últimos 14 dias.</p>';
    return;
  }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(hoje); d.setDate(d.getDate() - i); dias.push(d); }
  const contagens = dias.map(() => 0);
  visitas.forEach((v) => {
    const d = new Date(v.created_at); d.setHours(0, 0, 0, 0);
    const idx = dias.findIndex((dd) => dd.getTime() === d.getTime());
    if (idx !== -1) contagens[idx]++;
  });
  const maior = Math.max(...contagens, 1);
  const fmtRot = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  const fmtTit = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
  container.innerHTML = `<div class="grafico-barras">${dias.map((d, i) => {
    const altura = Math.round((contagens[i] / maior) * 100) + 4;
    return `<div class="barra-dia" title="${fmtTit.format(d)}: ${contagens[i]} visita(s)"><div class="barra" style="height:${altura}px"></div><span class="rotulo-dia">${fmtRot.format(d)}</span></div>`;
  }).join('')}</div>`;
}

function renderizarOrigens(contagemOrigem, total) {
  const container = document.getElementById('lista-origens');
  if (total === 0) {
    container.innerHTML = '<p class="estado-vazio">Assim que as pessoas começarem a visitar, aqui vai aparecer de onde elas mais vêm (Instagram, TikTok, busca no Google etc).</p>';
    return;
  }
  const ordenado = Object.entries(contagemOrigem).sort((a, b) => b[1] - a[1]);
  container.innerHTML = ordenado.map(([origem, qtd]) => `<div class="linha-origem"><span>${escaparHtml(origem)}</span><strong>${qtd}</strong></div>`).join('');
}

function renderizarTabelaVideos() {
  const tbody = document.querySelector('#tabela-videos tbody');
  if (todosVideos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><p class="estado-vazio">Nenhum vídeo cadastrado ainda.</p></td></tr>';
    return;
  }
  const ordenados = [...todosVideos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  tbody.innerHTML = ordenados.map((v) => `
    <tr draggable="true" data-id="${v.id}">
      <td><span class="alcinha">⠿</span></td>
      <td>${escaparHtml(v.titulo)}</td>
      <td>${escaparHtml(v.nicho) || '-'}</td>
      <td>${escaparHtml(v.marca) || '-'}</td>
      <td>${escaparHtml(v.destaque) || '-'}</td>
      <td><button type="button" class="botao-icone" data-alternar-visivel="${v.id}" aria-label="Mostrar ou esconder">${v.visivel ? '<span class="olho-visivel">&#128065;</span>' : '<span class="olho-oculto">&#10005;</span>'}</button></td>
      <td style="white-space:nowrap;">
        <button type="button" class="botao-icone" data-editar-video="${v.id}" aria-label="Editar">&#9998;</button>
        <button type="button" class="botao-icone" data-apagar-video="${v.id}" aria-label="Apagar">&#128465;</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-alternar-visivel]').forEach((btn) => btn.addEventListener('click', () => alternarVisivelVideo(btn.dataset.alternarVisivel)));
  tbody.querySelectorAll('[data-editar-video]').forEach((btn) => btn.addEventListener('click', () => abrirModal('video', todosVideos.find((v) => v.id === btn.dataset.editarVideo))));
  tbody.querySelectorAll('[data-apagar-video]').forEach((btn) => btn.addEventListener('click', () => apagarRegistro('videos', btn.dataset.apagarVideo, recarregarPortfolio)));
  configurarDragVideos(tbody);
}

async function alternarVisivelVideo(id) {
  const video = todosVideos.find((v) => v.id === id);
  if (!video) return;
  try {
    const { error } = await sb.from('videos').update({ visivel: !video.visivel }).eq('id', id);
    if (error) throw error;
    video.visivel = !video.visivel;
    renderizarPortfolio();
  } catch (erro) {
    alert('Não foi possível atualizar. Tente novamente.');
    console.error(erro);
  }
}

let videoArrastandoId = null;
function configurarDragVideos(tbody) {
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('dragstart', () => { videoArrastandoId = tr.dataset.id; tr.classList.add('arrastando'); });
    tr.addEventListener('dragend', async () => { tr.classList.remove('arrastando'); videoArrastandoId = null; await salvarOrdemVideos(tbody); });
    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!videoArrastandoId || tr.dataset.id === videoArrastandoId) return;
      const retangulo = tr.getBoundingClientRect();
      const depois = (e.clientY - retangulo.top) / retangulo.height > 0.5;
      const arrastado = tbody.querySelector(`tr[data-id="${videoArrastandoId}"]`);
      if (!arrastado) return;
      if (depois) tr.after(arrastado); else tr.before(arrastado);
    });
  });
}

async function salvarOrdemVideos(tbody) {
  const linhas = [...tbody.querySelectorAll('tr[data-id]')];
  const atualizacoes = linhas.map((tr, indice) => ({ id: tr.dataset.id, ordem: indice }));
  try {
    await Promise.all(atualizacoes.map((a) => sb.from('videos').update({ ordem: a.ordem }).eq('id', a.id)));
    atualizacoes.forEach((a) => { const v = todosVideos.find((vv) => vv.id === a.id); if (v) v.ordem = a.ordem; });
  } catch (erro) {
    alert('Não foi possível salvar a nova ordem. Tente novamente.');
    console.error(erro);
    await recarregarPortfolio();
  }
}

function configurarPortfolioUI() {
  document.getElementById('botao-novo-video').addEventListener('click', () => abrirModal('video'));
}

/* ========================================================================
   ABA MARCAS
   ======================================================================== */
async function recarregarMarcas() {
  try {
    todasMarcas = await buscarTudo('marcas');
    document.getElementById('aviso-erro-marcas').classList.add('oculto');
  } catch (erro) {
    console.error('Erro ao carregar marcas:', erro);
    const aviso = document.getElementById('aviso-erro-marcas');
    aviso.textContent = 'Não foi possível carregar as marcas. Confira se o banco.sql já foi executado no Supabase.';
    aviso.classList.remove('oculto');
  }
  renderizarMarcas();
  renderizarMensagens();
}

function marcasFiltradas() {
  return todasMarcas.filter((m) => {
    if (filtroSituacaoAtual !== 'todas' && m.situacao !== filtroSituacaoAtual) return false;
    if (buscaMarcasAtual) {
      const alvo = `${m.nome || ''} ${m.instagram || ''} ${m.email || ''}`.toLowerCase();
      if (!alvo.includes(buscaMarcasAtual.toLowerCase())) return false;
    }
    return true;
  });
}

function renderizarMarcas() {
  const tbody = document.querySelector('#tabela-marcas tbody');
  const lista = marcasFiltradas();

  if (todasMarcas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><p class="estado-vazio">Nenhuma marca cadastrada ainda. Elas também chegam sozinhas aqui quando alguém preenche o formulário do seu site.</p></td></tr>';
    return;
  }
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><p class="estado-vazio">Nenhuma marca encontrada com esse filtro.</p></td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((m) => {
    const telefoneDigitos = (m.telefone || '').replace(/\D/g, '');
    const handleLimpo = (m.instagram || '').replace('@', '').trim();
    return `
    <tr data-id="${m.id}" style="cursor:pointer;">
      <td>${escaparHtml(m.nome) || '-'}</td>
      <td>${handleLimpo ? `<a href="https://www.instagram.com/${escaparHtml(handleLimpo)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escaparHtml(m.instagram)}</a>` : '-'}</td>
      <td>${escaparHtml(m.email) || '-'}</td>
      <td>${telefoneDigitos ? `<a href="https://wa.me/${telefoneDigitos}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escaparHtml(m.telefone)}</a>` : '-'}</td>
      <td><span class="pilula ${SITUACAO_CLASSE[m.situacao] || 'sit-lead'}">${SITUACAO_LABEL[m.situacao] || escaparHtml(m.situacao)}</span></td>
      <td>${formatarDataCompleta(m.ultimo_contato) || '-'}</td>
      <td><button type="button" class="botao-icone" data-apagar-marca="${m.id}" aria-label="Apagar" onclick="event.stopPropagation()">&#128465;</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => abrirModal('marca', todasMarcas.find((m) => m.id === tr.dataset.id)));
  });
  tbody.querySelectorAll('[data-apagar-marca]').forEach((btn) => {
    btn.addEventListener('click', () => apagarRegistro('marcas', btn.dataset.apagarMarca, recarregarMarcas));
  });
}

/* ========================================================================
   ABA MENSAGENS (caixa de entrada)
   Reaproveita os dados que já vêm de "marcas" (o mesmo formulário do site
   grava nome/e-mail/telefone/observação ali). Aqui é só outra forma de ver
   essas mesmas linhas, focada na mensagem em si.
   ======================================================================== */
function mensagensDeMarcas() {
  return todasMarcas
    .filter((m) => m.obs && m.obs.trim() !== '')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

function renderizarMensagens() {
  const lista = mensagensDeMarcas();
  const naoLidas = lista.filter((m) => !m.lida).length;
  const contador = document.getElementById('contador-nao-lidas');
  if (contador) contador.textContent = `${naoLidas} não lida${naoLidas === 1 ? '' : 's'}`;

  const container = document.getElementById('lista-mensagens');
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = '<p class="estado-vazio">Nenhuma mensagem recebida ainda.</p>';
    return;
  }

  container.innerHTML = lista.map((m) => {
    const telefoneDigitos = (m.telefone || '').replace(/\D/g, '');
    return `
      <div class="cartao-mensagem ${!m.lida ? 'nao-lida' : ''}" data-id="${m.id}">
        <div class="topo-msg">
          <span class="remetente">${escaparHtml(m.nome) || 'Sem nome'} ${!m.lida ? '<span class="badge-nao-lida">nova</span>' : ''}</span>
          <span class="data-msg">${formatarDataHoraCompleta(m.created_at)}</span>
        </div>
        <div class="preview-msg">${escaparHtml(m.obs)}</div>
        <div class="corpo-msg">
          <p style="margin:0 0 10px; white-space:pre-wrap;">${escaparHtml(m.obs)}</p>
          <p style="font-size:12px; color:var(--texto-suave); margin:0;">${escaparHtml(m.email) || 'Sem e-mail'}${m.telefone ? ' · ' + escaparHtml(m.telefone) : ''}</p>
          <div class="acoes-msg">
            <a class="botao botao-secundario" href="mailto:${encodeURIComponent(m.email || '')}" onclick="event.stopPropagation()">Responder por e-mail</a>
            ${telefoneDigitos ? `<a class="botao botao-secundario" href="https://wa.me/${telefoneDigitos}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>` : ''}
            <button type="button" class="botao botao-secundario" data-ver-em-marcas="${m.id}">Ver em Marcas</button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.cartao-mensagem').forEach((cartao) => {
    cartao.addEventListener('click', async () => {
      cartao.classList.toggle('aberta');
      const msg = todasMarcas.find((m) => m.id === cartao.dataset.id);
      if (msg && !msg.lida) await marcarMensagemLida(cartao.dataset.id);
    });
  });
  container.querySelectorAll('[data-ver-em-marcas]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.nav-item[data-tab="marcas"]').click();
      abrirModal('marca', todasMarcas.find((m) => m.id === btn.dataset.verEmMarcas));
    });
  });
}

async function marcarMensagemLida(id) {
  try {
    const { error } = await sb.from('marcas').update({ lida: true }).eq('id', id);
    if (error) throw error;
    const m = todasMarcas.find((mm) => mm.id === id);
    if (m) m.lida = true;
    renderizarMensagens();
  } catch (erro) {
    console.error('Não foi possível marcar a mensagem como lida:', erro);
  }
}

function configurarMarcasUI() {
  document.getElementById('busca-marcas').addEventListener('input', (e) => { buscaMarcasAtual = e.target.value; renderizarMarcas(); });
  document.getElementById('filtro-situacao').addEventListener('change', (e) => { filtroSituacaoAtual = e.target.value; renderizarMarcas(); });
  document.getElementById('botao-nova-marca').addEventListener('click', () => abrirModal('marca'));
  document.getElementById('botao-csv-marcas').addEventListener('click', () => {
    const linhas = marcasFiltradas().map((m) => [m.nome, m.instagram, m.email, m.telefone, SITUACAO_LABEL[m.situacao] || m.situacao, m.obs, formatarDataCompleta(m.ultimo_contato)]);
    baixarCsv('marcas.csv', ['Marca', 'Instagram', 'E-mail', 'Telefone', 'Situação', 'Observação', 'Último contato'], linhas);
  });
}

/* ========================================================================
   ABA CALENDÁRIO
   ======================================================================== */
async function recarregarCalendario() {
  try {
    todoCalendario = await buscarTudo('calendario');
    document.getElementById('aviso-erro-calendario').classList.add('oculto');
  } catch (erro) {
    console.error('Erro ao carregar calendário:', erro);
    const aviso = document.getElementById('aviso-erro-calendario');
    aviso.textContent = 'Não foi possível carregar o calendário. Confira se o banco.sql já foi executado no Supabase.';
    aviso.classList.remove('oculto');
  }
  renderizarCalendario();
}

function itensDoDia(iso) {
  const doCalendario = todoCalendario
    .filter((c) => c.data === iso && (filtroTipoCalendario === 'todos' || c.tipo === filtroTipoCalendario))
    .map((c) => ({ tipoItem: 'calendario', id: c.id, titulo: c.titulo, feito: c.status === 'feito' }));
  const daCampanha = todasCampanhas
    .filter((camp) => camp.prazo === iso)
    .map((camp) => ({ tipoItem: 'prazo_campanha', id: camp.id, titulo: `Prazo: ${camp.campanha}`, feito: camp.status === 'Entregue' }));
  return [...doCalendario, ...daCampanha];
}

function renderizarCalendario() {
  document.getElementById('titulo-mes').textContent = `${NOMES_MESES[mesCalAtual]} ${anoCalAtual}`;

  const primeiroDia = new Date(anoCalAtual, mesCalAtual, 1);
  const diaSemanaPrimeiro = (primeiroDia.getDay() + 6) % 7;
  const diasNoMes = new Date(anoCalAtual, mesCalAtual + 1, 0).getDate();
  const diasMesAnterior = new Date(anoCalAtual, mesCalAtual, 0).getDate();

  const celulas = [];
  for (let i = diaSemanaPrimeiro - 1; i >= 0; i--) celulas.push({ dia: diasMesAnterior - i, foraDoMes: true, mesOffset: -1 });
  for (let d = 1; d <= diasNoMes; d++) celulas.push({ dia: d, foraDoMes: false, mesOffset: 0 });
  let proximoDia = 1;
  while (celulas.length % 7 !== 0) celulas.push({ dia: proximoDia++, foraDoMes: true, mesOffset: 1 });

  const hojeISO = formatarDataISO(new Date());
  const container = document.getElementById('grade-dias-calendario');

  container.innerHTML = celulas.map((c) => {
    let ano = anoCalAtual, mes = mesCalAtual;
    if (c.mesOffset === -1) { mes = mesCalAtual - 1; if (mes < 0) { mes = 11; ano--; } }
    if (c.mesOffset === 1) { mes = mesCalAtual + 1; if (mes > 11) { mes = 0; ano++; } }
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(c.dia).padStart(2, '0')}`;
    const itens = c.foraDoMes ? [] : itensDoDia(iso);
    const visiveis = itens.slice(0, 3);
    const restantes = itens.length - 3;

    return `
      <div class="dia-mes ${c.foraDoMes ? 'fora-do-mes' : ''} ${iso === hojeISO ? 'hoje' : ''}" data-iso="${iso}">
        <span class="numero-dia">${c.dia}</span>
        ${!c.foraDoMes ? `<button type="button" class="botao-add-dia" data-add-dia="${iso}" aria-label="Adicionar">+</button>` : ''}
        ${visiveis.map((item) => `<div class="item-dia ${item.feito ? 'feito' : ''} ${item.tipoItem === 'prazo_campanha' ? 'prazo-campanha' : ''}" data-abrir-item="${item.tipoItem}:${item.id}">${escaparHtml(item.titulo)}</div>`).join('')}
        ${restantes > 0 ? `<span class="item-dia-mais" data-mais-dia="${iso}">+${restantes} mais</span>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-add-dia]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); dataPreenchidaCalendario = btn.dataset.addDia; abrirModal('item_calendario'); });
  });
  container.querySelectorAll('.dia-mes:not(.fora-do-mes)').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-dia]') || e.target.closest('[data-abrir-item]') || e.target.closest('[data-mais-dia]')) return;
      dataPreenchidaCalendario = el.dataset.iso;
      abrirModal('item_calendario');
    });
  });
  container.querySelectorAll('[data-abrir-item]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const [tipoItem, id] = el.dataset.abrirItem.split(':');
      if (tipoItem === 'calendario') abrirModal('item_calendario', todoCalendario.find((c) => c.id === id));
      else document.querySelector('.nav-item[data-tab="campanhas"]').click();
    });
  });
  container.querySelectorAll('[data-mais-dia]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); abrirModalDia(el.dataset.maisDia); });
  });

  renderizarAtrasados();
}

function abrirModalDia(iso) {
  const itens = itensDoDia(iso);
  document.getElementById('modal-dia-titulo').textContent = formatarDataCompleta(iso);
  document.getElementById('modal-dia-lista').innerHTML = itens.map((item) => `
    <div class="item-dia ${item.feito ? 'feito' : ''} ${item.tipoItem === 'prazo_campanha' ? 'prazo-campanha' : ''}" style="margin-bottom:6px; cursor:pointer;" data-abrir-item-modal="${item.tipoItem}:${item.id}">${escaparHtml(item.titulo)}</div>
  `).join('');
  document.getElementById('modal-dia-lista').querySelectorAll('[data-abrir-item-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const [tipoItem, id] = el.dataset.abrirItemModal.split(':');
      fecharModalDia();
      if (tipoItem === 'calendario') abrirModal('item_calendario', todoCalendario.find((c) => c.id === id));
      else document.querySelector('.nav-item[data-tab="campanhas"]').click();
    });
  });
  document.getElementById('modal-dia-overlay').classList.remove('oculto');
}
function fecharModalDia() { document.getElementById('modal-dia-overlay').classList.add('oculto'); }
function configurarModalDia() {
  document.getElementById('modal-dia-fechar').addEventListener('click', fecharModalDia);
  document.getElementById('modal-dia-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-dia-overlay') fecharModalDia(); });
}

function renderizarAtrasados() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const atrasados = todoCalendario.filter((c) => c.status === 'a_fazer' && c.data && new Date(`${c.data}T00:00:00`) < hoje);
  const container = document.getElementById('lista-atrasados');
  if (atrasados.length === 0) {
    container.innerHTML = '<p class="estado-vazio">Nada ficou pra trás. Tudo em dia.</p>';
    return;
  }
  atrasados.sort((a, b) => a.data.localeCompare(b.data));
  container.innerHTML = atrasados.map((c) => {
    const dias = Math.round((hoje - new Date(`${c.data}T00:00:00`)) / 86400000);
    return `<div class="linha-atrasado"><span>${escaparHtml(c.titulo)}${c.marca ? ' · ' + escaparHtml(c.marca) : ''}</span><strong style="color:var(--erro)">${dias} dia${dias === 1 ? '' : 's'}</strong></div>`;
  }).join('');
}

function configurarCalendarioUI() {
  document.getElementById('mes-anterior').addEventListener('click', () => { mesCalAtual--; if (mesCalAtual < 0) { mesCalAtual = 11; anoCalAtual--; } renderizarCalendario(); });
  document.getElementById('mes-seguinte').addEventListener('click', () => { mesCalAtual++; if (mesCalAtual > 11) { mesCalAtual = 0; anoCalAtual++; } renderizarCalendario(); });
  document.getElementById('botao-este-mes').addEventListener('click', () => { const h = new Date(); mesCalAtual = h.getMonth(); anoCalAtual = h.getFullYear(); renderizarCalendario(); });
  document.getElementById('botao-novo-item-calendario').addEventListener('click', () => { dataPreenchidaCalendario = formatarDataISO(new Date()); abrirModal('item_calendario'); });
  document.querySelectorAll('#filtro-tipo-calendario button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filtro-tipo-calendario button').forEach((b) => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      filtroTipoCalendario = btn.dataset.tipo;
      renderizarCalendario();
    });
  });
}

/* ========================================================================
   ABA CAMPANHAS
   ======================================================================== */
async function recarregarCampanhas() {
  try {
    todasCampanhas = await buscarTudo('campanhas');
    document.getElementById('aviso-erro-campanhas').classList.add('oculto');
  } catch (erro) {
    console.error('Erro ao carregar campanhas:', erro);
    const aviso = document.getElementById('aviso-erro-campanhas');
    aviso.textContent = 'Não foi possível carregar as campanhas. Confira se o banco.sql já foi executado no Supabase.';
    aviso.classList.remove('oculto');
  }
  renderizarCampanhas();
  renderizarCalendario(); // os prazos de campanha aparecem sozinhos no calendário
}

function campanhasFiltradas() {
  return todasCampanhas.filter((c) => {
    if (filtroCampanhasAtual === 'ativas' && !c.ativa) return false;
    if (filtroCampanhasAtual === 'finalizadas' && c.ativa) return false;
    if (buscaCampanhasAtual) {
      const alvo = `${c.campanha || ''} ${c.cliente || ''}`.toLowerCase();
      if (!alvo.includes(buscaCampanhasAtual.toLowerCase())) return false;
    }
    return true;
  });
}

function ordenarCampanhas(lista) {
  const campo = ordemCampanhasCampo;
  const copia = [...lista];
  copia.sort((a, b) => {
    let va = a[campo], vb = b[campo];
    if (campo === 'status') { va = STATUS_CAMPANHA.indexOf(a.status); vb = STATUS_CAMPANHA.indexOf(b.status); }
    else if (campo === 'valor' || campo === 'qtd') { va = Number(va || 0); vb = Number(vb || 0); }
    else { va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase(); }
    if (va < vb) return ordemCampanhasAsc ? -1 : 1;
    if (va > vb) return ordemCampanhasAsc ? 1 : -1;
    return 0;
  });
  return copia;
}

function renderizarCampanhas() {
  const total = todasCampanhas.length;
  const ativas = todasCampanhas.filter((c) => c.ativa).length;
  const valorTotal = todasCampanhas.reduce((s, c) => s + Number(c.valor || 0), 0);
  const qtdTotal = todasCampanhas.reduce((s, c) => s + Number(c.qtd || 0), 0);
  const ticketMedio = qtdTotal > 0 ? valorTotal / qtdTotal : 0;
  const aReceber = todasCampanhas.filter((c) => c.pagamento === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);
  const recebido = todasCampanhas.filter((c) => c.pagamento === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);

  document.getElementById('c-total').textContent = total;
  document.getElementById('c-ativas').textContent = ativas;
  document.getElementById('c-valor-total').textContent = formatarMoeda(valorTotal);
  document.getElementById('c-ticket-medio').textContent = formatarMoeda(ticketMedio);
  document.getElementById('c-a-receber').textContent = formatarMoeda(aReceber);
  document.getElementById('c-recebido').textContent = formatarMoeda(recebido);

  const tbody = document.querySelector('#tabela-campanhas tbody');
  const lista = ordenarCampanhas(campanhasFiltradas());

  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="10"><p class="estado-vazio">Nenhuma campanha cadastrada ainda.</p></td></tr>';
  } else if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10"><p class="estado-vazio">Nenhuma campanha encontrada com esse filtro.</p></td></tr>';
  } else {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    tbody.innerHTML = lista.map((c) => {
      let etiquetaPrazo = '';
      if (c.prazo && c.status !== 'Entregue') {
        const dataPrazo = new Date(`${c.prazo}T00:00:00`);
        const diffDias = Math.round((dataPrazo - hoje) / 86400000);
        if (diffDias < 0) etiquetaPrazo = `<span class="pilula etiqueta-atrasado">Atrasado, ${Math.abs(diffDias)}d</span>`;
        else if (diffDias <= 3) etiquetaPrazo = `<span class="pilula etiqueta-vence">Vence em ${diffDias}d</span>`;
      }
      const classeStatus = 'status-' + normalizarClasse(c.status);
      const classeTipo = 'tipo-' + normalizarClasse(c.tipo);
      return `
        <tr data-id="${c.id}" class="${c.favorita ? 'linha-favorita' : ''}">
          <td><button type="button" class="estrela-fav ${c.favorita ? 'marcada' : ''}" data-fav="${c.id}" aria-label="Favoritar">&#9733;</button></td>
          <td>${escaparHtml(c.campanha)}</td>
          <td>${escaparHtml(c.cliente) || '-'}</td>
          <td><span class="pilula ${classeTipo}">${escaparHtml(c.tipo) || '-'}</span></td>
          <td><span class="pilula ${classeStatus}">${escaparHtml(c.status)}</span></td>
          <td>${c.qtd ?? '-'}</td>
          <td>${formatarMoeda(c.valor)}</td>
          <td>${formatarDataCompleta(c.prazo) || '-'} ${etiquetaPrazo}</td>
          <td><span class="pilula pag-${c.pagamento}">${c.pagamento === 'pago' ? 'Pago' : 'Pendente'}</span></td>
          <td style="white-space:nowrap;">
            <button type="button" class="botao-icone" data-editar-campanha="${c.id}" aria-label="Editar">&#9998;</button>
            <button type="button" class="botao-icone" data-apagar-campanha="${c.id}" aria-label="Apagar">&#128465;</button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-fav]').forEach((btn) => btn.addEventListener('click', () => alternarFavoritaCampanha(btn.dataset.fav)));
    tbody.querySelectorAll('[data-editar-campanha]').forEach((btn) => btn.addEventListener('click', () => abrirModal('campanha', todasCampanhas.find((c) => c.id === btn.dataset.editarCampanha))));
    tbody.querySelectorAll('[data-apagar-campanha]').forEach((btn) => btn.addEventListener('click', () => apagarRegistro('campanhas', btn.dataset.apagarCampanha, recarregarCampanhas)));
  }

  document.querySelectorAll('#tabela-campanhas th.ordenavel').forEach((th) => {
    th.classList.remove('ordenado-asc', 'ordenado-desc');
    if (th.dataset.campo === ordemCampanhasCampo) th.classList.add(ordemCampanhasAsc ? 'ordenado-asc' : 'ordenado-desc');
  });
}

async function alternarFavoritaCampanha(id) {
  const c = todasCampanhas.find((cc) => cc.id === id);
  if (!c) return;
  try {
    const { error } = await sb.from('campanhas').update({ favorita: !c.favorita }).eq('id', id);
    if (error) throw error;
    c.favorita = !c.favorita;
    renderizarCampanhas();
  } catch (erro) {
    alert('Não foi possível atualizar. Tente novamente.');
    console.error(erro);
  }
}

function configurarCampanhasUI() {
  document.querySelectorAll('#tabela-campanhas th.ordenavel').forEach((th) => {
    th.addEventListener('click', () => {
      const campo = th.dataset.campo;
      if (ordemCampanhasCampo === campo) ordemCampanhasAsc = !ordemCampanhasAsc;
      else { ordemCampanhasCampo = campo; ordemCampanhasAsc = true; }
      renderizarCampanhas();
    });
  });
  document.getElementById('busca-campanhas').addEventListener('input', (e) => { buscaCampanhasAtual = e.target.value; renderizarCampanhas(); });
  document.querySelectorAll('#filtro-campanhas button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filtro-campanhas button').forEach((b) => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      filtroCampanhasAtual = btn.dataset.filtro;
      renderizarCampanhas();
    });
  });
  document.getElementById('botao-nova-campanha').addEventListener('click', () => abrirModal('campanha'));
  document.getElementById('botao-csv-campanhas').addEventListener('click', () => {
    const linhas = ordenarCampanhas(campanhasFiltradas()).map((c) => [c.campanha, c.cliente, c.tipo, c.status, c.qtd, c.valor, formatarDataCompleta(c.prazo), c.pagamento === 'pago' ? 'Pago' : 'Pendente']);
    baixarCsv('campanhas.csv', ['Campanha', 'Cliente', 'Tipo', 'Status', 'Qtd', 'Valor', 'Prazo', 'Pagamento'], linhas);
  });
}

/* ========================================================================
   ABA CHECKLIST (5 sub-abas, dados vêm de window.Biblioteca)
   ======================================================================== */
async function recarregarMarcados() {
  try {
    const linhas = await buscarTudo('marcados');
    marcadosSet = new Set(linhas.filter((l) => l.marcado).map((l) => l.chave));
    document.getElementById('aviso-erro-checklist').classList.add('oculto');
  } catch (erro) {
    console.error('Erro ao carregar checklist marcado:', erro);
    const aviso = document.getElementById('aviso-erro-checklist');
    aviso.textContent = 'Não foi possível carregar o que você já marcou no checklist. Confira se o banco.sql já foi executado no Supabase.';
    aviso.classList.remove('oculto');
  }
}

async function alternarMarcado(chave, marcado) {
  try {
    if (marcado) {
      const { error } = await sb.from('marcados').upsert({ chave, marcado: true });
      if (error) throw error;
      marcadosSet.add(chave);
    } else {
      const { error } = await sb.from('marcados').delete().eq('chave', chave);
      if (error) throw error;
      marcadosSet.delete(chave);
    }
  } catch (erro) {
    alert('Não foi possível salvar. Tente novamente.');
    console.error(erro);
  }
}

function renderizarChecklistPortfolio() {
  const biblioteca = window.Biblioteca;
  const container = document.getElementById('lista-secoes-checklist');
  if (!biblioteca || !biblioteca.CHECKLIST) { container.innerHTML = '<p class="estado-vazio">Não foi possível carregar o checklist. Confira se o js/biblioteca.js está no lugar certo.</p>'; return; }

  let totalItens = 0, totalMarcados = 0;

  container.innerHTML = biblioteca.CHECKLIST.map((secao) => {
    const itens = secao.itens || [];
    const marcadosSecao = itens.filter((_, i) => marcadosSet.has(`checklist:${secao.id}:${i}`)).length;
    totalItens += itens.length;
    totalMarcados += marcadosSecao;
    const pct = itens.length ? Math.round((marcadosSecao / itens.length) * 100) : 0;

    return `
      <div class="secao-checklist" data-secao="${secao.id}">
        <div class="secao-checklist-cabecalho">
          <span class="emoji">${secao.emoji || ''}</span>
          <div class="info">
            <h4>${escaparHtml(secao.nome)}</h4>
            <div class="resumo">${escaparHtml(secao.resumo || '')}</div>
          </div>
          <div class="progresso-mini">
            <div class="barra-progresso-fundo"><div class="barra-progresso-preenchimento" style="width:${pct}%"></div></div>
            <div class="progresso-texto">${marcadosSecao}/${itens.length}</div>
          </div>
        </div>
        <div class="secao-checklist-corpo">
          ${secao.porque ? `<div class="porque">${escaparHtml(secao.porque)}</div>` : ''}
          ${itens.map((item, i) => {
            const chave = `checklist:${secao.id}:${i}`;
            const marcado = marcadosSet.has(chave);
            return `
              <div class="item-checklist-portfolio">
                <input type="checkbox" data-chave-checklist="${chave}" ${marcado ? 'checked' : ''} />
                <div>
                  <div class="texto-item ${marcado ? 'marcado' : ''}">${escaparHtml(item.t)}</div>
                  ${item.d ? `<div class="desc-item">${escaparHtml(item.d)}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  const pctGeral = totalItens ? Math.round((totalMarcados / totalItens) * 100) : 0;
  document.getElementById('progresso-geral-texto').textContent = `${pctGeral}%`;
  document.getElementById('progresso-geral-barra').style.width = `${pctGeral}%`;

  container.querySelectorAll('.secao-checklist-cabecalho').forEach((cab) => {
    cab.addEventListener('click', () => cab.closest('.secao-checklist').classList.toggle('aberta'));
  });
  container.querySelectorAll('[data-chave-checklist]').forEach((chk) => {
    chk.addEventListener('click', (e) => e.stopPropagation());
    chk.addEventListener('change', async () => { await alternarMarcado(chk.dataset.chaveChecklist, chk.checked); renderizarChecklistPortfolio(); });
  });
}

function renderizarReferencias() {
  const biblioteca = window.Biblioteca;
  const container = document.getElementById('grade-referencias');
  if (!biblioteca || !biblioteca.REFERENCIAS) { container.innerHTML = '<p class="estado-vazio">Não foi possível carregar as referências.</p>'; return; }
  container.innerHTML = biblioteca.REFERENCIAS.map((ref) => `
    <div class="cartao-referencia" data-ref="${ref.id}">
      <div class="capa-ref cor-${ref.cor || 'azul'}">${ref.emoji || ''}</div>
      <div class="info-ref">
        <h4>${escaparHtml(ref.titulo)}</h4>
        <div class="meta-ref">${escaparHtml(ref.estilo || '')} · ${escaparHtml(ref.duracao || '')}${ref.marca ? ' · ' + escaparHtml(ref.marca) : ''}</div>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('[data-ref]').forEach((el) => {
    el.addEventListener('click', () => abrirModalReferencia(biblioteca.REFERENCIAS.find((r) => r.id === el.dataset.ref)));
  });
}

function abrirModalReferencia(ref) {
  if (!ref) return;
  document.getElementById('modal-referencia-titulo').textContent = ref.titulo;
  document.getElementById('modal-referencia-corpo').innerHTML = `
    <h4>Gancho</h4><p>${escaparHtml(ref.gancho || '')}</p>
    <h4>Por que funciona</h4><p>${escaparHtml(ref.porque || '')}</p>
    <h4>Diferencial</h4><p>${escaparHtml(ref.diferencial || '')}</p>
    <h4>Erro comum</h4><p>${escaparHtml(ref.erro || '')}</p>
    <h4>Roteiro</h4>
    ${(ref.roteiro || []).map((b) => `<div class="bloco-roteiro-tempo"><span class="tempo">${escaparHtml(b.t)}</span><span>${b.o}</span></div>`).join('')}
  `;
  document.getElementById('modal-referencia-assistir').href = ref.youtube || '#';
  document.getElementById('modal-referencia-overlay').classList.remove('oculto');
}
function configurarModalReferencia() {
  const fechar = () => document.getElementById('modal-referencia-overlay').classList.add('oculto');
  document.getElementById('modal-referencia-fechar').addEventListener('click', fechar);
  document.getElementById('modal-referencia-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-referencia-overlay') fechar(); });
}

function renderizarTiposRoteiro() {
  const biblioteca = window.Biblioteca;
  const container = document.getElementById('lista-tipos-roteiro');
  if (!biblioteca || !biblioteca.TIPOS) { container.innerHTML = '<p class="estado-vazio">Não foi possível carregar os roteiros.</p>'; return; }
  container.innerHTML = biblioteca.TIPOS.map((tipo) => `
    <div class="cartao-tipo-roteiro" data-tipo-roteiro="${tipo.id}">
      <div class="cabecalho-tr">
        <span class="emoji">${tipo.emoji || ''}</span>
        <div style="flex:1;"><strong>${escaparHtml(tipo.nome)}</strong><div style="font-size:11px; color:var(--texto-suave);">${escaparHtml(tipo.duracao || '')}</div></div>
      </div>
      <div class="corpo-tr">
        ${tipo.porque ? `<div class="porque">${escaparHtml(tipo.porque)}</div>` : ''}
        ${(tipo.beats || []).map((b) => `<div class="bloco-roteiro-tempo"><span class="tempo">${escaparHtml(b.t)}</span><span>${b.o}</span></div>`).join('')}
        ${tipo.erros && tipo.erros.length ? `<h4 style="font-size:11px; color:var(--texto-suave); text-transform:uppercase; margin:12px 0 6px;">Erros comuns</h4><ul style="margin:0; padding-left:18px; font-size:13px;">${tipo.erros.map((e) => `<li>${escaparHtml(e)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.cabecalho-tr').forEach((cab) => cab.addEventListener('click', () => cab.closest('.cartao-tipo-roteiro').classList.toggle('aberta')));
}

function renderizarNichos() {
  const biblioteca = window.Biblioteca;
  const container = document.getElementById('lista-nichos');
  if (!biblioteca || !biblioteca.NICHOS) { container.innerHTML = '<p class="estado-vazio">Não foi possível carregar as ideias por nicho.</p>'; return; }
  container.innerHTML = biblioteca.NICHOS.map((nicho) => `
    <div class="cartao-nicho" data-nicho="${nicho.id}">
      <div class="cabecalho-nicho">
        <span class="emoji">${nicho.emoji || ''}</span>
        <strong style="flex:1;">${escaparHtml(nicho.nome)}</strong>
      </div>
      <div class="corpo-nicho">
        ${(nicho.ideias || []).map((ideia) => `
          <div class="ideia-nicho">
            <div>${escaparHtml(ideia.t)}</div>
            ${ideia.gancho ? `<div class="gancho-ideia">${escaparHtml(ideia.gancho)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.cabecalho-nicho').forEach((cab) => cab.addEventListener('click', () => cab.closest('.cartao-nicho').classList.toggle('aberta')));
}

function renderizarRevisao() {
  const biblioteca = window.Biblioteca;
  const container = document.getElementById('lista-revisao');
  if (!biblioteca || !biblioteca.REVISAO) { container.innerHTML = '<p class="estado-vazio">Não foi possível carregar os blocos de revisão.</p>'; return; }
  container.innerHTML = biblioteca.REVISAO.map((bloco, bi) => `
    <div style="margin-top:16px;">
      <h4 style="font-size:13px; margin-bottom:8px;">${bloco.emoji || ''} ${escaparHtml(bloco.bloco)}</h4>
      ${(bloco.itens || []).map((item, ii) => `
        <div class="item-checklist-portfolio">
          <input type="checkbox" id="revisao-${bi}-${ii}" />
          <div>
            <label for="revisao-${bi}-${ii}" class="texto-item" style="cursor:pointer;">${escaparHtml(item.t)}</label>
            ${item.d ? `<div class="desc-item">${escaparHtml(item.d)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>
  `).join('');
}

function renderizarChecklistTudo() {
  renderizarChecklistPortfolio();
  renderizarReferencias();
  renderizarTiposRoteiro();
  renderizarNichos();
  renderizarRevisao();
}

function configurarChecklistUI() {
  document.querySelectorAll('.sub-aba-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-aba-btn').forEach((b) => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      document.querySelectorAll('.sub-aba-painel').forEach((p) => p.classList.remove('ativo'));
      document.getElementById(`subaba-${btn.dataset.subaba}`).classList.add('ativo');
    });
  });
}

/* ========================================================================
   NAVEGAÇÃO: abas principais e menu mobile.
   ======================================================================== */
function configurarAbas() {
  const titulos = { portfolio: 'Portfólio', marcas: 'Marcas', mensagens: 'Mensagens', calendario: 'Calendário', campanhas: 'Campanhas', checklist: 'Checklist' };
  document.querySelectorAll('.nav-item').forEach((botao) => {
    botao.addEventListener('click', () => {
      const aba = botao.dataset.tab;
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('ativo'));
      botao.classList.add('ativo');
      document.querySelectorAll('.painel-aba').forEach((p) => p.classList.remove('ativo'));
      document.getElementById(`aba-${aba}`).classList.add('ativo');
      document.getElementById('titulo-pagina').textContent = titulos[aba];
      fecharMenuMobile();
    });
  });
}
function configurarMenuMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay-mobile');
  document.getElementById('botao-menu-mobile').addEventListener('click', () => { sidebar.classList.add('aberta'); overlay.classList.add('ativo'); });
  overlay.addEventListener('click', fecharMenuMobile);
}
function fecharMenuMobile() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlay-mobile').classList.remove('ativo');
}

/* ========================================================================
   INICIALIZAÇÃO: guarda de autenticação, depois monta a tela.
   ======================================================================== */
(async function iniciar() {
  const usuario = await window.Banco.checkAuth();
  if (!usuario) return; // checkAuth já redireciona para /login/

  document.getElementById('email-usuario').textContent = usuario.email;
  document.body.classList.add('pronto');
  document.getElementById('botao-sair').addEventListener('click', () => window.Banco.logout());

  configurarAbas();
  configurarMenuMobile();
  configurarModal();
  configurarModalDia();
  configurarModalReferencia();
  configurarPortfolioUI();
  configurarMarcasUI();
  configurarCalendarioUI();
  configurarCampanhasUI();
  configurarChecklistUI();

  // O checklist não depende do banco pra existir, só pro que já foi marcado.
  await recarregarMarcados();
  renderizarChecklistTudo();

  // Cada bloco carrega e trata erro por conta própria: se uma tabela faltar,
  // o resto do admin continua funcionando normalmente.
  await recarregarPortfolio();
  await recarregarMarcas();
  await recarregarCalendario();
  await recarregarCampanhas(); // também redesenha o calendário com os prazos
})();
