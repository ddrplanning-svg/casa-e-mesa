/*
 * Casa & Mesa — lógica de quantidades, unidades e lista de compras.
 * Sem dependências: funciona no navegador (window.CMCore) e em Node (testes).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CMCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const deaccent = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const EPS = 1e-9;

  /* ---------- Unidades ---------- */
  // Unidades convertíveis: tudo é somado na unidade base (g ou ml).
  const MEASURE = {
    g: ['mass', 1], gr: ['mass', 1], grs: ['mass', 1], grama: ['mass', 1], gramas: ['mass', 1],
    kg: ['mass', 1000], kgs: ['mass', 1000], quilo: ['mass', 1000], quilos: ['mass', 1000], kilo: ['mass', 1000], kilos: ['mass', 1000],
    ml: ['vol', 1], cl: ['vol', 10], dl: ['vol', 100],
    l: ['vol', 1000], lt: ['vol', 1000], litro: ['vol', 1000], litros: ['vol', 1000]
  };
  // Unidades de contagem: [forma canónica singular, plural, inteira na compra?]
  const COUNT = {
    un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', u: 'un',
    colher: 'colher', colheres: 'colher', 'colher de sopa': 'colher', 'colheres de sopa': 'colher', cs: 'colher', 'c sopa': 'colher',
    'colher de cha': 'colher de chá', 'colheres de cha': 'colher de chá', cc: 'colher de chá', 'c cha': 'colher de chá',
    dente: 'dente', dentes: 'dente', lata: 'lata', latas: 'lata', fatia: 'fatia', fatias: 'fatia',
    chavena: 'chávena', chavenas: 'chávena', embalagem: 'embalagem', embalagens: 'embalagem',
    pacote: 'pacote', pacotes: 'pacote', frasco: 'frasco', frascos: 'frasco', molho: 'molho', molhos: 'molho',
    ramo: 'ramo', ramos: 'ramo', folha: 'folha', folhas: 'folha', pitada: 'pitada', pitadas: 'pitada',
    posta: 'posta', postas: 'posta', file: 'filete', filete: 'filete', filetes: 'filete'
  };
  const PLURAL = {
    un: 'un', colher: 'colheres', 'colher de chá': 'colheres de chá', dente: 'dentes', lata: 'latas', fatia: 'fatias',
    'chávena': 'chávenas', embalagem: 'embalagens', pacote: 'pacotes', frasco: 'frascos', molho: 'molhos',
    ramo: 'ramos', folha: 'folhas', pitada: 'pitadas', posta: 'postas', filete: 'filetes'
  };
  // Unidades que se compram inteiras (não se compra meia lata ou meia cebola).
  const WHOLE = new Set(['un', 'lata', 'dente', 'fatia', 'embalagem', 'pacote', 'frasco', 'molho', 'ramo', 'folha', 'posta', 'filete']);

  function unitInfo(rawUnit) {
    const raw = String(rawUnit || '').trim();
    const k = deaccent(raw.toLowerCase()).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    if (!k) return { dim: 'count:un', kind: 'count', unit: 'un' };
    if (MEASURE[k]) return { dim: MEASURE[k][0], kind: MEASURE[k][0], factor: MEASURE[k][1] };
    if (COUNT[k]) return { dim: 'count:' + COUNT[k], kind: 'count', unit: COUNT[k] };
    return { dim: 'other:' + k, kind: 'other', unit: raw };
  }

  /* ---------- Números ---------- */
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  function parseNumber(s) {
    s = String(s).trim();
    if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
    let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
    return Number(s.replace(',', '.'));
  }

  function parseQty(qtyStr) {
    const s = String(qtyStr || '').trim();
    const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*(.*)$/);
    if (!m) return { num: null, raw: s };
    const num = parseNumber(m[1]);
    if (!isFinite(num)) return { num: null, raw: s };
    return { num, unit: unitInfo(m[2]), raw: s };
  }

  /** "300 g | arroz" → { name: 'arroz', qty: {num:300, unit:{...}} } */
  function parseLine(line) {
    line = String(line || '').trim();
    if (!line) return null;
    const i = line.indexOf('|');
    if (i === -1) return { name: line, qty: { num: null, raw: '' } };
    const qty = line.slice(0, i).trim();
    const name = line.slice(i + 1).trim();
    if (!name) return { name: qty, qty: { num: null, raw: '' } };
    return { name, qty: parseQty(qty) };
  }

  const splitLines = text => String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  /* ---------- Nomes de ingredientes ---------- */
  const NAME_ALIASES = {
    courgette: 'curgete', courgete: 'curgete', abobrinha: 'curgete',
    grao: 'grao de bico', 'grao cozido': 'grao de bico cozido',
    'peito de frango': 'frango', 'coxa de frango': 'frango'
  };
  function singular(w) {
    if (w.length <= 3) return w;
    if (/(oes|aes)$/.test(w)) return w.slice(0, -3) + 'ao';
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }
  /** Chave normalizada para agrupar o mesmo produto: "Ovos" e "ovo" → "ovo". */
  function ingredientKey(name) {
    let k = deaccent(String(name).toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
    k = k.split(' ').map(singular).join(' ');
    return NAME_ALIASES[k] || k;
  }

  /* ---------- Categorias da lista de compras ---------- */
  const CATEGORIES = ['Frutas e legumes', 'Talho', 'Peixaria', 'Laticínios e ovos', 'Padaria', 'Mercearia', 'Congelados', 'Outros'];
  const W = list => new RegExp('(^| )(' + list.join('|') + ')( |$)');
  const CATEGORY_RULES = [
    ['Mercearia', W(['leite de coco', 'polpa de tomate', 'tomate pelado', 'concentrado de tomate', 'feijao cozido', 'feijao preto cozido', 'feijao encarnado', 'grao de bico', 'atum', 'sardinha em lata', 'cogumelo em lata', 'milho'])],
    ['Congelados', W(['ervilha', 'congelad[oa]', 'espinafre congelado'])],
    ['Frutas e legumes', W(['batata', 'batata doce', 'cebola', 'alho', 'alho frances', 'tomate', 'cenoura', 'curgete', 'alface', 'limao', 'lima', 'cogumelo', 'espinafre', 'pimento', 'brocolo', 'abobora', 'pepino', 'couve', 'couve flor', 'nabo', 'feijao verde', 'salsa', 'coentro', 'cebolinho', 'manjericao', 'rucula', 'beringela', 'laranja', 'maca', 'pera', 'banana', 'morango', 'uva', 'kiwi', 'gengibre', 'agriao', 'alho porro', 'legume', 'fruta'])],
    ['Talho', W(['frango', 'peru', 'carne', 'carne picada', 'porco', 'vaca', 'novilho', 'vitela', 'bife', 'entrecosto', 'costeleta', 'chourico', 'bacon', 'presunto', 'fiambre', 'salsicha', 'hamburguer', 'lombo', 'coelho', 'borrego', 'pato', 'coxa'])],
    ['Peixaria', W(['salmao', 'bacalhau', 'pescada', 'peixe', 'dourada', 'robalo', 'camarao', 'polvo', 'lula', 'sardinha', 'carapau', 'perca', 'atum fresco', 'marisco', 'choco'])],
    ['Laticínios e ovos', W(['ovo', 'leite', 'queijo', 'iogurte', 'iogurte natural', 'manteiga', 'nata', 'natas', 'requeijao', 'mozzarella', 'ricota'])],
    ['Padaria', W(['pao', 'tosta', 'broa', 'tortilha de trigo', 'wrap', 'baguete'])],
    ['Mercearia', W(['arroz', 'massa', 'esparguete', 'macarrao', 'azeite', 'oleo', 'feijao', 'cuscuz', 'caril', 'sal', 'pimenta', 'farinha', 'acucar', 'lentilha', 'oregao', 'louro', 'vinagre', 'mostarda', 'quinoa', 'aveia', 'caldo', 'molho', 'bolacha', 'cafe', 'cha', 'mel', 'compota', 'cereal', 'grao', 'especiaria', 'colorau', 'cominho', 'noz', 'amendoa', 'passa'])]
  ];
  function categoryOf(name) {
    const k = ingredientKey(name);
    for (const [cat, re] of CATEGORY_RULES) if (re.test(k)) return cat;
    return 'Outros';
  }

  /* ---------- Formatação ---------- */
  const fmtNum = n => {
    const r = Math.round(n * 100) / 100;
    return String(r).replace('.', ',');
  };
  const roundHalf = n => Math.max(0.5, Math.round(n * 2) / 2);

  function formatMeasure(base, kind) {
    const [small, big] = kind === 'mass' ? ['g', 'kg'] : ['ml', 'l'];
    if (base >= 1000 - EPS) return fmtNum(base / 1000) + ' ' + big;
    let v;
    if (base < 10) v = Math.round(base * 10) / 10;
    else if (base < 100) v = Math.round(base);
    else v = Math.round(base / 5) * 5;
    if (v >= 1000) return fmtNum(v / 1000) + ' ' + big;
    return fmtNum(v) + ' ' + small;
  }

  /**
   * Formata uma quantidade. mode 'recipe' arredonda unidades inteiras a 0,5;
   * mode 'shop' arredonda-as para cima (não se compra meia lata).
   */
  function formatAmount(num, unit, mode) {
    if (unit.kind === 'mass' || unit.kind === 'vol') return formatMeasure(num * (unit.factor || 1), unit.kind);
    if (unit.kind === 'count') {
      let n;
      if (WHOLE.has(unit.unit)) n = mode === 'shop' ? Math.max(1, Math.ceil(num - EPS)) : roundHalf(num);
      else n = roundHalf(num);
      const label = n > 1 ? (PLURAL[unit.unit] || unit.unit) : unit.unit;
      return fmtNum(n) + ' ' + label;
    }
    return (fmtNum(num) + ' ' + unit.unit).trim();
  }

  function scaleFactor(servings, people) {
    const s = Number(servings) > 0 ? Number(servings) : 2;
    const p = Number(people) > 0 ? Number(people) : s;
    return p / s;
  }

  /** Ingredientes de uma receita ajustados ao número de pessoas. */
  function scaleRecipe(recipe, people) {
    const f = scaleFactor(recipe.servings, people);
    return splitLines(recipe.ingredients).map(line => {
      const p = parseLine(line);
      if (p.qty.num === null) return { name: p.name, amount: p.qty.raw || '' };
      return { name: p.name, amount: formatAmount(p.qty.num * f, p.qty.unit, 'recipe') };
    });
  }

  /**
   * Agrega ingredientes de várias receitas.
   * entries: [{ recipe, count }] — count = número de vezes que a receita aparece.
   * Devolve [{ key, name, amount, category }], com unidades compatíveis somadas
   * (g+kg, ml+l, un+un) e unidades incompatíveis apresentadas lado a lado.
   */
  function aggregate(recipes, people) {
    const groups = new Map();
    for (const recipe of recipes) {
      const f = scaleFactor(recipe.servings, people);
      for (const line of splitLines(recipe.ingredients)) {
        const p = parseLine(line);
        const key = ingredientKey(p.name);
        if (!key) continue;
        let g = groups.get(key);
        if (!g) { g = { key, name: p.name, parts: new Map(), loose: new Set() }; groups.set(key, g); }
        if (p.qty.num === null) { if (p.qty.raw) g.loose.add(p.qty.raw); else g.loose.add(''); continue; }
        const u = p.qty.unit;
        const base = (u.kind === 'mass' || u.kind === 'vol') ? p.qty.num * u.factor * f : p.qty.num * f;
        const part = g.parts.get(u.dim);
        if (part) part.total += base;
        else g.parts.set(u.dim, { total: base, unit: (u.kind === 'mass' || u.kind === 'vol') ? { kind: u.kind, factor: 1 } : u });
      }
    }
    return [...groups.values()].map(g => {
      const amounts = [...g.parts.values()].map(p => formatAmount(p.total, p.unit, 'shop'));
      for (const l of g.loose) if (l && !amounts.includes(l)) amounts.push(l);
      return { key: g.key, name: g.name, amount: amounts.join(' + '), category: categoryOf(g.name) };
    });
  }

  return {
    deaccent, parseNumber, parseQty, parseLine, splitLines, unitInfo, ingredientKey,
    categoryOf, CATEGORIES, formatAmount, scaleRecipe, aggregate, fmtNum
  };
});
