// ===============================
// 🔗 CONFIGURAÇÃO GLOBAL APPS SCRIPT
// ===============================
const SCRIPT_SITE = "https://script.google.com/macros/s/AKfycbzzuRJPa7G-m3BwjGKPqLhQbe5AB7nVGNymImiGL-RdQVUkLZ9dJZBwimgJHzeL39X1Yg/exec";

const DURACAO_SESSAO = 30 * 24 * 60 * 60 * 1000; // 30 dias

const opcoesExtra = [
  "Adrenalina Pura", "Apple TV+", "Canais Globo", "Cindie", "Combate",
  "Crunchyroll", "Disney+", "ESPN", "GloboPlay", "HBO Max", "Look", "MGM+",
  "MUBI", "NBA", "Netflix", "Nosso Futebol+", "Paramount+", "Premiere", "Reserva Imovision",  "Sony One", "Spotify", "Telecine", "UFC Fight Pass", "Universal+", "YouTube"
];

// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let anunciantePesquisaValido = null;
let carregandoAnuncios = false;
let tentativasLogin = 0;
let bloqueioLogin = false;
let indiceAtualDetalhes = -1;
let startX = 0;
let endX = 0;

const likesEmAndamento = new Set();

async function registrarLike(idMensagem) {
  if (likesEmAndamento.has(idMensagem)) return;
  likesEmAndamento.add(idMensagem);
  try {
    // 🔎 Garantir sessão válida
    let sessao = obterSessao();
    if (!sessao) {
      const ok = await renovarTokenAutomatico();
      if (!ok) {
        alert("Faça login primeiro.");
        return;
      }
    }
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Faça login primeiro.");
      return;
    }
    const url = `${SCRIPT_SITE}?funcao=executarAcao`
      + `&acao=like`
      + `&id=${encodeURIComponent(idMensagem)}`
      + `&token=${encodeURIComponent(token)}`;
    const msg = await fetchAutenticado(url);
    if (msg) alert(msg);
  } catch {
    alert("Erro ao registrar like.");
  } finally {
    likesEmAndamento.delete(idMensagem);
  }
}

const comprasEmAndamento = new Set();

async function registrarCompra(idMensagem) {
  if (comprasEmAndamento.has(idMensagem)) return;
  comprasEmAndamento.add(idMensagem);
  try {
    let sessao = obterSessao();
    if (!sessao) {
      const ok = await renovarTokenAutomatico();
      if (!ok) return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    const url = `${SCRIPT_SITE}?funcao=executarAcao`
      + `&acao=compra`
      + `&id=${encodeURIComponent(idMensagem)}`
      + `&token=${encodeURIComponent(token)}`;
    await fetchAutenticado(url);
  } catch (err) {
    console.warn("Erro ao registrar compra", err);
  } finally {
    comprasEmAndamento.delete(idMensagem);
  }
}

let exclusaoEmAndamento = false;

async function excluirAnuncio(idMensagem) {
  if (exclusaoEmAndamento) return;
  if (!confirm("Tem certeza que deseja excluir este anúncio?")) return;
  exclusaoEmAndamento = true;
  try {
    let sessao = obterSessao();
    if (!sessao) {
      const ok = await renovarTokenAutomatico();
      if (!ok) {
        alert("Faça login primeiro.");
        return;
      }
    }
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Faça login primeiro.");
      return;
    }
    const url = `${SCRIPT_SITE}?funcao=executarAcao`
      + `&acao=excluir`
      + `&id=${encodeURIComponent(idMensagem)}`
      + `&token=${encodeURIComponent(token)}`;
    const msg = await fetchAutenticado(url);
    if (msg) {
      alert(msg);
      voltarParaLista(true);
    }
  } catch {
    alert("Erro ao excluir anúncio.");
  } finally {
    exclusaoEmAndamento = false;
  }
}

let envioEmAndamento = false;

async function enviarFormulario(event) {
  event.preventDefault();
  if (envioEmAndamento) return;
  envioEmAndamento = true;
  const form = document.getElementById("formAnuncio");
  const btnEnviar = form.querySelector('button[type="submit"]');
  const btnCancelar = form.querySelector('button[type="button"]');
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando...";
  btnCancelar.disabled = true;
  try {
    // 🔎 Garantir sessão válida
    let sessao = obterSessao();
    if (!sessao) {
      const ok = await renovarTokenAutomatico();
      if (!ok) {
        alert("Sessão inválida. Faça login novamente.");
        return;
      }
    }
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Sessão inválida. Faça login novamente.");
      return;
    }
    // 📝 Coletar dados do formulário
    const dados = Object.fromEntries(new FormData(form).entries());
    Object.keys(dados).forEach(chave => {
      if (dados[chave].trim() === "") delete dados[chave];
    });
    const selecionados = Array.from(
      document.querySelectorAll('input[name="extra"]:checked')
    ).map(i => i.value);
    dados.extra = selecionados.join(", ");
    // 📦 Montar parâmetros (como antes)
    const params = new URLSearchParams({
      funcao: "salvarFormulario",
      token,
      ...dados
    }).toString();
    // 🚀 Enviar usando sua função autenticada
    const msg = await fetchAutenticado(`${SCRIPT_SITE}?${params}`);
    if (msg) {
      alert(msg);
      form.reset();
      voltarParaLista(true);
    }
  } catch (erro) {
    console.error("Erro ao enviar formulário:", erro);
    alert("Erro ao enviar o formulário.");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar";
    btnCancelar.disabled = false;
    envioEmAndamento = false;
  }
}

