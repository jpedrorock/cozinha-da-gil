/**
 * Conteúdo do Guia do Usuário — escrito pra família/staff simples.
 *
 * Regras de escrita:
 *   - Zero jargão técnico (sem PWA, SSE, API, código, etc)
 *   - Cenários reais com nomes (Maria, José, Gil)
 *   - 2-3 frases por tópico, sem prosa longa
 *   - Verbos simples: toca, abre, clica, escolhe
 *   - Como se fosse explicação verbal pra alguém que usa iFood
 */

export type GuideTopic = {
  title: string;
  body: string;
  /** Truques úteis — bullets com lâmpada amarela */
  tips?: string[];
  /** Atenções/avisos — bullets com alerta vermelho */
  rules?: string[];
};

export type GuideSection = {
  id: string;
  title: string;
  /** Lucide icon name */
  icon: string;
  description: string;
  topics: GuideTopic[];
};

export type GuideTab = {
  id: "geral" | "atendente" | "cozinha" | "admin";
  label: string;
  icon: string;
  sections: GuideSection[];
};

export const GUIDE: GuideTab[] = [
  // ============================================================
  //   GERAL — primeiros passos
  // ============================================================
  {
    id: "geral",
    label: "Começar",
    icon: "Sparkles",
    sections: [
      {
        id: "login",
        title: "Como entrar no app",
        icon: "KeyRound",
        description: "Sua senha de 4 números e troca rápida de pessoa.",
        topics: [
          {
            title: "Abrir o app pela primeira vez",
            body: "Escolha o que você é hoje: Atendente (quem anota pedido), Cozinha (quem prepara) ou Admin (Gil). Depois digite sua senha de 4 números e pronto.",
            tips: [
              "A senha já manda você pra dentro assim que digita o 4º número.",
              "Errou? O quadro treme e você tenta de novo.",
            ],
          },
          {
            title: "Trocar de pessoa no mesmo tablet",
            body: "No topo da tela tem uma bolinha com seu nome. Toca nela, confirma 'Sair' e cai de volta pra tela de senha. Agora a próxima pessoa digita a dela.",
            tips: [
              "Sempre troca quando passar o tablet — assim quem fez cada pedido fica certo.",
            ],
          },
          {
            title: "App te desloga sozinho",
            body: "Se ninguém tocar a tela por 30 minutos, o app desloga sozinho. Evita que tablet esquecido fique aberto pro mundo.",
            rules: [
              "Não desloga enquanto você tá montando um pedido — pode conversar com cliente sem pressa.",
            ],
          },
        ],
      },
      {
        id: "instalar",
        title: "Colocar como app no celular",
        icon: "Smartphone",
        description: "Pra ficar igual aplicativo nativo, com ícone na tela.",
        topics: [
          {
            title: "No iPhone (Safari)",
            body: "Abre cozinhadagil.evapro.cloud no Safari. Toca no quadradinho com a seta pra cima (compartilhar) → 'Adicionar à Tela de Início'. O ícone aparece na sua tela igual app de banco.",
            rules: [
              "Tem que ser Safari. Chrome no iPhone não funciona pra isso.",
            ],
          },
          {
            title: "No Android (Chrome)",
            body: "Abre o site no Chrome. Vai aparecer 'Adicionar à tela inicial' embaixo — toca pra confirmar. Se não aparecer, vai nos 3 pontinhos do canto e procura 'Instalar app'.",
          },
          {
            title: "Quando sai versão nova",
            body: "Não precisa baixar nada de novo. Quando você abre o app com internet, ele atualiza sozinho. Pronto.",
          },
        ],
      },
      {
        id: "conexao",
        title: "Quando aparece 'Sem conexão'",
        icon: "Wifi",
        description: "Internet caiu? Calma — explica o que fazer.",
        topics: [
          {
            title: "Pedido aparece na hora",
            body: "Quando Maria faz pedido novo, José vê na cozinha em 1 segundo. Tudo sincroniza sozinho — não precisa atualizar a tela.",
          },
          {
            title: "Vermelho no canto = wifi caiu",
            body: "Se aparece uma pílula vermelha 'Sem conexão' lá em cima, é porque o wifi caiu ou tá ruim. O app continua mostrando o que já tinha na tela.",
            rules: [
              "Fazer pedido novo, marcar pronto ou cancelar não vai funcionar até voltar.",
              "Assim que volta o wifi, o app reconecta sozinho.",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   ATENDENTE
  // ============================================================
  {
    id: "atendente",
    label: "Atendente",
    icon: "ClipboardList",
    sections: [
      {
        id: "novo-pedido",
        title: "Anotar um pedido",
        icon: "Plus",
        description: "Cliente chegou pedindo? Aperta o botão amarelo e segue.",
        topics: [
          {
            title: "Botão grande amarelo embaixo",
            body: "Toca em 'Novo pedido' lá embaixo da tela. Abre o passo-a-passo do que perguntar pro cliente.",
          },
          {
            title: "1º — Quem é o cliente",
            body: "Escreve o nome do jeito que vai chamar quando ficar pronto (pode ser 'Mesa 5' ou só 'Balcão'). Telefone é só se quiser avisar pelo WhatsApp depois.",
            tips: [
              "Tem botão 'Atendimento rápido' que pula essa parte se for cliente passageiro.",
              "Telefone formata sozinho: (11) 99999-9999.",
            ],
          },
          {
            title: "2º — O que ele quer comer",
            body: "Escolhe entre Salgado, Doce, Bebida, Macarrão ou Combo. Se tem tamanho (Pequeno, Grande), escolhe também.",
            tips: [
              "Bebidas pulam a cozinha — ficam logo 'Pronto' pra você pegar.",
            ],
          },
          {
            title: "3º — Recheios e molhos",
            body: "Toca em cada coisa que ele quer (frango, catupiry, etc). Se quiser tudo, tem botão 'Marcar todos'. Depois escolhe os molhos.",
            rules: [
              "Recheio que Gil desligou no Cardápio não aparece pra escolha.",
            ],
          },
          {
            title: "4º — Quantos iguais",
            body: "Se o cliente quer 3 pastéis iguais, coloca 3. Default é 1. A cozinha vai preparar a quantidade que você marcar.",
          },
          {
            title: "5º — Alguma observação?",
            body: "Botões prontos pros pedidos mais comuns: 'sem cebola', 'bem dourado', etc. Toca pra ativar. Se for algo diferente, escreve no campo embaixo.",
            tips: [
              "'Sem cebola' fica vermelho gritante na cozinha — eles não esquecem.",
              "Pode marcar vários, tipo 'sem cebola, bem dourado'.",
            ],
          },
          {
            title: "6º — Conferir e mandar",
            body: "Aparece a lista de tudo que o cliente pediu com o preço total. Se tiver algo errado, toca no lápis pra editar ou X pra tirar. Quando estiver certo, toca 'Confirmar pedido'.",
            rules: [
              "Caixa fechado? Não dá pra confirmar — peça pra Gil abrir.",
              "Se a internet falhar e você apertar de novo, o app pergunta 'É outro pedido?' antes de mandar duplicado.",
            ],
          },
          {
            title: "7º — Tela do recibo bonitinho",
            body: "Depois de confirmar, o app vai direto pra tela do comprovante. Mostra logo da Cozinha, número, items e total. Daí você tem 4 botões: Imprimir, Pré-visualizar (modo 80mm térmica), Enviar no WhatsApp (verde) e Copiar link de acompanhamento. No fim, 'Voltar à fila'.",
            tips: [
              "Quando toca 'Enviar no WhatsApp', o app abre o WhatsApp já com a mensagem pronta + um link pro cliente acompanhar o pedido pelo celular. Você só revisa e aperta enviar.",
              "Depois de mandar pelo WhatsApp, o app volta sozinho pra fila — não fica em tela parada.",
            ],
          },
          {
            title: "Link pro cliente acompanhar (novidade)",
            body: "Toda vez que cria pedido novo, o cliente ganha um link tipo cozinhadagil.evapro.cloud/p/abc7x9k2. Ele abre no celular e vê o status ao vivo: 'Pedido recebido' → 'Em preparo' → 'Tá pronto!' (com bolinha pulsando) → 'Entregue'.",
            tips: [
              "O link já entra na mensagem do WhatsApp automaticamente.",
              "Botão 'Copiar link de acompanhamento' na tela do recibo se você quiser mandar por SMS ou Instagram.",
              "O link tem um código aleatório (10 letras) — cliente não consegue ver pedido dos outros adivinhando.",
            ],
          },
        ],
      },
      {
        id: "fila",
        title: "Acompanhar pedidos",
        icon: "ListOrdered",
        description: "Ver quem tá pronto, quem ainda tá fazendo.",
        topics: [
          {
            title: "Filtros lá em cima",
            body: "Os botões mostram: 'Pedido feito' (esperando cozinha), 'Em preparo', 'Pronto' (esperando cliente buscar), 'Entregue' e 'Cancelado'. O número do lado é quantos tem em cada.",
            tips: [
              "Por padrão abre em 'Pronto' — quem precisa ir buscar primeiro.",
            ],
          },
          {
            title: "Cliente mudou de ideia — editar",
            body: "Tem botão 'Editar' nos pedidos que ainda não saíram. Abre o pedido inteiro do jeito que tava, você muda o que precisar e salva. A cozinha recebe um alerta vermelho avisando.",
            rules: [
              "Depois que tá 'Pronto', não dá mais pra mexer.",
            ],
          },
          {
            title: "Cliente desistiu de UM item",
            body: "Em pedidos com vários items, cada linha tem um X. Toca pra tirar só aquele. Aparece 'Desfazer' por 6 segundos caso clique errado.",
            rules: [
              "Se sobrar 1 item só, o X some — aí use 'Cancelar' o pedido inteiro.",
            ],
          },
          {
            title: "Cancelar o pedido inteiro",
            body: "Botão 'Cancelar' no pedido. Abre uma caixinha pedindo o motivo: 'Cliente foi embora', 'Ingrediente acabou', 'Erro no pedido' ou 'Cliente desistiu'.",
            rules: [
              "Se a cozinha já começou a fazer, só Gil ou o pessoal da cozinha pode cancelar — pra todo mundo combinar antes.",
            ],
          },
          {
            title: "Cliente sumiu sem buscar",
            body: "No pedido que tá 'Pronto' há tempos, aparece botão 'Cliente sumiu'. Usa pra marcar como cancelado quando ele desapareceu mesmo.",
          },
          {
            title: "Avisar cliente pelo WhatsApp",
            body: "Se o pedido tá 'Pronto' e o cliente deu telefone, aparece botão 'Avisar'. Abre o WhatsApp com mensagem pronta — você só toca enviar.",
            tips: [
              "Cliente não respondeu? Depois de 5 minutos o botão volta como 'Avisar de novo' (laranja).",
              "Aparece 'Avisado · há X min' pra você lembrar quando mandou.",
            ],
          },
          {
            title: "Aviso amarelo lá em cima",
            body: "Se a barra amarela aparece dizendo que o caixa tá aberto há muitas horas, é porque a Gil esqueceu de fechar ontem. Pedidos novos vão pro caixa errado — chama ela.",
            tips: [
              "Se for festa que continuou madrugada adentro, toca no X pra dispensar.",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   COZINHA
  // ============================================================
  {
    id: "cozinha",
    label: "Cozinha",
    icon: "CookingPot",
    sections: [
      {
        id: "operacao",
        title: "Receber e preparar pedidos",
        icon: "ChefHat",
        description: "Os cards aparecem sozinhos — só seguir os botões.",
        topics: [
          {
            title: "Pedido chegando na fila",
            body: "Aparece card amarelo brilhando no topo + som de notificação. Lá tem o nome do cliente, número do pedido e tudo que ele pediu.",
            tips: [
              "Bebida só não aparece — atendente entrega da geladeira direto.",
            ],
          },
          {
            title: "Começar a preparar",
            body: "Toca em 'Iniciar preparo'. O card muda de cor e começa um cronômetro circular ao redor da hora — verde no começo, amarelo passando 10 min, laranja 15 min, vermelho 20 min.",
            tips: [
              "Passou de 20 minutos, o card inteiro pisca vermelho — chama atenção.",
            ],
          },
          {
            title: "Marcar como Pronto",
            body: "Quando tá pronto, toca 'Pronto'. O card sai da sua tela e vai pra do atendente — ele entrega ou avisa o cliente.",
          },
          {
            title: "Cancelar (queimou, acabou, etc)",
            body: "Tem botão 'Cancelar' também. Abre a caixinha pedindo motivo — escolhe o que aconteceu e confirma.",
          },
          {
            title: "Quando atendente muda no meio",
            body: "Se Maria editar um pedido enquanto você tá preparando, o card vira vermelho com aviso 'Atendente alterou — revise os itens' + um som diferente. Para o que tá fazendo, olha o que mudou.",
          },
          {
            title: "Várias unidades = 2 colunas",
            body: "Se o cliente pediu 3 pastéis iguais, em vez de 3 cards um embaixo do outro, viram 2 lado a lado pra caber tudo na tela. Cada um é uma unidade separada.",
          },
          {
            title: "Observações 'sem' em vermelho",
            body: "Se atendente marcou 'sem cebola', aparece grandão vermelho no topo do item — você lê antes de começar. Outras coisas ('bem dourado') ficam em amarelo, mais discreto.",
          },
          {
            title: "Checklist esperto pra pastel grande",
            body: "Em vez de listar 12 recheios riscados, o ticket adapta: se a maioria vai, mostra só 'Vai tudo, menos: Cebola, Bacon' em laranja. Se só uns 2-3 vão, mostra só os ✓ marcados. Quando vai tudo, aparece 'Tudo (12)'.",
            tips: [
              "Menos visual, menos chance de confundir.",
            ],
          },
          {
            title: "Ver pedidos prontos do dia",
            body: "Botão 'Prontos' no botnav embaixo abre um drawer com todos os pedidos finalizados hoje (Pronto + Entregue). Read-only — pra conferir sem refazer por engano.",
            tips: [
              "Útil pra confirmar se já mandou pra alguém quando atendente pergunta.",
            ],
          },
        ],
      },
      {
        id: "busca",
        title: "Buscar e organizar fila",
        icon: "Search",
        description: "Botões embaixo: Buscar, Ordenar e Som.",
        topics: [
          {
            title: "Achar um pedido específico",
            body: "Toca 'Buscar' lá embaixo. Digita o nome do cliente ou o número (#042 ou 42). Filtra na hora.",
            tips: [
              "Tem teclado? Tecla '/' pra abrir/fechar a busca.",
            ],
          },
          {
            title: "Ordenar por mais atrasado",
            body: "Botão 'Chegada' (mostra o mais antigo primeiro) ou 'Urgência' (mostra quem tá há mais tempo em preparo primeiro). Toca pra alternar.",
            tips: [
              "Atalho do teclado: tecla 'S'.",
              "A escolha fica salva — quando abre de novo lembra a sua preferência.",
            ],
          },
          {
            title: "Ligar ou desligar som",
            body: "Botão 'Som' ou 'Mudo'. Quando ligado, toca som a cada pedido novo e alarmes pra pedidos atrasados.",
            tips: [
              "Atalho: tecla 'M'.",
            ],
          },
          {
            title: "Som diferente pra cada urgência",
            body: "10 min sem terminar = 1 bip médio. 15 min = bips mais agudos. 20+ min = bip alarme repetindo a cada 2 minutos até você marcar pronto.",
            rules: [
              "Se você desligar o som, todos os alarmes vão junto.",
            ],
          },
        ],
      },
      {
        id: "atalhos",
        title: "Atalhos de teclado",
        icon: "Keyboard",
        description: "Só se você usar tablet com teclado ou notebook.",
        topics: [
          {
            title: "Lista completa",
            body: "Funcionam quando você não tá digitando em algum campo:",
            tips: [
              "/  →  Abrir/fechar busca",
              "S  →  Trocar ordenação (chegada ↔ urgência)",
              "M  →  Ligar/desligar som",
              "?  →  Mostrar essa lista de atalhos",
              "Esc  →  Fechar busca ou ajuda",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   ADMIN
  // ============================================================
  {
    id: "admin",
    label: "Admin",
    icon: "ChartBar",
    sections: [
      {
        id: "caixa",
        title: "Abrir e fechar caixa",
        icon: "Activity",
        description: "Sempre o primeiro passo do dia. Sem caixa, atendente não vende.",
        topics: [
          {
            title: "Começar uma festa",
            body: "Toca 'Abrir caixa'. Bota um nome do evento (tipo 'Aniversário João' ou só a data) e confirma. Daí todos os pedidos novos vão pra essa festa.",
            rules: [
              "Só pode ter 1 caixa aberto por vez.",
              "Sem caixa aberto, atendente não consegue fazer pedido.",
            ],
          },
          {
            title: "Acompanhar ao vivo",
            body: "Enquanto o caixa tá aberto, a tela mostra contador de pedidos, receita parcial e quadro com cada status (Pedido feito / Em preparo / Pronto / Entregue). Atualiza sozinho.",
          },
          {
            title: "Encerrar a festa",
            body: "Toca 'Fechar caixa'. O app guarda o total final daquela festa. Nenhum pedido novo entra mais nessa.",
          },
          {
            title: "Ver festas antigas",
            body: "Lista de todas as festas anteriores com data, total e quem abriu/fechou. Clica em uma pra ver os pedidos dela ou baixar o relatório.",
          },
        ],
      },
      {
        id: "vendas",
        title: "Ver vendas do dia/semana/mês",
        icon: "TrendingUp",
        description: "Quanto vendeu, quantos pedidos, o que vende mais.",
        topics: [
          {
            title: "Trocar o período",
            body: "Botões 'Hoje', 'Semana', 'Mês' ou 'Personalizado' lá em cima. Quando muda, todos os números embaixo recalculam.",
          },
          {
            title: "Os 4 números principais",
            body: "Faturamento (quanto entrou), Pedidos (quantos), Ticket médio (média por pedido) e Tempo médio de preparo (quanto a cozinha demora).",
            tips: [
              "No PDF do dia, cada número vem com a comparação: '+12% que ontem' ou '-8% que semana passada'.",
            ],
          },
          {
            title: "O que vende mais",
            body: "Lista dos recheios, sabores e molhos mais pedidos no período. Tem coluna 'Receita' mostrando quanto cada um trouxe de dinheiro.",
            tips: [
              "Quando o período não é 'Hoje', aparece troféu 🏆 no campeão.",
            ],
          },
          {
            title: "Baixar planilha (Excel)",
            body: "Botão baixa um arquivo com tudo do período: pedidos, cancelados com motivo, quem atendeu, preços, telefone. Abre no Excel ou Google Planilhas.",
          },
          {
            title: "Baixar relatório bonito (PDF)",
            body: "Arquivo PDF visual: capa, números grandes, resumo financeiro, top vendidos e gráfico por hora ou dia. Pra imprimir ou mandar pro contador.",
          },
        ],
      },
      {
        id: "cardapio",
        title: "Mexer no cardápio",
        icon: "UtensilsCrossed",
        description: "Adicionar produtos e recheios. Ligar/desligar quando acabar.",
        topics: [
          {
            title: "Criar produto novo",
            body: "Botão 'Novo produto'. Escolhe o tipo (salgado, doce, bebida, etc), nome, preço e quais recheios aceita. Pode subir uma foto também (pras bebidas com marca, tipo Coca).",
            tips: [
              "Botão 'Disponível' liga/desliga sem precisar apagar.",
            ],
          },
          {
            title: "Tamanhos diferentes",
            body: "Se o produto vende em mais de um tamanho (Pequeno e Grande, por exemplo), cadastra cada tamanho com seu preço.",
          },
          {
            title: "Recheios e molhos",
            body: "Lista todos os recheios disponíveis. Cada um tem nome, ícone, ordem e botão 'disponível'. Atendente só vê os que tão disponíveis.",
          },
          {
            title: "Tem ou não tem (toggle simples)",
            body: "Cada recheio e produto tem um toggle 'Disponível / Esgotou'. Quando acabar o bacon, vira a chavinha — atendente vê o chip sumir em 1 segundo, sem precisar atualizar a tela. Quando reabastecer, liga de volta.",
            tips: [
              "Não tem contagem numérica nem alerta de 'pouco estoque' — só liga e desliga.",
              "A mudança propaga via tempo-real (SSE), atendente vê na hora.",
            ],
          },
          {
            title: "Produtos pré-montados (combos fixos)",
            body: "Alguns produtos vêm com tudo já pronto — sem o cliente montar. Tipo Pastel Churrasqueiro (carne desfiada + queijo + barbecue), Torta de Frango, Torta de Alho Poró e Bacon. Atendente toca 1 vez e pronto, sem passar pelas etapas de recheio/molho.",
            tips: [
              "Pra cadastrar: 'Novo produto' → tipo salgado → preço fixo → desligar 'Aceita ingredientes'.",
            ],
          },
          {
            title: "Macarrão: escolha de massa",
            body: "Macarrão tem uma categoria nova de ingrediente: 'macarrao_massa'. Coloca Penne e Espaguete lá pra atendente saber as opções. Por enquanto a massa fica registrada nas Observações do pedido — futuro vai virar passo do stepper.",
          },
        ],
      },
      {
        id: "clientes",
        title: "Lista de clientes",
        icon: "Contact",
        description: "Banco de clientes que voltam sempre.",
        topics: [
          {
            title: "Cliente é salvo sozinho",
            body: "Quando o atendente coloca o telefone do cliente no pedido, o app cria o cliente automaticamente. Da próxima vez, conta como mesmo cliente.",
          },
          {
            title: "Procurar e ver histórico",
            body: "Busca por nome ou telefone. Abre uma janela com: quantos pedidos já fez, quanto gastou no total, e a lista de cada pedido.",
          },
          {
            title: "Cliente aceita receber promo?",
            body: "Tem uma caixinha 'Aceita receber novidades?' no atendimento. Se cliente marcar, ele entra na lista de quem pode receber promoção por WhatsApp.",
          },
          {
            title: "Mandar promo pra muitos clientes",
            body: "Pra mandar promoção pra todo mundo da lista, o app abre o WhatsApp 1 cliente por vez (pro WhatsApp não bloquear). Você confirma cada um.",
          },
        ],
      },
      {
        id: "pedidos",
        title: "Pedidos antigos",
        icon: "History",
        description: "Buscar qualquer pedido já feito (dentro de Vendas → aba 'Pedidos').",
        topics: [
          {
            title: "Como abrir",
            body: "Vai em Vendas no menu, depois clica na aba 'Pedidos' lá em cima. 'Resumo' é números, 'Pedidos' é a lista de cada um.",
          },
          {
            title: "Filtrar por período",
            body: "Botões 'Hoje', 'Ontem', '7 dias' ou 'Tudo'. Pode também filtrar por uma festa específica.",
          },
          {
            title: "Buscar por nome ou número",
            body: "Caixa de busca: digita nome do cliente, telefone ou número do pedido (#042). Mostra todos que batem.",
          },
          {
            title: "Carregar mais",
            body: "Mostra 50 pedidos por vez. Botão 'Ver mais' embaixo carrega o próximo lote. Evita travar quando tem muito pedido.",
          },
        ],
      },
      {
        id: "promocoes",
        title: "Promoções",
        icon: "Tag",
        description: "Desconto automático no checkout.",
        topics: [
          {
            title: "Tipos de promoção",
            body: "Pode ser desconto em reais (-R$ 5), em porcentagem (-10%) ou compra-leva (3 e leva 4). Coloca a data de início e fim, e quantas vezes pode ser usada.",
          },
          {
            title: "Aplicar no atendimento",
            body: "Atendente escolhe a promoção no carrinho do cliente. App confere se é válida (data, condições) e desconta. Comprovante mostra subtotal, desconto e total final.",
          },
        ],
      },
      {
        id: "usuarios",
        title: "Funcionários",
        icon: "Users",
        description: "Cadastrar atendentes, cozinheiros e admins.",
        topics: [
          {
            title: "Adicionar funcionário",
            body: "Botão 'Novo usuário'. Bota o nome, escolhe o papel (Atendente, Cozinha ou Admin) e cria uma senha de 4 números pra ela. Pronto, ela já pode entrar.",
            rules: [
              "Duas pessoas do mesmo papel NÃO podem ter a mesma senha. Tipo: dois atendentes não podem ter senha '1234'.",
              "Mas um atendente e um admin podem ter '1234' os dois (papéis diferentes não conflitam).",
            ],
          },
          {
            title: "Mudar ou desativar",
            body: "Edita o nome, papel ou senha. O botão 'Ativo' desliga ela do login sem apagar — útil pra funcionário que saiu mas pode voltar.",
          },
        ],
      },
      {
        id: "pix",
        title: "Pagamento PIX no comprovante",
        icon: "QrCode",
        description: "Configurar sua chave pra QR Code sair no recibo.",
        topics: [
          {
            title: "Cadastrar a chave",
            body: "Vai em Caixa → 'Pagamento (PIX)'. Coloca sua chave (CPF/CNPJ, email ou celular), nome do recebedor (igual o cadastrado na sua conta) e cidade. Salva.",
            rules: [
              "Só configura 1 vez. Depois fica salvo pros próximos eventos.",
              "Nome e cidade têm que bater EXATO com seu cadastro do banco — senão o PIX recusa.",
            ],
          },
          {
            title: "Como aparece pro cliente",
            body: "Na tela do comprovante de cada pedido, abaixo do total, aparece um QR Code com o valor do pedido já preenchido. Cliente abre o banco dele, escaneia e paga em segundos. Tem botão 'Copiar código' pra quem prefere colar.",
            tips: [
              "Sem chave configurada, QR não aparece — só o comprovante normal.",
              "O TXID é PDG + número do pedido (ex: PDG042) — fica fácil de identificar no extrato.",
            ],
          },
        ],
      },
      {
        id: "monitor",
        title: "Monitor (KPIs ao vivo no celular)",
        icon: "Monitor",
        description: "Tela rapidona pra acompanhar a festa de longe.",
        topics: [
          {
            title: "Pra que serve",
            body: "Em festa cheia você quer dar uma olhada no faturamento sem mexer no tablet da barraca. Abre /admin/monitor no seu celular pessoal — fundo escuro, 4 números gigantes: Receita, Pedidos, Ticket médio, Preparo médio. Atualiza sozinho.",
            tips: [
              "Link rápido no AppHeader mobile (ícone monitor) ou no rodapé da sidebar do admin desktop.",
            ],
          },
          {
            title: "Lista ao vivo embaixo",
            body: "Embaixo dos KPIs tem as listas 'Em preparo' e 'Novos', ordenadas por urgência (mais antigo primeiro). Pedido em preparo há mais de 15 min ganha anel vermelho.",
          },
        ],
      },
      {
        id: "danger-zone",
        title: "Zona de Perigo (apagar tudo)",
        icon: "ShieldOff",
        description: "Recomeçar do zero entre eventos. CUIDADO.",
        topics: [
          {
            title: "Onde fica",
            body: "Escondido no FIM da aba 'Usuários'. Rola até embaixo, aparece 'Zona de Perigo' em vermelho discreto. Clica pra expandir e ver as contagens do que vai sumir.",
            rules: [
              "NÃO clica por curiosidade na hora da festa. É pra usar quando vai começar evento novo do zero.",
              "Expandir só mostra as contagens — não apaga nada.",
            ],
          },
          {
            title: "O que apaga e o que mantém",
            body: "APAGA: pedidos, items, eventos de caixa antigos, logs de aviso. MANTÉM: cardápio completo (produtos + ingredientes + preços), usuários (Gil, atendentes, cozinha), base de clientes do CRM, sua chave PIX, promoções cadastradas.",
            tips: [
              "Use entre eventos pra zerar histórico sem perder cardápio nem PIX.",
            ],
          },
          {
            title: "Como apagar (passo-a-passo)",
            body: "1) Expande Zona de Perigo. 2) Confere as contagens. 3) Espera 3 segundos (botão fica disabled). 4) Clica 'Apagar tudo isso'. 5) Modal abre pedindo pra digitar a frase. 6) Digita LITERAL: APAGAR TUDO NA COZINHA DA GIL (tudo maiúsculo, sem ponto, sem acento). 7) Botão vermelho 'Apagar permanentemente' libera. Clica.",
            rules: [
              "Se digitar errado (faltou letra, errou acento), o botão fica disabled. Não dá pra apagar por acidente.",
              "Servidor confere a frase de novo — mesmo se alguém forçar o botão pelo browser, falha.",
            ],
          },
          {
            title: "Backup automático antes",
            body: "Antes de apagar, o app salva uma cópia do banco em /app/data/backups/wipe-DATA-HORA.db. Se você apagou por engano, chama o Claude (ou quem cuida) pra restaurar via cp do arquivo. NADA é perdido permanentemente.",
            tips: [
              "Se o backup falhar por qualquer motivo, a operação ABORTA sem apagar. Mais seguro errar pelo lado da preservação.",
            ],
          },
          {
            title: "Depois de apagar",
            body: "Aparece resumo: 'X pedidos, Y items, Z eventos apagados' + caminho do backup. Atendente passa a ver fila vazia. Você pode abrir caixa novo agora.",
          },
        ],
      },
    ],
  },
];

// ============================================================
//   O QUE O APP FAZ SOZINHO (regras automáticas — sem jargão)
// ============================================================
export const RULES = [
  {
    title: "Cliente é cadastrado sozinho",
    body: "Quando atendente põe o telefone do cliente no pedido, ele entra automaticamente na lista de clientes. Da próxima vez é reconhecido — sem precisar cadastrar de novo.",
  },
  {
    title: "Pedido duplicado é bloqueado",
    body: "Se Maria clica 'Confirmar' duas vezes sem querer (porque o wifi travou), o app pergunta 'É outro pedido mesmo?' antes de mandar igual pra cozinha.",
  },
  {
    title: "Caixa fechado trava pedidos",
    body: "Sem caixa aberto, atendente não consegue fazer pedido novo. Aparece banner vermelho explicando — chama a Gil pra abrir.",
  },
  {
    title: "Quem pode cancelar o quê",
    body: "Atendente cancela pedido que ainda não saiu OU que tá esperando cliente. Quando a cozinha já começou a fazer, só cozinha ou Gil pode cancelar — pra todo mundo combinar.",
  },
  {
    title: "Pedido que travou volta sozinho",
    body: "Se o wifi caiu na hora de mandar o pedido e você apertou de novo, o app é esperto: reconhece que é o mesmo e não duplica.",
  },
  {
    title: "Telefone padronizado",
    body: "Você digita '(11) 99999-9999' do jeito normal. O app guarda no formato que o WhatsApp entende e formata bonito quando mostra.",
  },
  {
    title: "Cliente ganha link de acompanhamento",
    body: "Sempre que cria pedido, sai um link único tipo /p/abc7x9k2. Já entra na mensagem do WhatsApp. Cliente abre no celular e vê status ao vivo sem precisar perguntar 'tá pronto?'.",
  },
  {
    title: "Backup automático do banco diariamente",
    body: "Toda madrugada o app salva uma cópia completa do banco em /app/data/backups/. Mantém os últimos 14 dias. Se um dia algo der MUITO errado, a Cozinha consegue voltar ao estado de ontem.",
  },
  {
    title: "Comprovante mostra PIX se configurou",
    body: "Se você cadastrou chave PIX em Caixa, todo comprovante automaticamente gera o QR Code do valor exato. Cliente escaneia e paga em 1 toque.",
  },
];
