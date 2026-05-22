/**
 * Conteúdo do Guia do Usuário.
 *
 * Estruturado como data (não JSX) pra facilitar manutenção, busca, e
 * potencial tradução futura. Cada seção tem múltiplos tópicos com
 * corpo + dicas opcionais + regras opcionais.
 *
 * Mantido próximo ao código pra atualizar junto com features novas.
 */

export type GuideTopic = {
  title: string;
  body: string;
  /** Dicas práticas — bullets em cinza menor, ícone lâmpada */
  tips?: string[];
  /** Regras/limites — bullets em laranja, ícone aviso */
  rules?: string[];
};

export type GuideSection = {
  id: string;
  title: string;
  /** Lucide icon name (string) — mapeado em GuiaClient pra evitar import circular */
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
  //   GERAL — funcionalidades comuns a todos os papéis
  // ============================================================
  {
    id: "geral",
    label: "Geral",
    icon: "Sparkles",
    sections: [
      {
        id: "login",
        title: "Login com PIN",
        icon: "KeyRound",
        description: "Como entrar no app e trocar de operador.",
        topics: [
          {
            title: "Como entrar",
            body: "Na tela inicial, escolha o papel (Atendente, Cozinha ou Admin) e digite seu PIN de 4 dígitos. Não precisa selecionar nome — o servidor identifica você pelo PIN + papel.",
            tips: [
              "O PIN é único dentro do papel. Dois atendentes não podem ter o mesmo PIN.",
              "Errou? O campo treme e pode tentar de novo.",
              "Após o 4º dígito, o login dispara automaticamente.",
            ],
          },
          {
            title: "Trocar de operador",
            body: "No header, clique na pílula com seu nome (ícone do papel + nome). Confirme a saída e a tela volta pra seleção de papel.",
            tips: [
              "Em tablet compartilhado, sempre troque ao passar pra outra pessoa — pedidos ficam atribuídos a quem criou.",
              "O nome do operador aparece em todos os pedidos pra rastreabilidade.",
            ],
          },
          {
            title: "Auto-logout por inatividade",
            body: "Após 30 minutos sem toque, o app desloga automaticamente — evita que tablet esquecido fique aberto.",
            rules: [
              "Pausa durante criação de pedido (atendente conversando com cliente em pé).",
            ],
          },
        ],
      },
      {
        id: "pwa",
        title: "Instalar como app no celular",
        icon: "Smartphone",
        description: "Pra rodar em tela cheia sem barra do navegador.",
        topics: [
          {
            title: "iOS (Safari)",
            body: "Abra cozinhadagil.evapro.cloud no Safari. Toque no botão Compartilhar (quadrado com seta pra cima) → 'Adicionar à Tela de Início'. O ícone aparece na home como app nativo.",
            rules: [
              "Funciona só no Safari. Chrome iOS não suporta PWA standalone.",
            ],
          },
          {
            title: "Android (Chrome)",
            body: "Abra o site no Chrome. Aparece um banner 'Adicionar à tela inicial' — toque pra confirmar. Ou abra o menu (3 pontinhos) → 'Instalar app'.",
          },
          {
            title: "Atualizar o app",
            body: "O app atualiza sozinho quando você abre, desde que tenha internet. Sem precisar reinstalar.",
            tips: [
              "Se ficar travado em versão antiga, force-quit no app e reabra.",
            ],
          },
        ],
      },
      {
        id: "conexao",
        title: "Conexão e sincronia",
        icon: "Wifi",
        description: "Como o app conversa com o servidor em tempo real.",
        topics: [
          {
            title: "Sincronia em tempo real (SSE)",
            body: "Pedidos novos, alterações e status aparecem em todas as telas em ~1 segundo, sem refresh. Atendente cria pedido → cozinha vê na hora.",
          },
          {
            title: "Indicador 'Sem conexão'",
            body: "Quando o servidor cai ou a internet some, aparece pill vermelho 'Sem conexão' no header. O app continua mostrando o último estado conhecido.",
            rules: [
              "Ações que precisam de servidor (criar pedido, avançar status) falham com erro claro.",
              "Quando volta a conexão, o app reconecta sozinho e sincroniza.",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   ATENDENTE — fluxo de pedido + fila
  // ============================================================
  {
    id: "atendente",
    label: "Atendente",
    icon: "ClipboardList",
    sections: [
      {
        id: "novo-pedido",
        title: "Criar pedido novo",
        icon: "Plus",
        description: "Stepper passo-a-passo: cliente → produto → confirma.",
        topics: [
          {
            title: "1. Cliente",
            body: "Nome obrigatório (pode ser 'Mesa 5' ou 'Balcão'). Telefone opcional — se informado, libera 'Avisar cliente via WhatsApp' depois.",
            tips: [
              "Atalho 'Atendimento rápido' pula essa tela com nome vazio (cliente anônimo).",
              "Telefone com DDD: (11) 99999-9999 — máscara automática.",
            ],
          },
          {
            title: "2. Produto",
            body: "Escolha entre Salgado, Doce, Bebida, Macarrão ou Combo. Cada produto pode ter tamanhos (Pequeno, Grande, Normal, Mini Pack).",
            tips: [
              "Bebidas vão direto pro PRONTO (não passam pela cozinha).",
            ],
          },
          {
            title: "3. Ingredientes",
            body: "Toque pra selecionar/desmarcar. Limite varia por produto (ex: Pequeno aceita até 2 toppings). Botão 'Marcar todos' acelera quando cliente pediu 'tudo'.",
            rules: [
              "Ingredientes com estoque zero aparecem riscados (não dá pra selecionar).",
              "Com estoque baixo, aparece badge ⚠ amarelo pra avisar.",
            ],
          },
          {
            title: "4. Molhos",
            body: "Cada molho extra tem preço (R$ 1,50 padrão). 'Nenhum molho' é grátis e selecionado por padrão.",
          },
          {
            title: "5. Quantidade",
            body: "Quantos pastéis iguais? Default 1, máximo 20. Cozinha recebe a quantidade pra preparar (3 pastéis iguais = 3 unidades).",
          },
          {
            title: "6. Observações",
            body: "Chips rápidos pra modificadores comuns: 'sem cebola', 'bem dourado', etc. Negativos ('sem X') aparecem em vermelho na cozinha. Campo livre embaixo pra outras observações.",
            tips: [
              "Cada chip toca pra ativar (laranja) ou desativar.",
              "Texto digitado fica abaixo dos chips, separado por vírgula.",
            ],
          },
          {
            title: "7. Cart e confirmar",
            body: "Revisa items no carrinho. Pode editar inline (lápis), aumentar/diminuir quantidade, duplicar, ou remover (X). Botão grande 'Confirmar pedido' envia pra cozinha.",
            rules: [
              "Caixa fechado bloqueia confirmar — banner vermelho avisa.",
              "Se internet falhar e você clicar de novo, sistema detecta possível duplicata e pergunta antes de enviar.",
            ],
          },
        ],
      },
      {
        id: "fila",
        title: "Fila de pedidos",
        icon: "ListOrdered",
        description: "Acompanhe e gerencie pedidos ativos.",
        topics: [
          {
            title: "Filtros por status",
            body: "Chips no topo: PEDIDO_FEITO (aguardando preparo), EM_PREPARO (cozinha fazendo), PRONTO (esperando cliente), ENTREGUE, CANCELADO. Contagem em cada chip.",
            tips: [
              "Default é PRONTO — atendente foca em quem precisa retirar.",
            ],
          },
          {
            title: "Editar pedido",
            body: "Botão 'Editar' aparece em PEDIDO_FEITO e EM_PREPARO. Abre o stepper pré-preenchido. Salvar atualiza e cozinha recebe alerta vermelho 'Atendente alterou'.",
            rules: [
              "Após PRONTO, não dá mais pra editar.",
            ],
          },
          {
            title: "Remover item específico",
            body: "Botão X em cada linha do pedido (cards com 2+ items). Confirma e remove só aquele item. Toast com 'Desfazer' por 6s pra reverter.",
            rules: [
              "Se sobrar 1 item, o X some — use 'Cancelar pedido' inteiro.",
            ],
          },
          {
            title: "Cancelar pedido",
            body: "Botão 'Cancelar' em PEDIDO_FEITO. Diálogo pede motivo (preset 'Cliente foi embora', 'Ingrediente acabou', 'Erro no pedido', 'Cliente desistiu', ou texto livre).",
            rules: [
              "Em EM_PREPARO, só cozinha ou admin pode cancelar (regra força comunicação).",
            ],
          },
          {
            title: "'Cliente sumiu'",
            body: "Botão em pedidos PRONTO quando cliente não voltou pra buscar. Abre o mesmo diálogo de cancelamento com motivo 'Cliente foi embora' como preset.",
          },
          {
            title: "Avisar cliente via WhatsApp",
            body: "Botão 'Avisar' em PRONTO quando há telefone. Abre WhatsApp com mensagem pré-formatada. Após 5min sem resposta, vira 'Avisar de novo' (laranja).",
            tips: [
              "Badge 'Avisado · há X min' mostra quando foi avisado.",
              "Cada clique cria um log no CRM do cliente.",
            ],
          },
          {
            title: "Banner caixa órfão",
            body: "Se o caixa tá aberto há mais de 12h, banner amarelo no topo avisa. Provavelmente Gil esqueceu de fechar — pedidos novos vão pro caixa errado.",
            tips: [
              "Pode dispensar (X) se for festa overnight legítima.",
              "Ou peça pro admin fechar e abrir novo caixa.",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   COZINHA — fluxo de preparo + atalhos
  // ============================================================
  {
    id: "cozinha",
    label: "Cozinha",
    icon: "CookingPot",
    sections: [
      {
        id: "operacao",
        title: "Operação na cozinha",
        icon: "ChefHat",
        description: "Como receber e processar pedidos.",
        topics: [
          {
            title: "Lista de pedidos ativos",
            body: "Mostra todos os pedidos em PEDIDO_FEITO e EM_PREPARO. PRONTO/ENTREGUE/CANCELADO somem (foco em quem ainda precisa de ação).",
            tips: [
              "Pedido novo chega com flash laranja + ding — chama atenção.",
              "Bebidas não aparecem (atendente entrega direto).",
            ],
          },
          {
            title: "Iniciar preparo",
            body: "Botão 'Iniciar preparo' no card PEDIDO_FEITO. Muda status pra EM_PREPARO e cronômetro começa do zero (preparo). Ring de progresso ao redor mostra tempo restante.",
            rules: [
              "Meta padrão: 20 minutos. Verde → amarelo (10min) → laranja (15min) → vermelho (20min+).",
              "Acima de 20min, card pulsa em vermelho.",
            ],
          },
          {
            title: "Marcar Pronto",
            body: "Botão 'Pronto' no card EM_PREPARO. Card sai da cozinha e vai pra fila do atendente notificar/entregar.",
          },
          {
            title: "Cancelar pedido",
            body: "Diálogo com motivo. Cozinha pode cancelar mid-preparo (ingrediente acabou, queimou, etc).",
          },
          {
            title: "Alerta de alteração",
            body: "Se o atendente edita um pedido enquanto você prepara, o card ganha ring vermelho + label 'Atendente alterou — revise os itens' + ding urgente. Confira antes de seguir.",
          },
          {
            title: "Densidade 2-colunas",
            body: "Pedido com 2+ unidades vira grid 2-col automaticamente (md+) com layout compacto pra caber mais na tela.",
          },
          {
            title: "Observações destacadas",
            body: "Notes 'sem X' (sem cebola, sem alho) aparecem em vermelho com ⚠ pra você ler ANTES de começar. Outras observações em amarelo (preferências).",
          },
        ],
      },
      {
        id: "controles",
        title: "Controles e busca",
        icon: "Search",
        description: "Busca, ordenação e som no bottom-nav.",
        topics: [
          {
            title: "Busca",
            body: "Toque 'Buscar' no bottom-nav. Filtra por nome do cliente ou número do pedido (#042 ou 42).",
            tips: [
              "Atalho teclado: tecle '/' pra abrir/fechar.",
              "Contador 'X de Y' mostra resultados vs total quando filtrando.",
            ],
          },
          {
            title: "Ordenação",
            body: "Toggle entre 'Chegada' (FIFO, mais antigo primeiro) e 'Urgência' (em preparo há mais tempo + com observações primeiro).",
            tips: [
              "Atalho teclado: tecle 'S'.",
              "Preferência salva no aparelho.",
            ],
          },
          {
            title: "Som on/off",
            body: "Toggle. Som ligado: dings em pedidos novos, alarmes escalonados em pedidos atrasados.",
            tips: [
              "Atalho teclado: tecle 'M'.",
            ],
          },
          {
            title: "Alarme escalonado",
            body: "Pedido cruza 10min → ding 'aviso'. 15min → ding 'urgente'. 20min+ → ding urgente + repete a cada 2min até cook agir. Cada nível dispara só 1x (não spam).",
            rules: [
              "Som off no toggle silencia tudo.",
            ],
          },
        ],
      },
      {
        id: "atalhos",
        title: "Atalhos de teclado",
        icon: "Keyboard",
        description: "Pra tablet com teclado bluetooth ou notebook fixo.",
        topics: [
          {
            title: "Lista de atalhos",
            body: "Disponíveis quando não tá digitando em campo de texto:",
            tips: [
              "/ — Buscar pedido",
              "S — Alternar ordenação (chegada ↔ urgência)",
              "M — Ligar/silenciar som",
              "? — Mostrar/esconder esta ajuda",
              "Esc — Fechar busca ou ajuda",
            ],
          },
        ],
      },
    ],
  },

  // ============================================================
  //   ADMIN — gestão completa
  // ============================================================
  {
    id: "admin",
    label: "Admin",
    icon: "ChartBar",
    sections: [
      {
        id: "vendas",
        title: "Vendas e relatórios",
        icon: "TrendingUp",
        description: "KPIs, gráficos, top vendidos e exportação.",
        topics: [
          {
            title: "Períodos",
            body: "Chips no topo: Hoje, Semana, Mês, Personalizado. Tudo reflete o range selecionado — KPIs, gráfico, top vendidos.",
          },
          {
            title: "KPIs principais",
            body: "Faturamento, Pedidos, Ticket médio, Tempo médio de preparo. No PDF, cada KPI mostra delta % vs período anterior equivalente (+12% vs 7d anteriores).",
          },
          {
            title: "Top vendidos",
            body: "Ranking de toppings, sabores e molhos mais vendidos. Coluna 'Receita' mostra quanto cada ingrediente gerou (split share-based por categoria).",
            tips: [
              "Badge 🏆 no #1 quando range não é 'Hoje'.",
            ],
          },
          {
            title: "Exportar CSV",
            body: "Botão baixa CSV com todos os pedidos do período (incluindo cancelados com motivo, atendente, items, preços, telefone). Pra abrir no Excel/Sheets.",
          },
          {
            title: "Exportar PDF",
            body: "Relatório visual completo: capa, KPIs com deltas, resumo financeiro, top vendidos, gráfico por hora/dia, lista de pedidos.",
          },
        ],
      },
      {
        id: "operacao",
        title: "Operação e caixa",
        icon: "Activity",
        description: "Abrir, fechar e listar caixas (sessões).",
        topics: [
          {
            title: "Abrir caixa",
            body: "Botão 'Abrir caixa' com nome do evento (opcional) e data. Cria uma sessão — todos os pedidos novos ficam atribuídos a ela.",
            rules: [
              "Só pode ter 1 caixa aberto por vez.",
              "Caixa fechado bloqueia pedidos novos.",
            ],
          },
          {
            title: "Fechar caixa",
            body: "Botão 'Fechar caixa'. Calcula totalCents da sessão (snapshot). Depois disso, nenhum pedido novo entra nessa sessão.",
          },
          {
            title: "Histórico de caixas",
            body: "Lista todos os caixas anteriores com data, totalCents, quem abriu/fechou. Click pra ver pedidos do caixa + baixar relatório.",
          },
        ],
      },
      {
        id: "cardapio",
        title: "Cardápio",
        icon: "UtensilsCrossed",
        description: "Produtos, ingredientes, estoque.",
        topics: [
          {
            title: "Produtos",
            body: "Crie/edite Salgados, Doces, Bebidas, Macarrão, Combos. Defina preço (fixo ou por tamanho), ingredientes permitidos, molhos, mínimo/máximo de ingredientes.",
            tips: [
              "Imagem opcional (SVG/PNG) — útil pra bebidas com marca.",
              "Toggle 'Disponível' esconde do atendente sem apagar.",
            ],
          },
          {
            title: "Tamanhos (ProductSize)",
            body: "Pra produtos com pricing 'by_size', cadastre nomes (Pequeno, Grande, etc) e preços. Cada tamanho tem seu próprio preço base.",
          },
          {
            title: "Ingredientes",
            body: "Lista por categoria: topping, doce (sabores), molho, macarrao_topping, macarrao_molho, bebida_extra. Cada um com nome, ícone (Iconify), posição, disponível.",
          },
          {
            title: "Estoque com alerta",
            body: "Defina 'Estoque' (quantidade atual) e 'Alerta abaixo de' (threshold). Sistema decrementa automático quando pedido criado. Badge ⚠ 'acabando' no atendente quando ≤ threshold.",
            rules: [
              "Stock vira negativo se admin esquece de atualizar — sinal pra reconciliar.",
              "Quando admin marca 'Acabou bacon', atendente vê chip desabilitado em ~1s (SSE).",
            ],
          },
        ],
      },
      {
        id: "clientes",
        title: "Clientes (CRM)",
        icon: "Contact",
        description: "Banco de clientes recorrentes, broadcast.",
        topics: [
          {
            title: "Auto-upsert",
            body: "Quando cliente faz pedido com telefone, sistema cria/atualiza Customer automaticamente. Total de pedidos e gasto acumulam.",
          },
          {
            title: "Busca e perfil",
            body: "Busca por nome ou telefone. Drawer mostra histórico de pedidos, total gasto, opt-in marketing.",
          },
          {
            title: "Opt-in marketing",
            body: "Checkbox no stepper do atendente (opcional). Cliente concorda em receber promos. Necessário pra entrar em broadcast.",
          },
          {
            title: "Broadcast guiado",
            body: "Pra mandar promo pra N clientes via WhatsApp, sistema abre 1 por vez (limita rate). Cada msg vira BroadcastLog row pra histórico.",
          },
        ],
      },
      {
        id: "historico",
        title: "Histórico de pedidos",
        icon: "History",
        description: "Buscar e filtrar pedidos antigos.",
        topics: [
          {
            title: "Filtros",
            body: "Range (Hoje, Ontem, 7d, Tudo) + filtro por caixa + busca por nome/telefone/número.",
          },
          {
            title: "Paginação",
            body: "50 por vez. Botão 'Ver mais' carrega próximo lote. Evita travar tablet com 600+ pedidos.",
          },
        ],
      },
      {
        id: "promocoes",
        title: "Promoções",
        icon: "Tag",
        description: "Descontos automáticos no checkout.",
        topics: [
          {
            title: "Tipos de promoção",
            body: "Por valor fixo (-R$ X), percentual (-X%), ou compra-leve (X+Y). Datas de validade (de/até). Limite de uso.",
          },
          {
            title: "Aplicação no atendente",
            body: "Atendente seleciona promoção no cart. Sistema valida (data, condições) e aplica desconto. Comprovante mostra subtotal, desconto e total.",
          },
        ],
      },
      {
        id: "usuarios",
        title: "Usuários",
        icon: "Users",
        description: "Criar e gerenciar atendentes, cozinheiros, admins.",
        topics: [
          {
            title: "Criar usuário",
            body: "Botão 'Novo usuário'. Nome, papel (Atendente/Cozinha/Admin), PIN de 4 dígitos. PIN é hash bcrypt no banco.",
            rules: [
              "PIN é único POR PAPEL. Dois atendentes não podem ter o mesmo PIN. Dois admins não podem ter o mesmo PIN.",
              "Mas um atendente E um admin podem ter PINs iguais (papéis diferentes).",
            ],
          },
          {
            title: "Editar/desativar",
            body: "Edit muda nome, papel ou PIN. Toggle ativo/inativo esconde do login sem apagar.",
          },
        ],
      },
    ],
  },
];

// ============================================================
//   REGRAS DE NEGÓCIO (resumo global)
// ============================================================
export const RULES = [
  {
    title: "Transições de status",
    body: "PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE. CANCELADO pode partir de PEDIDO_FEITO, EM_PREPARO ou PRONTO. ENTREGUE e CANCELADO são terminais (sem volta).",
  },
  {
    title: "Quem pode cancelar",
    body: "Atendente: PEDIDO_FEITO e PRONTO ('Cliente sumiu'). Cozinha e Admin: qualquer status ativo. Em EM_PREPARO, atendente bloqueado (força comunicação).",
  },
  {
    title: "Caixa fechado bloqueia tudo",
    body: "Sem caixa aberto, POST /api/orders retorna 423 LOCKED com code: CAIXA_FECHADO. Atendente vê banner vermelho e botão de novo pedido desabilitado.",
  },
  {
    title: "Dedup automático (90s)",
    body: "Se mesmo clientPhone + mesmos items + mesmo total surgem em 90s, sistema bloqueia segundo pedido e pergunta 'É realmente um novo pedido?'. Atendente confirma com 'Sim, é novo'.",
  },
  {
    title: "Idempotency-Key (retry seguro)",
    body: "Cada submissão tem um UUID único. Se rede falhar e atendente tentar de novo, servidor reconhece e devolve o pedido original (sem criar duplicata).",
  },
  {
    title: "Decremento automático de estoque",
    body: "Pedido criado → produtos e ingredientes com stock != null são decrementados pela quantidade usada. Best-effort: se falhar, pedido segue (admin reconcilia depois).",
  },
  {
    title: "Telefone normalizado",
    body: "Salvo como +55XXXXXXXXXXX no banco. Display formata como (11) 99999-9999. WhatsApp deep-link usa o formato +55 direto.",
  },
];