async function carregarAnuncios() {
  if (carregandoAnuncios) return;
  carregandoAnuncios = true;
  const container = document.getElementById("anuncios");
  container.innerHTML =
    '<div class="loading">Carregando Anúncios...</div>';
  try {
    const resposta =
      await fetch(`${SCRIPT_SITE}?funcao=listarAnuncios`);
    if (!resposta.ok)
      throw new Error('Resposta HTTP ' + resposta.status);
    const anuncios = await resposta.json();
    if (!Array.isArray(anuncios) || anuncios.length === 0) {
      container.innerHTML =
        '<div class="erro">Nenhum anúncio encontrado.</div>';
      return;
    }
    // 🔥 Salva globalmente
    window.anunciosCarregados = anuncios;
    // 🔥 GARANTE QUE A LISTA ESTÁ VISÍVEL
    modoLista();
    esconderTodasTelas();
    container.style.display = "flex";
    renderizarAnuncios(anuncios);
    const params =
      new URLSearchParams(window.location.search);
    // 🔗 1) ABRIR DIRETO POR ID
    const idDireto = params.get("a") || params.get("id");
    if (idDireto) {
      const item = anuncios.find(a =>
        a.postagem == idDireto
      );
      if (item) {
        mostrarDetalhes(item);
        return;
      }
    }
    // 🔍 2) PESQUISA VIA LINK
    const termoPesquisa =
      params.get("p") || params.get("pesquisar");
    if (termoPesquisa) {
      const barraPesquisa =
        document.getElementById("pesquisa");
      if (barraPesquisa) {
        barraPesquisa.value = termoPesquisa;
        filtrarAnuncios();
      }
    }
  } catch (erro) {
    container.innerHTML =
      '<div class="erro">Erro ao carregar anúncios.</div>';
    console.error("Erro ao carregar anúncios:", erro);
  } finally {
    carregandoAnuncios = false;
  }
}

function limitarKotas(input) {
  if (input.value.length > 6) {
	input.value = input.value.slice(0, 6);
  }
}

function formatarUsuario(input) {
  let valor = input.value.trim();
  if (valor && !valor.startsWith('@')) {
    valor = '@' + valor.replace(/^@+/, '');
  }
  input.value = valor;
}

async function verificarSessaoAoEntrar() {
  const token = localStorage.getItem("token");
  const nome  = localStorage.getItem("usuarioNome");
  // 🔐 Não logado
  if (!token || !nome) return false;
  // 🟢 Tenta validar silenciosamente
  const ok = await renovarTokenAutomatico();
  if (!ok) {
    limparSessao();
    return false;
  }
  return true;
}

function salvarSessao(nome, id, token) {
  const agora = Date.now();
  localStorage.setItem("usuarioNome", nome);
  localStorage.setItem("usuarioId", id);
  localStorage.setItem("token", token);
  localStorage.setItem("sessaoExpira", agora + DURACAO_SESSAO);
  atualizarMenuUsuario();
}

function obterSessao() {
  const nome = localStorage.getItem("usuarioNome");
  const id = localStorage.getItem("usuarioId");
  const expira = localStorage.getItem("sessaoExpira");
  if (!nome || !id || !expira) return null;
  if (Date.now() > Number(expira)) {
    limparSessao();
    return null;
  }
  return { nome, id };
}

function limparSessao() {
  localStorage.removeItem("usuarioNome");
  localStorage.removeItem("usuarioId");
  localStorage.removeItem("sessaoExpira");
  localStorage.removeItem("token");
  atualizarMenuUsuario();
}

async function sair() {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await fetch(        `${SCRIPT_SITE}?funcao=logout&token=${encodeURIComponent(token)}`
      );
    } catch (e) {}
  }
  limparSessao();
  alert("Sessão encerrada.");
  location.reload();
}

