import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// PINs únicos por role — backend identifica o user pelo {role + PIN} sem
// precisar de pills de seleção. Restrição: 2 users do mesmo role NÃO podem
// ter o mesmo PIN (validado em app/api/users + create/update routes).
// Entre roles diferentes pode repetir sem problema (cada role tem seu próprio
// search space). Conferir comentário do auth/login route pra detalhes.
//
// Seed cria APENAS a conta admin (Gil) — atendentes e cozinheiros são criados
// pelo Admin → Usuários no app, com PINs próprios escolhidos por ela. Evita
// confusão de "PINs default expostos em código" e dá controle total.
//
// PIN do Gil: 2699 — definido pela Gil. Trocar no Admin → Usuários se mudar.
const DEFAULT_USERS = [
  { name: "Gil", role: "admin", password: "2699" },
];

type Seed = { name: string; available?: boolean };

const INGREDIENTS: Record<string, Seed[]> = {
  topping: [
    { name: "Carne" },
    { name: "Calabresa" },
    { name: "Frango" },
    { name: "Bacon" },
    { name: "Presunto" },
    { name: "Queijo" },
    { name: "Catupiry" },
    { name: "Milho" },
    { name: "Cebola" },
    { name: "Cebola caramelizada" },
    { name: "Azeitona" },
    { name: "Batata palha" },
    // Atualização cardápio 06/06: Carne desfiada vai no Pastel Churrasqueiro;
    // disponível como topping pra montagem custom também.
    { name: "Carne desfiada" },
  ],
  doce: [
    { name: "Banana com chocolate" },
    { name: "Goiaba com queijo" },
    { name: "Doce de leite" },
  ],
  molho: [
    { name: "Verde" },
    { name: "Rosé" },
    { name: "Mostarda" },
    // Atualização cardápio 06/06: Barbecue acompanha Pastel Churrasqueiro;
    // disponível como molho extra também.
    { name: "Barbecue" },
  ],
  // Atualização cardápio julho/2026: Gil parou de vender macarrão.
  // Categorias macarrao_topping, macarrao_molho e macarrao_massa removidas.
  // Pedidos históricos com esses ingredientes ficam íntegros (snapshot no
  // OrderItem sobrevive), só somem do Cardápio ativo.
};

// === Produtos Fase 6 ===
type SizeSeed = { name: string; description?: string; priceCents: number };
type ProductSeed = {
  name: string;
  type: string;
  pricingMode: "fixed" | "by_size";
  basePriceCents?: number;
  allowsIngredients?: boolean;
  ingredientCategory?: string;
  maxIngredients?: number | null;
  minIngredients?: number | null;
  allowsSauces?: boolean;
  sauceCategory?: string;
  sizes?: SizeSeed[];
  position?: number;
};

