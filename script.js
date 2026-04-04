// ===============================
// 🔗 CONFIGURAÇÃO GLOBAL APPS SCRIPT
// ===============================
const SCRIPT_SITE = "https://script.google.com/macros/s/AKfycbzzuRJPa7G-m3BwjGKPqLhQbe5AB7nVGNymImiGL-RdQVUkLZ9dJZBwimgJHzeL39X1Yg/exec";

const DURACAO_SESSAO = 30 * 24 * 60 * 60 * 1000; // 30 dias

// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let anunciantePesquisaValido = null;
let carregandoAnuncios = false;
let parametrosJaProcessados = false;
let tentativasLogin = 0;
let bloqueioLogin = false;
let indiceAtualDetalhes = -1;
let startX = 0;
let endX = 0;

const opcoesExtra = [
  "Adrenalina Pura", "Apple TV+", "Belas Artes", "Box Brasil Play", "Canais ao Vivo", "Canais Globo", "Cindie", "Cine Brasil Já", "Combate",  "Crunchyroll", "CurtaOn", "Darkflix", "Disney+", "Eduk", "Edye", "ESPN", "F1 TV", "Gemini", "GloboPlay", "HBO Max", "Looke", "Lumine", "MGM+",  "MUBI", "NBA", "Netflix", "Nosso Futebol+", "NotebookLM", "Paramount+", "Premiere", "Prime Video", "Reaw Play", "Reserva Imovision", "Sexy Hot", "Sexy Play", "SportyNet+", "Sony One", "Spotify", "Telecine", "UFC Fight Pass", "Universal+", "VEO3", "YouTube"
];

function atualizarLikeVisual(idMensagem) {
  if (!window.itemAtual) return;
  if (window.itemAtual.postagem != idMensagem) return;
  // ===============================
  // 👍 GARANTE ESTRUTURA
  // ===============================
  if (typeof window.itemAtual.likes !== "number") {
    window.itemAtual.likes = 0;
  }
  if (!window.itemAtual.pontos) {
    window.itemAtual.pontos = {};
  }
  if (typeof window.itemAtual.pontos.coracao !== "number") {
    window.itemAtual.pontos.coracao = 0;
  }
  // ===============================
  // ❤️ ATUALIZA LIKES (ANÚNCIO)
  // ===============================
  if (likesDados[idMensagem]) {
    window.itemAtual.likes += 1;
    window.itemAtual.pontos.coracao += 1; // 💥 atualiza pontos também
  } else {
    window.itemAtual.likes = Math.max(0, window.itemAtual.likes - 1);
    window.itemAtual.pontos.coracao =
      Math.max(0, window.itemAtual.pontos.coracao - 1);
  }
  // ===============================
  // ❤️ TEXTO DO BOTÃO
  // ===============================
  const btnLike = document.getElementById("btnLikeTexto");
  if (btnLike) {
    btnLike.innerText =
      window.itemAtual.likes === 1
        ? "1 Like"
        : `${window.itemAtual.likes} Likes`;
  }
  // ===============================
  // 📊 ATUALIZA PONTOS DO ANUNCIANTE
  // ===============================
  const contador = document.getElementById("contadorPontos");
  if (contador) {
    contador.innerHTML = `
      ❤️ ${window.itemAtual.pontos.coracao ?? 0}
      💬 ${window.itemAtual.pontos?.balao ?? 0}
      📢 ${window.itemAtual.pontos?.megafone ?? 0}
    `;
  }
  // ===============================
  // 🔄 FORÇA ATUALIZAR BOTÃO (ÍCONE ❤️)
  // ===============================
  renderizarBottomBar("detalhes");
}

let likesCarregando = {};

function registrarLike(idMensagem) {
  if (likesCarregando[idMensagem]) return;
  // 🚫 BLOQUEIA SE JÁ CURTIU
  if (likesDados[idMensagem]) {
    mostrarToast("⚠️ Você já curtiu");
    return;
  }
  likesCarregando[idMensagem] = true;
  const token = localStorage.getItem("token");
  let url = `${SCRIPT_SITE}?funcao=executarAcao`
    + `&acao=like`
    + `&id=${encodeURIComponent(idMensagem)}`;
  if (token) {
    url += `&token=${encodeURIComponent(token)}`;
  } else {
    url += `&userId=${encodeURIComponent(getUserId())}`;
  }
  // ❤️ marca local
  likesDados[idMensagem] = true;
  atualizarLikeVisual(idMensagem);
  renderizarBottomBar("detalhes");
  // 💥 ANIMAÇÃO NO CLICK
  setTimeout(() => {
    const icone = document.querySelector("#bottomBar i.bi-heart-fill");
    if (icone) {
      icone.classList.add("like-animado");
      setTimeout(() => {
        icone.classList.remove("like-animado");
      }, 300);
    }
  }, 50);
  fetch(url)
    .then(() => {
      mostrarToast("❤️ Curtido");
    })
    .catch(() => {
      delete likesDados[idMensagem];
      atualizarLikeVisual(idMensagem);
      renderizarBottomBar("detalhes");
      mostrarToast("⚠️ Erro ao curtir");
    })
    .finally(() => {
      likesCarregando[idMensagem] = false;
    });
}