async function renovarTokenAutomatico() {
  // 🟢 Telegram WebApp
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const id   = user.id;
    const nome = user.username ? "@" + user.username : user.first_name;
    const res = await fetch(
      `${SCRIPT_SITE}?funcao=loginTelegram`
      + `&id=${encodeURIComponent(id)}`
      + `&usuario=${encodeURIComponent(nome)}`
    );
    const dados = await res.json();
    if (dados.status === "ok") {
      salvarSessao(dados.nome, dados.id, dados.token);
      return true;
    }
    else if (dados.status === "bloqueado") {
      alert("⛔ Seu acesso está bloqueado.");
    }
    else if (dados.status === "nome_diferente") {
      alert("⚠️ Seu nome do Telegram mudou.\nRefaça o cadastro.");
    }
    else if (dados.status === "nao_cadastrado") {
      alert("🚫 Você não está cadastrado.");
    }
    return false;
  }
  // 🔵 Login manual salvo
  const nome = localStorage.getItem("usuarioNome");
  if (!nome) return false;
  const res = await fetch(
    `${SCRIPT_SITE}?funcao=loginManualPersistente`
    + `&usuario=${encodeURIComponent(nome)}`
  );
  const dados = await res.json();
  if (dados.status === "ok") {
    salvarSessao(dados.nome, dados.id, dados.token);
    return true;
  }
  return false;
}

async function fetchAutenticado(url, jaTentou = false) {
  let res = await fetch(url);
  let texto = await res.text();
  if (texto.includes("Sessão inválida") && !jaTentou) {
    const ok = await renovarTokenAutomatico();
    if (!ok) {
      alert("Sua sessão expirou. Faça login novamente.");
      mostrarTelaLogin();
      return null;
    }
    const novoToken = localStorage.getItem("token");
    const urlAtualizada = url.replace(
      /([?&])token=[^&]*/,
      `$1token=${encodeURIComponent(novoToken)}`
    );
    return fetchAutenticado(urlAtualizada, true);
  }
  return texto;
}

// Decide se mostra o botão Sair dentro do menu
function atualizarMenuUsuario() {
  const nome = localStorage.getItem("usuarioNome");
  const expira = localStorage.getItem("sessaoExpira");
  const sessaoValida =
    nome &&
    expira &&
    Date.now() <= Number(expira);
  const btnSair = document.getElementById("menuSair");
  if (btnSair) {
    btnSair.style.display = sessaoValida ? "flex" : "none";
  }
}

async function verificarAutenticacao() {
  const sessao = obterSessao();
  if (sessao) return sessao;
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const nome = user.username ? "@" + user.username : user.first_name;
    const res = await fetch(
`${SCRIPT_SITE}?funcao=loginTelegram&usuario=${encodeURIComponent(nome)}`
    );
    const dados = await res.json();
    if (dados.status === "ok") {
      salvarSessao(dados.nome, dados.id, dados.token);
      return { nome: dados.nome, id: dados.id };
    }
    if (dados.status === "bloqueado") {
      return null;
    }
  }
  return null;
}

async function fazerLogin() {
  if (bloqueioLogin) return;
  const usuario = document.getElementById("loginUsuario").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();
  const erro = document.getElementById("loginErro");
  const btn = document.getElementById("btnEntrar");
  // 🔒 DESABILITA BOTÃO
  btn.disabled = true;
  btn.innerText = "Entrando...";
  if (!usuario || senha.length !== 4) {
    erro.innerText = "Preencha corretamente.";
    erro.style.display = "block";
    // 🔓 REABILITA SE DER ERRO
    btn.disabled = false;
    btn.innerText = "ENTRAR";
    return;
  }
  const res = await fetch(
`${SCRIPT_SITE}?funcao=loginManual&usuario=${encodeURIComponent(usuario)}&senha=${senha}`
  );
  const dados = await res.json();
if (dados.status === "ok") {
salvarSessao(dados.nome, dados.id, dados.token);
mostrarFormulario();
return;
}
  if (dados.status === "bloqueado") {
    erro.innerText = "⚠️ Usuário bloqueado.";
    erro.style.display = "block";
    btn.disabled = false;
    btn.innerText = "ENTRAR";
    return;
  }
  // ❌ Senha errada
  tentativasLogin++;
  erro.innerText = `Senha incorreta (${tentativasLogin}/4)`;
  erro.style.display = "block";
  if (tentativasLogin >= 4) {
    ativarBloqueioLogin();
  }
  // 🔓 REABILITA
  btn.disabled = false;
  btn.innerText = "ENTRAR";
}

