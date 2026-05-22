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
              "Recheio com ⚠ amarelo = acabando. Ainda dá, mas avisa Gil.",
              "Recheio riscado = acabou mesmo, não dá pra escolher.",
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
        description: "Adicionar produtos, recheios e controlar estoque.",
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
            title: "Estoque com aviso de acabando",
            body: "Marca quanto tem e a partir de quantos é pouco (tipo 'Bacon: tenho 10, avisa quando chegar em 3'). Quando vende, o app desconta sozinho do estoque.",
            rules: [
              "Aparece ⚠ amarelo no atendente quando tá pouco.",
              "Quando zera, aparece riscado e atendente não consegue selecionar.",
              "Você marcou 'Acabou bacon'? Atendente vê em 1 segundo, sem precisar atualizar a tela.",
            ],
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
        id: "historico",
        title: "Pedidos antigos",
        icon: "History",
        description: "Buscar qualquer pedido já feito.",
        topics: [
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
    title: "Estoque desconta sozinho",
    body: "Cliente pediu 2 pastéis de bacon? O app desconta 2 do estoque de bacon automático. Você só precisa atualizar quando comprar mais.",
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
];