function registrarCompra(idMensagem) {  fetch(`${SCRIPT_SITE}?funcao=registrarCompraPublico&id=${encodeURIComponent(idMensagem)}`)
    .catch(err => console.warn("Erro ao registrar compra", err));
}

let excluindoAnuncio = false;

function excluirAnuncio(idMensagem) {
  if (excluindoAnuncio) return;
  if (!confirm("Tem certeza que deseja excluir este anúncio?")) return;
  const token = localStorage.getItem("token");
  // 🚨 SEM TOKEN
  if (!token) {
    alert("Sessão inválida. Faça login novamente.");
    limparSessao();
    mostrarTelaLogin();
    return;
  }
  excluindoAnuncio = true;
  renderizarBottomBar("detalhes");
  fetch(`${SCRIPT_SITE}?funcao=executarAcao`
    + `&acao=excluir`
    + `&id=${encodeURIComponent(idMensagem)}`
    + `&token=${encodeURIComponent(token)}`)
    .then(res => res.text())
    .then(msg => {
      // 🚨 TOKEN INVÁLIDO NO SERVIDOR
      if (msg.includes("Sessão inválida")) {
        alert("Sessão expirou. Faça login novamente.");
        limparSessao();
        mostrarTelaLogin();
        return;
      }
      mostrarToast(msg);
      if (window.itemAtual && window.itemAtual.postagem == idMensagem) {
        voltarParaLista(true);
      } else {
        carregarAnuncios();
      }
    })
    .catch(() => {
      mostrarToast("⚠️ Erro ao excluir");
    })
    .finally(() => {
      excluindoAnuncio = false;
    });
}

let toastTimeout;

function mostrarToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = "1";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

function getUserIdentifier() {
  const sessao = obterSessao();
  // 🔐 usuário logado (Telegram)
  if (sessao?.id) {
    return sessao.id.toString().trim();
  }
  // 🌐 usuário não logado
  return getUserId().toString().trim();
}

function ehNovo(dataTexto) {
  if (!dataTexto) return false;
  const dataItem = new Date(dataTexto);
  const agora = new Date();
  const diffDias = (agora - dataItem) / (1000 * 60 * 60 * 24);
  return diffDias <= 3;
}

function enviarFormulario(event) {
  event.preventDefault();
  const form = document.getElementById("formAnuncio");
  const btnEnviar = form.querySelector('button[type="submit"]');
  const btnCancelar = form.querySelector('button[type="button"]');
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando...";
  btnCancelar.disabled = true;
  const dados = Object.fromEntries(new FormData(form).entries());
  Object.keys(dados).forEach(chave => {
    if (dados[chave].trim() === "") {
      delete dados[chave];
    }
  });
  const selecionados = Array.from(
    document.querySelectorAll('input[name="extra"]:checked')
  ).map(input => input.value);
  dados.extra = selecionados.join(", ");
  const token = localStorage.getItem("token");
  // 🚨 SEM TOKEN = FORÇA LOGIN
  if (!token) {
    alert("Sessão inválida. Faça login novamente.");
    limparSessao();
    mostrarTelaLogin();
    return;
  }
  const params = new URLSearchParams({
    funcao: "salvarFormulario",
    token: token,
    ...dados
  }).toString();
  fetch(`${SCRIPT_SITE}?${params}`)
    .then(res => res.text())
    .then(msg => {
      // 🚨 TOKEN INVÁLIDO NO SERVIDOR
      if (msg.includes("Sessão inválida")) {
        alert("Sessão expirou. Faça login novamente.");
        limparSessao();
        mostrarTelaLogin();
        return;
      }
      alert(msg);
      form.reset();
      voltarParaLista(true);
    })
    .catch(() => {
      alert("Erro ao enviar o formulário.");
    })
    .finally(() => {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
      btnCancelar.disabled = false;
    });
}