function ativarBloqueioLogin() {
  bloqueioLogin = true;
  const erro = document.getElementById("loginErro");
  const btn = document.getElementById("btnEntrar");
  const inputUser = document.getElementById("loginUsuario");
  const inputSenha = document.getElementById("loginSenha");
  btn.style.display = "none";
  inputUser.disabled = true;
  inputSenha.disabled = true;
  let tempo = 60;
  erro.style.display = "block";
  erro.innerHTML = `🔒 BLOQUEADO TEMPORARIAMENTE (${tempo}s)`;
  const intervalo = setInterval(() => {
    tempo--;
    erro.innerHTML = `🔒 BLOQUEADO TEMPORARIAMENTE (${tempo}s)`;
    if (tempo <= 0) {
      clearInterval(intervalo);
      bloqueioLogin = false;
      tentativasLogin = 0;
      btn.style.display = "block";
      inputUser.disabled = false;
      inputSenha.disabled = false;
      erro.innerText = "Você pode tentar novamente.";
      setTimeout(() => {
      erro.style.display = "none";
      }, 3000);
      erro.style.display = "block";
    }
  }, 1000);
}

function mostrarTelaLogin() {
  modoLogin();
  esconderTodasTelas();
  const login = document.getElementById("loginBox");
  if (login) login.style.display = "block";
  renderizarBottomBar("login");
}

async function mostrarFormulario() {
  // 🔎 1️⃣ Verificar sessão válida
  let sessao = obterSessao();
  // 🔄 2️⃣ Se não tiver sessão, tentar login automático via Telegram
  if (!sessao && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const nome = user.username ? "@" + user.username : user.first_name;
    // 🔐 Verificar bloqueio no servidor
    const res = await fetch(
`${SCRIPT_SITE}?funcao=loginTelegram&usuario=${encodeURIComponent(nome)}`
    );
    const dados = await res.json();
    if (dados.status === "ok") {
      salvarSessao(dados.nome, dados.id, dados.token);
      atualizarMenuUsuario();
      sessao = { nome: dados.nome, id: dados.id };
    }
    if (dados.status === "bloqueado") {
      alert("⚠️ Seu acesso está bloqueado.");
      return;
    }
  }
  // 🚫 3️⃣ Se ainda não autenticado → mostrar login
  if (!sessao) {
    mostrarTelaLogin();
    return;
  }
  // ✅ 4️⃣ Usuário autenticado → mostrar formulário
  modoFormulario();
  esconderTodasTelas();
  document.getElementById("formulario").style.display = "block";
  const campoUsuario = document.getElementById("usuario");
  if (campoUsuario) {
    campoUsuario.value = sessao.nome;
    campoUsuario.setAttribute("readonly", true);
    // 🔥 Buscar WhatsApp automaticamente
fetch(`${SCRIPT_SITE}?funcao=buscarWhatsapp&nome=${encodeURIComponent(sessao.nome)}`)
      .then(res => res.text())
      .then(telefone => {
        const inputWhatsapp = document.getElementById("whatsappInput");
        if (telefone && inputWhatsapp && !inputWhatsapp.value) {
          inputWhatsapp.value = telefone;
        }
      })
      .catch(err => console.error("Erro ao buscar WhatsApp:", err));
  }
  // 🔹 Carregar opções de streaming
  fetch(`${SCRIPT_SITE}?funcao=listarOpcoesStreaming`)
    .then(res => res.json())
    .then(opcoes => {
      const select = document.getElementById("selectStreaming");
      if (!select) return;
      select.innerHTML = "";
      opcoes.forEach(op => {
        const opt = document.createElement("option");
        opt.text = op;
        opt.value = op;
        select.add(opt);
      });
    })
    .catch(err => console.error("Erro ao carregar opções:", err));
  // 🔹 Resetar extras
  const container = document.getElementById("containerExtras");
  if (container) {
    container.className = "checkbox-list hidden";
    container.innerHTML = "";
    if (typeof opcoesExtra !== "undefined") {
      opcoesExtra.forEach(opcao => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = "extra";
        input.value = opcao;
        label.appendChild(input);
        label.appendChild(document.createTextNode(opcao));
        container.appendChild(label);
      });
    }
  }
  renderizarBottomBar("formulario");
}

function formatarWhatsapp(input) {
  // Remove tudo que não for número
  let valor = input.value.replace(/\D/g, '');
  // Se só tiver 11 dígitos, assume que é número brasileiro e adiciona "55"
  if (valor.length === 11 && !valor.startsWith('55')) {
	valor = '55' + valor;
  }
  // Limita a 13 dígitos (55 + 11 números)
  if (valor.length > 13) {
	valor = valor.slice(0, 13);
  }
  input.value = valor;
}

