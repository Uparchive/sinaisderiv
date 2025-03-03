document.addEventListener('DOMContentLoaded', () => {
  // Referências aos elementos DOM
  const buscarSinaisButton = document.getElementById('buscar-sinais');
  const moedaInput = document.getElementById('moeda-input');
  const tipoNegociacaoSelect = document.getElementById('tipo-negociacao');
  const tempoVelaSelect = document.getElementById('tempo-vela');
  const tipoOperacaoSelect = document.getElementById('tipo-operacao');
  const initialMenu = document.getElementById('initial-menu');
  const loadingScreen = document.getElementById('loading-screen');
  const resultsScreen = document.getElementById('results-screen');
  const sinaisLista = document.getElementById('sinais-lista');
  const moedasLista = document.getElementById('moedas-lista');
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  const notificationArea = document.getElementById('notification-area');

  // Conexão via WebSocket com a Deriv API (substitua 12345 pelo seu App ID numérico)
  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=12345');

  ws.onopen = () => {
    console.log('Conexão estabelecida com a Deriv API');
    // Autoriza usando seu token (substitua pelo seu token real)
    ws.send(JSON.stringify({
      authorize: 'pnkUqYA6tJCmLPD'
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Recebido:', data);

    // Se for mensagem de erro
    if (data.msg_type === 'error') {
      console.error('Erro da API:', data.error);
      showNotification(`Erro da API: ${data.error?.message || 'desconhecido'}`);
      return;
    }

    // Se for autorização bem-sucedida
    if (data.msg_type === 'authorize') {
      console.log('Autorizado com sucesso!');
      showNotification('Autorizado com sucesso!');
      return;
    }

    // Se receber dados de histórico (candles)
    if (data.msg_type === 'ticks_history' && data.candles) {
      processCandlesData(data.candles);
    }
  };
  
  ws.onerror = (err) => {
    console.error('Erro no WebSocket:', err);
    showNotification('Erro na conexão com a Deriv API.');
  };
  
  ws.onclose = () => {
    console.log('Conexão fechada.');
  };

  // Exibe uma notificação temporária
  const showNotification = (message) => {
    notificationArea.textContent = message;
    notificationArea.style.display = 'block';
    setTimeout(() => {
      notificationArea.style.display = 'none';
    }, 5000);
  };

  /**
   * Calcula os horários importantes com base no tempo de vela escolhido.
   * @param {number} tempoVelaEmMinutos Tempo de vela em minutos.
   * @returns {Object} { horarioGerado, horarioEntrada, horarioExpiracao }
   */
  function calcularHorarios(tempoVelaEmMinutos) {
    const agora = new Date();
    const horarioGerado = agora.toLocaleTimeString();

    const proximoMinuto = new Date(agora);
    proximoMinuto.setSeconds(0);
    proximoMinuto.setMilliseconds(0);
    if (agora.getSeconds() > 0) {
      proximoMinuto.setMinutes(proximoMinuto.getMinutes() + 1);
    }
    const horarioEntrada = proximoMinuto.toLocaleTimeString();

    const expiracao = new Date(proximoMinuto);
    expiracao.setMinutes(expiracao.getMinutes() + Number(tempoVelaEmMinutos));
    const horarioExpiracao = expiracao.toLocaleTimeString();

    return { horarioGerado, horarioEntrada, horarioExpiracao };
  }

  /**
   * Processa o array de candles recebido e exibe o sinal com dados reais.
   * Lógica simples: se o fechamento do último candle for maior que a abertura, sinaliza "CALL"; caso contrário, "PUT".
   * @param {Array} candles Array de candles (cada candle contém open, close, epoch, etc.)
   */
  function processCandlesData(candles) {
    const lastCandle = candles[candles.length - 1];
    // Lógica simples para determinar sinal
    const direcao = (parseFloat(lastCandle.close) > parseFloat(lastCandle.open)) ? "CALL" : "PUT";
    const candleTimestamp = new Date(lastCandle.epoch * 1000).toLocaleTimeString();

    const tempoVela = tempoVelaSelect.value;
    const { horarioGerado, horarioEntrada, horarioExpiracao } = calcularHorarios(tempoVela);
    const moeda = moedaInput.value.trim() || 'EUR/USD';
    const tipoOperacao = tipoOperacaoSelect.value;
    const tipoNegociacao = tipoNegociacaoSelect.value;

    // Atualiza a interface com o sinal
    sinaisLista.innerHTML = '';
    const sinalDiv = document.createElement('div');
    sinalDiv.classList.add('sinal');
    sinalDiv.innerHTML = `
      <strong>Moeda:</strong> ${moeda}<br>
      <strong>Direção:</strong> ${direcao}<br>
      <strong>Preço (fechamento):</strong> ${lastCandle.close}<br>
      <strong>Horário do Candle:</strong> ${candleTimestamp}<br>
      <strong>Horário do Sinal:</strong> ${horarioGerado}<br>
      <strong>Horário de Entrada:</strong> ${horarioEntrada}<br>
      <strong>Horário de Expiração:</strong> ${horarioExpiracao}<br>
      <strong>Tempo de Vela:</strong> ${tempoVela} Minuto(s)<br>
      <strong>Tipo de Operação:</strong> ${tipoOperacao}<br>
      <strong>Tipo de Negociação:</strong> ${tipoNegociacao}
    `;
    sinaisLista.appendChild(sinalDiv);
    showNotification(`Sinal atualizado: ${direcao} para ${moeda}`);
  }

  /**
   * Atualiza a lista de melhores moedas.
   * Neste exemplo, usamos uma lista fixa. Em produção, essa lista pode vir de outra API.
   */
  function atualizarMelhoresMoedas() {
    const melhoresMoedas = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'];
    moedasLista.innerHTML = '';
    melhoresMoedas.forEach((moeda) => {
      const moedaLi = document.createElement('li');
      moedaLi.textContent = moeda;
      moedasLista.appendChild(moedaLi);
    });
  }

  // Event listener para o botão "Buscar Sinais"
  buscarSinaisButton.addEventListener('click', (e) => {
    e.preventDefault();

    const moeda = moedaInput.value.trim() || 'EUR/USD';
    const tempoVela = tempoVelaSelect.value;
    
    // Oculta o menu inicial e exibe a tela de carregamento
    initialMenu.style.display = 'none';
    loadingScreen.style.display = 'flex';

    // Converte o par de moedas para o formato da Deriv API
    // Exemplo: "EUR/USD" -> "frxEURUSD"
    const derivSymbol = `frx${moeda.replace('/', '')}`;

    // Solicita histórico de candles à API
    ws.send(JSON.stringify({
      ticks_history: derivSymbol,
      adjust_start_time: 1,
      count: 10,              // Número de candles a retornar
      end: "latest",
      style: "candles",
      granularity: Number(tempoVela) * 60 // Converte tempo de vela para segundos
    }));

    // Pequeno delay para transição de telas
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      resultsScreen.style.display = 'block';
      atualizarMelhoresMoedas();
    }, 2500);
  });

  // Alterna o tema (claro/escuro)
  themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    document.querySelectorAll('section').forEach(section => {
      section.classList.toggle('dark-mode');
    });
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
  });
  
  // Aplica a preferência de tema salva
  if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    document.querySelectorAll('section').forEach(section => section.classList.add('dark-mode'));
  }
});