async function carregarAnuncios() {
  if (carregandoAnuncios) return;
  carregandoAnuncios = true;
  const container = document.getElementById("anuncios");
  // 🔥 limpa aviso de busca (se existir)
  const aviso = document.getElementById("semResultados");
  if (aviso) aviso.remove();
  // ⏳ LOADING
  container.innerHTML = `
  <div class="loading">
    <div class="loading-texto">Carregando anúncios...</div>
    <div class="spinner"></div>
  </div>
`;
  try {
    const resposta = await fetch(`${SCRIPT_SITE}?funcao=listarAnuncios`);
    if (!resposta.ok) {
      throw new Error('Resposta HTTP ' + resposta.status);
    }
    const anuncios = await resposta.json();
       // 🔴 Se vier inválido (erro silencioso)
    if (!Array.isArray(anuncios)) {
      container.innerHTML = '<div class="loading">Erro ao carregar anúncios.</div>';
      return;
    }
    window.anunciosCarregados = anuncios;
    // 🔥 RESETA OS LIKES
    likesDados = {};
    const userId = getUserIdentifier() || "";
    anuncios.forEach(a => {
  if (a.likesUsuarios?.some(id =>
    id.toString().trim() === userId.toString().trim()
  )) {
    likesDados[a.postagem] = true;
  }
});
    modoLista();
    esconderTodasTelas();
    container.style.display = "flex";
    renderizarAnuncios(anuncios);
  } catch (erro) {
    console.error("Erro ao carregar anúncios:", erro);
    // 🔴 ERRO DE REDE / FETCH
    container.innerHTML = '<div class="loading">Erro ao carregar anúncios.</div>';
  } finally {
    carregandoAnuncios = false;
  }
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
  if (!nome || !id) return null;
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
      await fetch(
        `${SCRIPT_SITE}?funcao=logout&token=${encodeURIComponent(token)}`
      );
    } catch (e) {}
  }
  limparSessao();
  alert("Sessão encerrada.");
  mostrarTelaLogin();
}