function renderizarAnuncios(lista) {
  const container = document.getElementById("anuncios");
  container.innerHTML = "";
  lista.forEach((item) => {
    const div = document.createElement("div");
    div.className = "anuncio";
    // 🔹 Salva o objeto completo no elemento
    div._itemCompleto = item;
    div.dataset.streaming = item.streaming || "";
    div.dataset.streamingExtra = item.streamingExtra || "";
    div.dataset.valor = item.valor || "";
    div.dataset.anunciante = item.anunciante || "";
    div.dataset.whatsapp = item.whatsapp || "";
    div.innerHTML = `
      <img class="logo" src="${item.logo}" alt="Logo">
      <div class="info">
        <div class="titulo">${item.streaming}</div>
        <div class="valor">${item.valor}</div>
        <div class="anunciante" style="display:none;">${item.anunciante}</div>
      </div>
    `;
    div.onclick = () => mostrarDetalhes(item);
    container.appendChild(div);
  });
}

	function toggleMenu() {
  	const painel = document.getElementById("painel-menu");
  	const overlay = document.getElementById("menu-overlay");
  	const ativo = painel.classList.contains("ativo");
  	painel.classList.toggle("ativo", !ativo);
  	overlay.style.display = ativo ? "none" : "block";
	}

function toggleExtras() {
  const extras = document.getElementById("containerExtras");
  extras.classList.toggle("hidden");
  const btn = document.querySelector(".toggle-extras");
  btn.textContent = extras.classList.contains("hidden")
    ? "Mostrar extras ▼"
    : "Fechar extras ▲";
}

function getUserId() {
  // 🟢 Se estiver dentro do Telegram WebApp
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return Telegram.WebApp.initDataUnsafe.user.id.toString();
  }
  // 🔵 Fallback navegador normal
  let userId = localStorage.getItem("siteUserId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("siteUserId", userId);
  }
  return userId;
}


function modoLista() {
  document.getElementById("btnVoltar").style.display = "none";
  document.getElementById("searchContainer").style.display = "flex";
  document.getElementById("topTitle").style.display = "none";
}

function modoDetalhes() {
  document.getElementById("btnVoltar").style.display = "block";
  document.getElementById("searchContainer").style.display = "none";
  const titulo = document.getElementById("topTitle");
  titulo.style.display = "block";
  titulo.innerText = "DETALHES";
}

function modoFormulario() {
  document.getElementById("btnVoltar").style.display = "block";
  document.getElementById("searchContainer").style.display = "none";
  const titulo = document.getElementById("topTitle");
  titulo.style.display = "block";
  titulo.innerText = "ANUNCIAR";
}

function modoLogin() {
document.getElementById("btnVoltar").style.display = "block";
document.getElementById("searchContainer").style.display = "none";
  const titulo = document.getElementById("topTitle");
  titulo.style.display = "block";
  titulo.innerText = "LOGIN";
}

function mostrarDetalhes(item) {

  const anunciosVisiveis = Array.from(document.querySelectorAll(".anuncio"))
    .filter(el => el.style.display !== "none");

  indiceAtualDetalhes = anunciosVisiveis.findIndex(el =>
    el._itemCompleto.postagem === item.postagem
  );

  window.listaVisivelDetalhes = anunciosVisiveis;

  modoDetalhes();
  esconderTodasTelas();
  document.getElementById("detalhes").style.display = "block";

  window.itemAtual = item;
  window.podeExcluir = false;

  const sessao = obterSessao();
  if (sessao && sessao.nome === item.anunciante) {
    window.podeExcluir = true;
  }
  // =========================
  // BOTÕES DE CONTATO (IMAGENS)
  // =========================
  let botoesContato = "";
  if (item.anunciante) {
    const usuarioLimpo = item.anunciante.replace("@", "");
    botoesContato += `
      <a href="https://t.me/${usuarioLimpo}"
         target="_blank"
         onclick="registrarCompra('${item.postagem}')">
        <img src="https://drive.google.com/thumbnail?id=1qXoQt7RBq3gXbeEelRQbawl5Ni2oUxdl&sz=w1000">
      </a>
    `;
  }
  if (item.whatsapp) {
    botoesContato += `
      <a href="https://wa.me/${item.whatsapp}"
         target="_blank"
         onclick="registrarCompra('${item.postagem}')">
        <img src="https://drive.google.com/thumbnail?id=1zdhXAhIUNrZfurE_7_i56Hj7TZkJhjN_&sz=w1000">
      </a>
    `;
  }
  if (item.kotas) {
    botoesContato += `
      <a href="https://app.kotas.com.br/grupo/${item.kotas}"
         target="_blank"
         onclick="registrarCompra('${item.postagem}')">
        <img src="https://drive.google.com/thumbnail?id=1aPf9zlL3M85F5kXxhbvzhq6iKpyK5lXb&sz=w1000">
      </a>
    `;
  }
  // =========================
  // HTML DETALHES
  // =========================
  document.getElementById("detalhes").innerHTML = `
    <div class="detalhes-box">
      <a href="${item.linkStreaming}" target="_blank">
        <img src="https://drive.google.com/thumbnail?id=${item.logo2}&sz=w1000">
      </a>
      <hr>
      <p><strong>🖥 ${item.streaming}</strong></p>
      ${item.streamingExtra ? `<p><strong>➕ ${item.streamingExtra}</strong></p>` : ""}
      <p><strong>💵 ${item.valor}</strong></p>
      <p><strong>📌 ${item.vagas}</strong></p>
      <p><strong>🔐 ${item.login}</strong></p>
      ${item.oferta ? `<p><strong>⏰ OFERTA - ${item.oferta}</strong></p>` : ""}
      <hr>
      <p><strong>Postado em: ${item.data}</strong></p>
      <hr>
      <p><strong>👤 ${item.anunciante}</strong></p>
      <p><strong>
  ❤️ ${item.pontos?.coracao ?? 0}
  💬 ${item.pontos?.balao ?? 0}
  📢 ${item.pontos?.megafone ?? 0}
</strong></p>
      <div class="botoes-contato">
        ${botoesContato}
      </div>
    </div>
  `;
  // 👉 Renderizar barra inferior
  renderizarBottomBar("detalhes");
ativarSwipeDetalhes();
}

