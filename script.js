// ===============================
// 🔗 CONFIGURAÇÃO GLOBAL APPS SCRIPT
// ===============================
const SCRIPT_SITE = "https://script.google.com/macros/s/AKfycbwwC1b5pPAaKlkXkKkMtUteb4yG4-YbnmugdXbhXDtTxPSE_OOCvs34ivYxlD8VJhEXjg/exec";
const SCRIPT_BOT = "https://script.google.com/macros/s/AKfycbwkc7674s3_YfXsiv1vQzzOx0QzVjWptbJi10wA4N1_mN5Xu1Rsu5-vP4m5py443iXI/exec";
  const DURACAO_SESSAO = 30 * 24 * 60 * 60 * 1000; // 30 dias

// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let anunciantePesquisaValido = null;
let tentativasLogin = 0;
let bloqueioLogin = false;
let indiceAtualDetalhes = -1;
let startX = 0;
let endX = 0;

  async function carregarAnuncios() {
  const container = document.getElementById("anuncios");
  container.innerHTML = '<div class="loading">Carregando Anúncios...</div>';
  try {
    const resposta = await fetch(`${SCRIPT_SITE}?funcao=listarAnuncios`);
    if (!resposta.ok) throw new Error('Resposta HTTP ' + resposta.status);
    const anuncios = await resposta.json();
    // usa a função já existente no seu código para renderizar os itens
    renderizarAnuncios(anuncios);
    // 🔹 Depois que exibir os anúncios, aplica filtro inicial (se existir)
    const params = new URLSearchParams(window.location.search);
    const termoPesquisa = params.get("pesquisar");
    if (termoPesquisa) {
      const barraPesquisa = document.getElementById("pesquisa");
      if (barraPesquisa) {
        barraPesquisa.value = termoPesquisa;
        filtrarAnuncios(); // agora roda com os anúncios já carregados
      }
    }
  } catch (erro) {
    container.innerHTML = '<div class="erro">Erro ao carregar anúncios.</div>';
    console.error("Erro ao carregar anúncios:", erro);
  }
}

const opcoesExtra = [
  "Adrenalina Pura", "Apple TV+", "Canais Globo", "Cindie", "Combate",
  "Crunchyroll", "Disney+", "ESPN", "GloboPlay", "HBO Max", "Look", "MGM+",
  "MUBI", "NBA", "Netflix", "Nosso Futebol+", "Paramount+", "Premiere", "Reserva Imovision",  "Sony One", "Spotify", "Telecine", "UFC Fight Pass", "Universal+", "YouTube"
];

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

function salvarSessao(nome, id) {
  const agora = Date.now();
  localStorage.setItem("usuarioNome", nome);
  localStorage.setItem("usuarioId", id);
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
  atualizarMenuUsuario();
}

function sair() {
  limparSessao();
  alert("Sessão encerrada.");
  location.reload();
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
      salvarSessao(dados.nome, dados.id);
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
    salvarSessao(dados.nome, dados.id);
    mostrarFormulario();
    return; // aqui não precisa reabilitar porque vai trocar de tela
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
      salvarSessao(dados.nome, dados.id);
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

function enviarFormulario(event) {
  event.preventDefault();
  const form = document.getElementById("formAnuncio");
  const btnEnviar = form.querySelector('button[type="submit"]');
  const btnCancelar = form.querySelector('button[type="button"]');
  // Desativa os botões para evitar múltiplos cliques
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando...";
  btnCancelar.disabled = true;
  const dados = Object.fromEntries(new FormData(form).entries());
//  Remove campos vazios (inclusive a oferta se não selecionado)
Object.keys(dados).forEach(chave => {
  if (dados[chave].trim() === "") {
    delete dados[chave];
  }
});
  // Concatena múltiplas assinaturas extras
  const selecionados = Array.from(document.querySelectorAll('input[name="extra"]:checked'))
                        	.map(input => input.value);
  dados.extra = selecionados.join(", ");
  const params = new URLSearchParams(dados).toString();
  fetch(`${SCRIPT_SITE}?${params}`)
	.then(res => res.text())
	.then(msg => {
  	alert(msg);
  	form.reset();
  	voltarParaLista(true);
	})
	.catch(err => {
  	alert("Erro ao enviar o formulário.");
	})
	.finally(() => {
  	// Reativa os botões
  	btnEnviar.disabled = false;
  	btnEnviar.textContent = "Enviar";
  	btnCancelar.disabled = false;
	});
}

function formatarUsuario(input) {
  // Remove espaços no início e fim
  let valor = input.value.trim();
  // Se não começa com @, adiciona
  if (valor && !valor.startsWith('@')) {
	valor = '@' + valor.replace(/^@+/, '');
  }
  input.value = valor;
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

function registrarLike(idMensagem) {
const userId = getUserId();
fetch(`${SCRIPT_BOT}?funcao=registrarLike&id=${encodeURIComponent(idMensagem)}&userId=${encodeURIComponent(userId)}`)
.then(res => res.text())
.then(msg => alert(msg))
.catch(err => alert("Erro ao registrar like."));
}

function registrarCompra(idMensagem) {
fetch(`${SCRIPT_BOT}?funcao=registrarCompra&id=${encodeURIComponent(idMensagem)}`)
.catch(err => console.warn("Erro ao registrar compra", err));
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
      <p><strong>📺 ${item.streaming}</strong></p>
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
      const link = `https://t.me/dividir_contas_premium/${item.postagem}`;
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(link)}`;
      window.open(url, "_blank");
    });
    // 🗑 Excluir (somente dono)
    if (window.podeExcluir) {
      criarBotao("bi bi-trash", "Excluir", () => {
        excluirAnuncio(item.postagem, item.anunciante);
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
  const anuncios = document.querySelectorAll(".anuncio");
  anunciantePesquisaValido = null;
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
    if (termo && anunciante === termo.replace(/^@/, "")) {
      anunciantePesquisaValido = anuncianteOriginal;
    }
  });
}

function excluirAnuncio(idMensagem, anunciante) {
  if (!confirm("Tem certeza que deseja excluir este anúncio?")) return;
fetch(`${SCRIPT_BOT}?funcao=excluirAnuncio&id=${encodeURIComponent(idMensagem)}&nomeUsuario=${encodeURIComponent(anunciante)}`)
    .then(res => res.text())
    .then(msg => {
      alert(msg);
      voltarParaLista(true);
    })
    .catch(err => alert("Erro ao excluir anúncio."));
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
  // 🔎 Verifica sessão existente
  const sessao = obterSessao();
  // 🔄 Se não tiver sessão, tentar login automático via Telegram
  if (!sessao && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    const nome = user.username ? "@" + user.username : user.first_name;
    const res = await fetch(
`${SCRIPT_SITE}?funcao=loginTelegram&usuario=${encodeURIComponent(nome)}`
    );
    const dados = await res.json();
    if (dados.status === "ok") {
      salvarSessao(dados.nome, dados.id);
    }
  }
  // 🔄 Atualiza botão Sair após possível login automático
  atualizarMenuUsuario();
  await carregarAnuncios();
  // 🔥 Se abrir direto no formulário
  if (params.has("anunciar")) {
    mostrarFormulario();
  } else {
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