// Decide se mostra o botão Sair dentro do menu
function atualizarMenuUsuario() {
  const nome = localStorage.getItem("usuarioNome");
  const btnSair = document.getElementById("menuSair");
  if (btnSair) {
    btnSair.style.display = nome ? "flex" : "none";
  }
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
  const sessao = obterSessao();
  if (!sessao) {
    alert("Faça login para continuar.");
    mostrarTelaLogin();
    return;
  }
  modoFormulario();
  esconderTodasTelas();
  document.getElementById("formulario").style.display = "block";
  const campoUsuario = document.getElementById("usuario");
  if (campoUsuario) {
    campoUsuario.value = sessao.nome;
    campoUsuario.setAttribute("readonly", true);
// 🔥 Buscar WhatsApp
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
  // 🔹 Streaming
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
    });
  // 🔹 Extras
  const container = document.getElementById("containerExtras");
  if (container) {
    container.className = "checkbox-list hidden";
    container.innerHTML = "";
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

function limitarKotas(input) {
  if (input.value.length > 6) {
	input.value = input.value.slice(0, 6);
  }
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
    // ===============================
    // 🏷️ SEL0S (AQUI 👇)
    // ===============================
    let selos = "";
    if (ehNovo(item.data)) {
      selos += `<span class="selo novo">✨</span>`;
    }
    if (item.streamingExtra) {
      selos += `<span class="selo extra">➕</span>`;
    }
    if (item.oferta) {
      selos += `<span class="selo oferta">🔥</span>`;
    }
    // ===============================
    // 🧱 HTML
    // ===============================
    div.innerHTML = `
      <img class="logo" src="${item.logo}" alt="Logo">
      <div class="info">
        <div class="titulo">${item.streaming}</div>
        <div class="valor">${item.valor}</div>
      </div>
      <div class="selos">
        ${selos}
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

//Consegue gerar um ID para navegador normal
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
      <p><strong id="contadorPontos">
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
  const jaCurtiu = !!likesDados[item.postagem];
  // 👍 texto do botão
  const totalLikes = item.likes || 0;
  const textoLike = totalLikes === 1
    ? "1 Like"
    : `${totalLikes} Likes`;
  // ❤️ Like
  criarBotao(
  jaCurtiu ? "bi bi-heart-fill" : "bi bi-heart",
  `<span id="btnLikeTexto">${textoLike}</span>`,
  () => registrarLike(item.postagem)
);
  // 💬 Ver Postagem no Telegram
  criarBotao("bi bi-chat", "Postagem", () => {
    window.open(
      `https://t.me/dividir_contas_premium/${item.postagem}`,
      "_blank"
    );
  });
  // 📲 Compartilhar
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
    const url =      `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  });
  // 🗑 Excluir
  if (window.podeExcluir) {
    criarBotao(
      excluindoAnuncio ? "bi bi-arrow-repeat icone-girando" : "bi bi-trash",
      excluindoAnuncio ? "Excluindo..." : "Excluir",
      () => {
        if (!excluindoAnuncio) {
          excluirAnuncio(item.postagem);
        }
      }
    );
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
  texto += `👤 *MEUS ANÚNCIOS*\nhttps://tinyurl.com/divcp01?pesquisar=${usuarioSemArroba}\n\n`;
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
  const anuncios = container.querySelectorAll(".anuncio");
  anunciantePesquisaValido = null;
  let encontrou = false;
  anuncios.forEach(el => {
    const titulo = el.querySelector(".titulo").textContent.toLowerCase();
    const valor = el.querySelector(".valor").textContent.toLowerCase();
    const streamingExtra = (el.dataset.streamingExtra || "").toLowerCase();
    const anuncianteOriginal = el.dataset.anunciante;
    const anunciante = anuncianteOriginal
      .replace(/^@/, "")
      .toLowerCase();
    const mostrar =
  titulo.includes(termo) ||
  valor.includes(termo) ||
  anunciante.includes(termo) ||
  streamingExtra.includes(termo);
    el.style.display = mostrar ? "flex" : "none";
    if (mostrar) encontrou = true;
    if (termo && anunciante === termo.replace(/^@/, "")) {
      anunciantePesquisaValido = anuncianteOriginal;
    }
  });
  // ===============================
  // 🔍 SEM RESULTADO (USANDO loading)
  // ===============================
  let aviso = document.getElementById("semResultados");
  if (!encontrou && termo) {
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = "semResultados";
      aviso.className = "loading"; 
      aviso.innerText = "Nenhum anúncio encontrado.";
      container.appendChild(aviso);
    }
  } else {
    if (aviso) aviso.remove();
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
  let sessao = obterSessao();
  // ===============================
  // 🔄 TENTA LOGIN AUTOMÁTICO TELEGRAM (SEMPRE)
  // ===============================
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const nome = user.username ? "@" + user.username : user.first_name;
    try {
      const res = await fetch(
        `${SCRIPT_SITE}?funcao=loginTelegram`
        + `&id=${encodeURIComponent(user.id)}`
        + `&usuario=${encodeURIComponent(nome)}`
      );
      const dados = await res.json();
      if (dados.status === "ok") {
        salvarSessao(dados.nome, dados.id, dados.token);
        sessao = { nome: dados.nome, id: dados.id };
      } else {
        // ❌ TRATAMENTO DE ERROS (ANTES ERA DA FUNÇÃO REMOVIDA)
        if (dados.status === "nome_diferente") {
          alert("⚠️ Seu nome do Telegram mudou.\nRefaça o cadastro no grupo.");
        }
        else if (dados.status === "bloqueado") {
          alert("⛔ Seu acesso está bloqueado.\nFale com um administrador.");
        }
        else if (dados.status === "nao_cadastrado") {
          alert("🚫 Você não está cadastrado.\nFaça o cadastro no grupo.");
        }
      }
    } catch (e) {
      console.warn("Erro no login automático Telegram:", e);
    }
  }
  // 🔄 Atualiza botão sair
  atualizarMenuUsuario();
  // 🔄 Carrega anúncios
  await carregarAnuncios();
  // ===============================
  // 🚫 CONTROLE DE PARÂMETROS
  // ===============================
  let acaoExecutada = false;
  if (!parametrosJaProcessados && window.location.search) {
    parametrosJaProcessados = true;
    const idDireto = params.get("a") || params.get("id");
    const termoPesquisa = params.get("p") || params.get("pesquisar");
    // 🔗 DETALHE
    if (idDireto) {
      const item = window.anunciosCarregados?.find(
        a => a.postagem == idDireto
      );
      if (item) {
        mostrarDetalhes(item);
        acaoExecutada = true;
      }
    }
    // 🔍 PESQUISA
    if (termoPesquisa) {
      const barra = document.getElementById("pesquisa");
      if (barra) {
        barra.value = termoPesquisa;
        filtrarAnuncios();
      }
      renderizarBottomBar("lista");
      acaoExecutada = true;
    }
    // 📢 FORMULÁRIO (PROTEGIDO)
    if (params.has("anunciar")) {
      if (sessao) {
        await mostrarFormulario();
      } else {
        alert("Faça login para anunciar.");
        mostrarTelaLogin();
      }
      acaoExecutada = true;
    }
    if (acaoExecutada) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  // 🏠 PADRÃO
  if (!acaoExecutada) {
    renderizarBottomBar("lista");
  }
  // ===============================
  // 🎧 EVENTOS
  // ===============================
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