function ativarSwipeDetalhes() {
  const box = document.querySelector(".detalhes-box");
  if (!box || box._swipeAtivado) return;
  box._swipeAtivado = true;
  box.addEventListener("touchstart", function(e) {
    startX = e.touches[0].clientX;
    box.style.transition = "none";
  });
  box.addEventListener("touchmove", function(e) {
    const currentX = e.touches[0].clientX;
    const deslocamento = currentX - startX;
    const largura = window.innerWidth;
    // 🔥 resistência progressiva (fica firme no final)
    const porcentagem = deslocamento / largura;
    const resistencia = deslocamento * (1 - Math.abs(porcentagem));
    box.style.transform = `translateX(${resistencia}px) scale(0.985)`;
  });
  box.addEventListener("touchend", function(e) {
    endX = e.changedTouches[0].clientX;
    // volta animação suave
    box.style.transition = "transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.2s ease";
    verificarSwipe();
  });
}

function verificarSwipe() {
  const largura = window.innerWidth;
  const diferenca = startX - endX;
  const limite = largura * 0.18; // 18% da tela
  if (Math.abs(diferenca) < limite) {
    resetarPosicao();
    return;
  }
  if (diferenca > 0) {
    irProximo();
  } else {
    irAnterior();
  }
}

function irProximo() {
  if (!window.listaVisivelDetalhes) return;
  // 🔁 LOOP INFINITO
  indiceAtualDetalhes++;
  if (indiceAtualDetalhes >= window.listaVisivelDetalhes.length) {
    indiceAtualDetalhes = 0;
  }
  animarTroca("esquerda");
}

function irAnterior() {
  if (!window.listaVisivelDetalhes) return;
  // 🔁 LOOP INFINITO
  indiceAtualDetalhes--;
  if (indiceAtualDetalhes < 0) {
    indiceAtualDetalhes = window.listaVisivelDetalhes.length - 1;
  }
  animarTroca("direita");
}

function mostrarDetalhesCompleto(el) {
  const item = {
    streaming: el.dataset.streaming,
    streamingExtra: el.dataset.streamingExtra,
    valor: el.dataset.valor,
    anunciante: el.dataset.anunciante,
    whatsapp: el.dataset.whatsapp,
    postagem: el.dataset.postagem,
    logo: el.querySelector(".logo")?.src
  };
  mostrarDetalhes(item);
}

function animarTroca(direcao) {
  const box = document.querySelector(".detalhes-box");
  if (!box) return;
  // aplica animação de saída
  box.classList.add(direcao === "esquerda" ? "slide-esquerda" : "slide-direita");
  setTimeout(() => {
    const el = window.listaVisivelDetalhes[indiceAtualDetalhes];
    mostrarDetalhes(el._itemCompleto);
    // espera renderizar novo conteúdo
    setTimeout(() => {
      const novaBox = document.querySelector(".detalhes-box");
      if (!novaBox) return;
      novaBox.style.transition = "none";
      novaBox.style.transform = direcao === "esquerda"
        ? "translateX(40px)"
        : "translateX(-40px)";
      novaBox.style.opacity = "0";
      requestAnimationFrame(() => {
        novaBox.style.transition = "transform 0.3s ease, opacity 0.3s ease";
        novaBox.style.transform = "translateX(0)";
        novaBox.style.opacity = "1";
      });
    }, 10);
  }, 250);
}