const PRODUCTS: ProductSeed[] = [
  // --- Pastel salgado: 2 tamanhos com regras diferentes ---
  // Atualização cardápio 06/06: Pequeno 1500→1000, Grande 2000→1500.
  {
    name: "Pastel Salgado",
    type: "salgado",
    pricingMode: "by_size",
    allowsIngredients: true,
    ingredientCategory: "topping",
    allowsSauces: true,
    sauceCategory: "molho",
    position: 0,
    sizes: [
      { name: "Pequeno", description: "Até 2 ingredientes", priceCents: 1000 },
      { name: "Grande", description: "Monte o seu", priceCents: 1500 },
    ],
  },
  // --- Pastel doce: 1 sabor único ---
  {
    name: "Pastel Doce",
    type: "doce",
    pricingMode: "by_size",
    allowsIngredients: true,
    ingredientCategory: "doce",
    minIngredients: 1,
    maxIngredients: 1,
    allowsSauces: false,
    position: 1,
    sizes: [
      { name: "Normal", description: "1 unidade", priceCents: 1500 },
      { name: "Mini Pack", description: "10 unidades", priceCents: 3000 },
    ],
  },
  // Macarrão removido (julho/2026) — Gil parou de vender.
  // --- Pastel Churrasqueiro: combo pré-montado, sem escolha (06/06/2026) ---
  // Carne desfiada + Queijo + Molho barbecue já vem assumidos; atendente
  // não monta. Modelado como type "salgado" fixed pra render igual aos
  // outros pastéis na listagem, mas sem ingredientes/molhos opcionais.
  {
    name: "Pastel Churrasqueiro",
    type: "salgado",
    pricingMode: "fixed",
    basePriceCents: 2000,
    allowsIngredients: false,
    allowsSauces: false,
    position: 3,
  },
  // --- Tortas: produtos fixos sem montagem (06/06/2026) ---
  {
    name: "Torta de Frango",
    type: "salgado",
    pricingMode: "fixed",
    basePriceCents: 1500,
    allowsIngredients: false,
    allowsSauces: false,
    position: 4,
  },
  {
    name: "Torta de Alho Poró e Bacon",
    type: "salgado",
    pricingMode: "fixed",
    basePriceCents: 1500,
    allowsIngredients: false,
    allowsSauces: false,
    position: 5,
  },
  // --- Coxinha: produto fixo, sem tamanho, sem recheio (julho/2026) ---
  // Gil vende só um tipo, tudo já pronto. Atendente toca 1 vez e pronto.
  {
    name: "Coxinha",
    type: "salgado",
    pricingMode: "fixed",
    basePriceCents: 1000,
    allowsIngredients: false,
    allowsSauces: false,
    position: 6,
  },
  // --- Bebidas: cada uma é um Product, preço fixo, sem ingredientes ---
  {
    name: "Coca-Cola Lata",
    type: "bebida",
    pricingMode: "fixed",
    basePriceCents: 600,
    position: 10,
  },
  // Atualização cardápio 06/06.
  {
    name: "Guaraná Antártica Lata",
    type: "bebida",
    pricingMode: "fixed",
    basePriceCents: 600,
    position: 11,
  },
  {
    name: "Suco",
    type: "bebida",
    pricingMode: "fixed",
    basePriceCents: 500,
    position: 12,
  },
  {
    name: "Água",
    type: "bebida",
    pricingMode: "fixed",
    basePriceCents: 400,
    position: 13,
  },
  // --- Combo 4 sabores: preço fixo, exige exatamente 4 sabores (toppings de salgado) ---
  {
    name: "Combo 4 Sabores",
    type: "combo",
    pricingMode: "fixed",
    basePriceCents: 5000,
    allowsIngredients: true,
    ingredientCategory: "topping",
    minIngredients: 4,
    maxIngredients: 4,
    allowsSauces: true,
    sauceCategory: "molho",
    position: 20,
  },
];

async function main() {
  // 1. Ingredients
  for (const [category, items] of Object.entries(INGREDIENTS)) {
    for (let i = 0; i < items.length; i++) {
      const { name, available = true } = items[i];
      await prisma.ingredient.upsert({
        where: { category_name: { category, name } },
        update: { position: i, available },
        create: { category, name, position: i, available },
      });
    }
  }
  const ingCount = await prisma.ingredient.count();
  console.log(
    `✓ Ingredientes: ${ingCount} (${INGREDIENTS.topping.length} pastel toppings + ${INGREDIENTS.doce.length} doces + ${INGREDIENTS.molho.length} molhos + ${INGREDIENTS.macarrao_topping.length} macarrão toppings + ${INGREDIENTS.macarrao_molho.length} macarrão molhos).`,
  );

  // 2. Produtos
  for (const p of PRODUCTS) {
    const { sizes, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { name_type: { name: p.name, type: p.type } },
      update: productData,
      create: productData,
    });
    if (sizes && sizes.length > 0) {
      for (let i = 0; i < sizes.length; i++) {
        const s = sizes[i];
        await prisma.productSize.upsert({
          where: { productId_name: { productId: product.id, name: s.name } },
          update: { description: s.description, priceCents: s.priceCents, position: i },
          create: {
            productId: product.id,
            name: s.name,
            description: s.description,
            priceCents: s.priceCents,
            position: i,
          },
        });
      }
    }
  }
  const prodCount = await prisma.product.count();
  const sizeCount = await prisma.productSize.count();
  console.log(`✓ Produtos: ${prodCount} (${sizeCount} tamanhos).`);

  // 3. Users — só cria se não existe (não sobrescreve senha existente).
  // Cada usuário tem PIN próprio — necessário porque o login identifica
  // pelo {role + PIN} sem pedir nome.
  let created = 0;
  const createdLog: string[] = [];
  for (const u of DEFAULT_USERS) {
    const existing = await prisma.user.findUnique({ where: { name: u.name } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: { name: u.name, role: u.role, passwordHash },
      });
      created++;
      createdLog.push(`${u.name} (${u.role}, PIN ${u.password})`);
    }
  }
  const usersCount = await prisma.user.count();
  console.log(`✓ Usuários: ${usersCount} total, ${created} criados agora.`);
  if (createdLog.length > 0) {
    console.log(`  ${createdLog.join("  ·  ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
