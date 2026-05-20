/**
 * Tradução de termos comuns PT→EN pra busca de ícones na Iconify.
 * A API só busca em inglês — esse mapping cobre os ingredientes mais
 * usados na cozinha brasileira (e do contexto pastel/lanche em
 * particular). Para termos não cobertos, devolve o original.
 *
 * Match é case-insensitive e acent-insensitive (normaliza pra ASCII).
 */

const DICT: Record<string, string> = {
  // === Carnes ===
  frango: "chicken",
  carne: "meat",
  "carne moida": "ground meat",
  picanha: "steak",
  bacon: "bacon",
  presunto: "ham",
  calabresa: "sausage",
  linguica: "sausage",
  peru: "turkey",
  peixe: "fish",
  atum: "tuna",
  camarao: "shrimp",
  costela: "ribs",
  hamburguer: "burger",

  // === Queijos / lácteos ===
  queijo: "cheese",
  catupiry: "cheese",
  cheddar: "cheese",
  mussarela: "mozzarella",
  parmesao: "parmesan",
  ricota: "ricotta",
  leite: "milk",
  "leite condensado": "condensed milk",
  creme: "cream",
  "creme de leite": "cream",
  manteiga: "butter",
  requeijao: "cream cheese",
  iogurte: "yogurt",

  // === Vegetais / legumes ===
  tomate: "tomato",
  cebola: "onion",
  "cebola caramelizada": "onion",
  alho: "garlic",
  milho: "corn",
  azeitona: "olive",
  pimentao: "bell pepper",
  pimenta: "chili pepper",
  alface: "lettuce",
  rucula: "arugula",
  espinafre: "spinach",
  brocolis: "broccoli",
  couveflor: "cauliflower",
  cenoura: "carrot",
  batata: "potato",
  "batata palha": "potato",
  "batata frita": "french fries",
  abobrinha: "zucchini",
  berinjela: "eggplant",
  couve: "kale",
  pepino: "cucumber",
  cogumelo: "mushroom",
  champignon: "mushroom",
  palmito: "heart of palm",
  ervilha: "peas",

  // === Frutas ===
  banana: "banana",
  maca: "apple",
  abacaxi: "pineapple",
  morango: "strawberry",
  uva: "grape",
  laranja: "orange",
  limao: "lemon",
  manga: "mango",
  melancia: "watermelon",
  melao: "melon",
  coco: "coconut",
  goiaba: "guava",
  caju: "cashew",
  acai: "acai berry",
  abacate: "avocado",
  pera: "pear",
  pessego: "peach",
  kiwi: "kiwi",
  framboesa: "raspberry",
  amora: "blackberry",
  mirtilo: "blueberry",
  cereja: "cherry",

  // === Doces ===
  chocolate: "chocolate",
  "doce de leite": "caramel",
  brigadeiro: "chocolate truffle",
  beijinho: "coconut candy",
  acucar: "sugar",
  mel: "honey",
  geleia: "jam",
  sorvete: "ice cream",
  bolo: "cake",
  torta: "pie",
  biscoito: "cookie",
  pao: "bread",
  "pao de queijo": "cheese bread",
  baunilha: "vanilla",
  canela: "cinnamon",
  nutella: "chocolate spread",

  // === Bebidas ===
  cafe: "coffee",
  cha: "tea",
  suco: "juice",
  agua: "water",
  refrigerante: "soda",
  "coca cola": "cola",
  "coca-cola": "cola",
  guarana: "soda",
  cerveja: "beer",
  vinho: "wine",
  caipirinha: "cocktail",
  drink: "cocktail",

  // === Molhos / temperos ===
  molho: "sauce",
  "molho de tomate": "tomato sauce",
  ketchup: "ketchup",
  maionese: "mayonnaise",
  mostarda: "mustard",
  barbecue: "barbecue",
  bbq: "barbecue",
  rose: "sauce",
  bolonhesa: "pasta sauce",
  branco: "white sauce",
  pesto: "pesto",
  sal: "salt",
  ervas: "herbs",
  manjericao: "basil",
  salsa: "parsley",
  salsinha: "parsley",
  oregano: "oregano",
  azeite: "olive oil",
  vinagre: "vinegar",
  "azeite de oliva": "olive oil",

  // === Massas / pratos ===
  macarrao: "noodles",
  espaguete: "spaghetti",
  pizza: "pizza",
  pastel: "pastry",
  sanduiche: "sandwich",
  salgado: "snack",
  lasanha: "lasagna",
  nhoque: "gnocchi",
  arroz: "rice",
  feijao: "beans",

  // === Ovos ===
  ovo: "egg",
  ovos: "eggs",
  omelete: "omelette",

  // === Diversos ===
  azeitonas: "olives",
  amendoim: "peanut",
  nozes: "walnut",
  castanha: "chestnut",
  amendoa: "almond",
  paçoca: "peanut candy",

  // === Categorias (pros chips de sugestão) ===
  carnes: "meat",
  queijos: "cheese",
  vegetais: "vegetable",
  legumes: "vegetable",
  frutas: "fruit",
  doces: "dessert",
  sobremesas: "dessert",
  bebidas: "drink",
  molhos: "sauce",
  massas: "pasta",
  paes: "bread",
  laticinios: "dairy",
};

/** Remove acentos e baixa pra lowercase pra match resiliente. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Traduz um termo de busca PT→EN. Retorna { translated, source }
 * com `source: "dict"` se traduziu, ou `source: "original"` se manteve
 * (não estava no dicionário ou já era inglês).
 *
 * Suporta múltiplas palavras: tenta a frase inteira primeiro, senão
 * traduz palavra por palavra.
 */
export function translateForIconSearch(raw: string): {
  translated: string;
  source: "dict" | "original";
} {
  const norm = normalize(raw);
  if (!norm) return { translated: raw, source: "original" };

  // Tentar frase inteira (ex: "molho de tomate")
  if (DICT[norm]) {
    return { translated: DICT[norm], source: "dict" };
  }

  // Senão, traduz palavra por palavra (mantém as não-mapeadas)
  const words = norm.split(/\s+/);
  let touched = false;
  const out = words.map((w) => {
    if (DICT[w]) {
      touched = true;
      return DICT[w];
    }
    return w;
  });
  if (touched) return { translated: out.join(" "), source: "dict" };

  return { translated: raw, source: "original" };
}

/**
 * Categorias rápidas com termo de busca em inglês — usado pelos chips
 * de sugestão no IconPicker, pra Gil clicar e ver opções comuns.
 */
export const ICON_CATEGORIES: Array<{ label: string; query: string }> = [
  { label: "Carnes", query: "meat" },
  { label: "Queijos", query: "cheese" },
  { label: "Vegetais", query: "vegetable" },
  { label: "Frutas", query: "fruit" },
  { label: "Doces", query: "dessert" },
  { label: "Bebidas", query: "drink" },
  { label: "Molhos", query: "sauce" },
  { label: "Massas", query: "noodles" },
];