function resetarPosicao() {
  const box = document.querySelector(".detalhes-box");
  if (!box) return;
  box.style.transform = "translateX(0) scale(1)";
}

function renderizarBottomBar(tipo) {
  const bar = document.getElementById("bottomBar");
  bar.innerHTML = "";
  function criarBotao(icone, texto, acao) {
    const btn = document.createElement("button");
    btn.innerHTML = `
      <i class="${icone}"></i>
      <span>${texto}</span>
    `;
    btn.onclick = acao;
    bar.appendChild(btn);
  }
  // ===============================
  // 🏠 LISTA (HOME)
  // ===============================
  if (tipo === "lista") {
  const sessao = obterSessao();
  // 🏠 Home
  criarBotao("bi bi-house", "Home", () => {
    document.getElementById("pesquisa").value = "";
    filtrarAnuncios();
    renderizarBottomBar("lista");
  });
  // 🔐 Se NÃO estiver logado → botão LOGIN
  if (!sessao) {
    criarBotao("bi bi-box-arrow-in-right", "Login", mostrarTelaLogin);
  }
  // 📢 Se estiver logado → botão ANUNCIAR
  if (sessao) {
    criarBotao("bi bi-megaphone", "Anunciar", mostrarFormulario);
    // 👤 Perfil
    criarBotao("bi bi-person", "Perfil", () => {
  const barra = document.getElementById("pesquisa");
  barra.value = sessao.nome.replace(/^@/, "");
  filtrarAnuncios();
  renderizarBottomBar("lista");
});
  }
  // 📲 Compartilhar
  if (anunciantePesquisaValido) {
    criarBotao("bi bi-send", "Enviar", compartilharUsuarioWhatsapp);
  }
}
  // ===============================
  // 📄 DETALHES
  // ===============================
  if (tipo === "detalhes" && window.itemAtual) {
    const item = window.itemAtual;
    // ❤️ Like
    criarBotao("bi bi-heart", "Like", () => {
      registrarLike(item.postagem);
    });
    // 💬 Ver Postagem no Telegram
    criarBotao("bi bi-chat", "Postagem", () => {
      window.open(
        `https://t.me/dividir_contas_premium/${item.postagem}`,
        "_blank"
      );
    });
    // 📲 Compartilhar link da postagem
    criarBotao("bi bi-send", "Enviar", () => {
  const link =
    `https://tinyurl.com/divcp01?a=${item.postagem}`;

  let mensagem =
`🖥 *${item.streaming}*${item.streamingExtra ? `\n➕ ${item.streamingExtra}` : ""}
💵 ${item.valor}
📌 ${item.vagas}
🔐 ${item.login}${item.oferta ? `\n⏰ ${item.oferta}` : ""}
-------------------------------------------
👇 *VER ANÚNCIO COMPLETO*
${link}

👤 *MEUS ANÚNCIOS*
https://tinyurl.com/divcp01?p=${item.anunciante.replace(/^@/, "")}

📲 *CONTATO POR TELEGRAM*
https://t.me/${item.anunciante.replace(/^@/, "")}`;

  if (item.whatsapp) {
    mensagem += `

📲 *CONTATO POR WHATSAPP*
https://wa.me/${item.whatsapp}`;
  }

  const url =
    `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
});
    // 🗑 Excluir (somente dono)
    if (window.podeExcluir) {
      criarBotao("bi bi-trash", "Excluir", () => {
        excluirAnuncio(item.postagem);
      });
    }
  }
  // ===============================
  // 📝 FORMULÁRIO
  // ===============================
  if (tipo === "formulario") {
    criarBotao("bi bi-x", "Cancelar", voltarParaLista);
  }
// ===============================
// 🔐 LOGIN
// ===============================
if (tipo === "login") {
  criarBotao("bi bi-x", "Cancelar", voltarParaLista);
}
}

function compartilharUsuarioWhatsapp() {
  if (!anunciantePesquisaValido) return;
  const anunciante = anunciantePesquisaValido;
  const anuncios = document.querySelectorAll(
    ".anuncio:not([style*='display: none'])"
  );
  if (anuncios.length === 0) return;
  let texto = "";
  let whatsappUsuario = "";
  const usuarioSemArroba = anunciante.replace("@", "");
  anuncios.forEach((anuncio, index) => {
    if (anuncio.dataset.anunciante !== anunciante) return;
    const streaming = anuncio.dataset.streaming;
    const streamingExtra = anuncio.dataset.streamingExtra;
    const valor = anuncio.dataset.valor;
    const streamingLimpo = streaming.replace(/\+$/, "");
    texto += `🖥 *${streamingLimpo}*`;
    if (streamingExtra) {
      texto += `\n➕ ${streamingExtra}`;
    }
    texto += `\n💵 ${valor}`;
    if (index < anuncios.length - 1) {
      texto += `\n-------------------------------------------\n`;
    }
    if (!whatsappUsuario && anuncio.dataset.whatsapp) {
      whatsappUsuario = anuncio.dataset.whatsapp;
    }
  });
  texto += `\n-------------------------------------------\n`;
  texto += `👤 *MEUS ANÚNCIOS*\nhttps://tinyurl.com/divcp01?p=${usuarioSemArroba}\n\n`;
  texto += `📲 *CONTATO POR TELEGRAM*\nhttps://t.me/${usuarioSemArroba}`;
  if (whatsappUsuario) {
    texto += `\n\n📲 *CONTATO POR WHATSAPP*\nhttps://wa.me/${whatsappUsuario}`;
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

function filtrarAnuncios() {
  const termo = document.getElementById("pesquisa")
    .value.trim()
    .toLowerCase();
  const container = document.getElementById("anuncios");
  const anuncios = document.querySelectorAll(".anuncio");
  anunciantePesquisaValido = null;
  let encontrou = false;
  anuncios.forEach(el => {
    const titulo = el.querySelector(".titulo")
      .textContent.toLowerCase();
    const valor = el.querySelector(".valor")
      .textContent.toLowerCase();
    const anuncianteOriginal = el.dataset.anunciante;
    const anunciante = anuncianteOriginal
      .replace(/^@/, "")
      .toLowerCase();
    const mostrar =
      titulo.includes(termo) ||
      valor.includes(termo) ||
      anunciante.includes(termo);
    el.style.display = mostrar ? "flex" : "none";
    if (mostrar) encontrou = true;
    if (termo && anunciante === termo.replace(/^@/, "")) {
      anunciantePesquisaValido = anuncianteOriginal;
    }
  });
  // ===============================
  // 🔍 SE NÃO ENCONTROU RESULTADOS
  // ===============================
  let msg = document.getElementById("msgSemResultados");
  if (!encontrou && termo) {
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "msgSemResultados";
      msg.className = "loading";
      msg.textContent = "Nenhum Resultado Encontrado";
      container.appendChild(msg);
    }
  } else {
    if (msg) msg.remove();
  }
}

async function voltarParaLista(recarregar = false) {
  modoLista();
  esconderTodasTelas();
  document.getElementById("anuncios").style.display = "flex";
  if (recarregar) {
    await carregarAnuncios();
  }
  filtrarAnuncios();
  renderizarBottomBar("lista");
}

function esconderTodasTelas() {
  ["anuncios", "detalhes", "formulario", "loginBox"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
}

window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);
  // 🔎 Verificar sessão existente
  await verificarSessaoAoEntrar();
  let sessao = obterSessao();
  // 🔄 Se não tiver sessão → tentar login Telegram
  if (!sessao && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const nome = user.username
      ? "@" + user.username
      : user.first_name;
    // 🔥 CORREÇÃO: agora envia também o ID
    const res = await fetch(
      `${SCRIPT_SITE}?funcao=loginTelegram`
      + `&id=${encodeURIComponent(user.id)}`
      + `&usuario=${encodeURIComponent(nome)}`
    );
    const dados = await res.json();
    if (dados.status === "ok") {
      salvarSessao(dados.nome, dados.id, dados.token);
      sessao = obterSessao();
    }
    else if (dados.status === "nome_diferente") {
      alert("⚠️ Seu nome do Telegram mudou.\nRefaça o cadastro no grupo.");
    }
    else if (dados.status === "bloqueado") {
      alert("⛔ Seu acesso está bloqueado.\nFale com um administrador.");
    }
    else if (dados.status === "nao_cadastrado") {
      alert("🚫 Você não está cadastrado.\nFaça o cadastro no grupo.");
    }
    else {
      alert("⚠️ Usuário não autorizado.");
    }
  }
  // 🔄 Atualizar menu após login automático
  atualizarMenuUsuario();
  await carregarAnuncios();
  // 🔥 Abrir direto no formulário
  if (params.has("anunciar")) {
    mostrarFormulario();
  } 
  else if (!window.itemAtual) {
    renderizarBottomBar("lista");
  }

  document.getElementById("pesquisa")
    .addEventListener("input", () => {
      filtrarAnuncios();
      renderizarBottomBar("lista");
    });

  document.querySelector(".menu-icon")
    .addEventListener("click", toggleMenu);

  document.getElementById("menu-overlay")
    .addEventListener("click", toggleMenu);
});

document.addEventListener("DOMContentLoaded", function () {
  const btnVoltar = document.getElementById("btnVoltar");
  if (btnVoltar) {
    btnVoltar.addEventListener("click", () => {
      voltarParaLista();
    });
  }
});

