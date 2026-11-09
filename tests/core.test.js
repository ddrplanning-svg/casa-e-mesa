// Testes da lógica de quantidades. Executar com: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const R = (ingredients, servings = 2) => ({ ingredients, servings });

test('parseNumber aceita vírgula, ponto e frações', () => {
  assert.equal(C.parseNumber('1,5'), 1.5);
  assert.equal(C.parseNumber('1.5'), 1.5);
  assert.equal(C.parseNumber('1/2'), 0.5);
  assert.equal(C.parseNumber('1 1/2'), 1.5);
  assert.equal(C.parseNumber('½'), 0.5);
});

test('parseLine interpreta "quantidade unidade | ingrediente"', () => {
  const p = C.parseLine('300 g | arroz');
  assert.equal(p.name, 'arroz');
  assert.equal(p.qty.num, 300);
  assert.equal(p.qty.unit.kind, 'mass');
  assert.deepEqual(C.parseLine('sal'), { name: 'sal', qty: { num: null, raw: '' } });
  assert.equal(C.parseLine('q.b. | sal').qty.raw, 'q.b.');
  assert.equal(C.parseLine('2 | ovos').qty.unit.unit, 'un');
  assert.equal(C.parseLine('1 | a | b').name, 'a | b');
});

test('exemplo do enunciado: receita para 2 → 4 pessoas', () => {
  const r = R('500 g | frango\n500 g | batatas\n1 un | cebola');
  assert.deepEqual(C.scaleRecipe(r, 4).map(x => x.amount + ' ' + x.name), ['1 kg frango', '1 kg batatas', '2 un cebola']);
  assert.deepEqual(C.aggregate([r], 4).map(x => x.amount + ' ' + x.name), ['1 kg frango', '1 kg batatas', '2 un cebola']);
});

test('ajuste para menos pessoas e números ímpares', () => {
  const r = R('500 g | frango\n1 un | cebola\n2 colher | azeite\n2 lata | atum');
  assert.deepEqual(C.scaleRecipe(r, 1).map(x => x.amount), ['250 g', '0,5 un', '1 colher', '1 lata']);
  assert.deepEqual(C.scaleRecipe(r, 3).map(x => x.amount), ['750 g', '1,5 un', '3 colheres', '3 latas']);
  // Na lista de compras arredonda-se para cima (não se compra meia cebola)
  const shop = C.aggregate([r], 3);
  assert.equal(shop.find(x => x.name === 'cebola').amount, '2 un');
  assert.equal(shop.find(x => x.name === 'atum').amount, '3 latas');
});

test('20 pessoas e 1 pessoa nos extremos', () => {
  const r = R('300 g | arroz\n1 un | limão', 2);
  assert.deepEqual(C.scaleRecipe(r, 20).map(x => x.amount), ['3 kg', '10 un']);
  assert.deepEqual(C.scaleRecipe(r, 1).map(x => x.amount), ['150 g', '0,5 un']);
});

test('arredondamentos de gramas são razoáveis', () => {
  const r = R('100 g | queijo', 3);
  assert.equal(C.scaleRecipe(r, 1)[0].amount, '33 g'); // 33,3 g → 33 g
  assert.equal(C.scaleRecipe(R('500 g | frango', 3), 2)[0].amount, '335 g'); // ≥100 g arredonda a 5 g
});

test('soma g com kg e ml com l', () => {
  const items = C.aggregate([R('500 g | arroz\n200 ml | leite'), R('1 kg | arroz\n1 l | leite')], 2);
  assert.equal(items.find(x => x.key === 'arroz').amount, '1,5 kg');
  assert.equal(items.find(x => x.key === 'leite').amount, '1,2 l');
});

test('agrupa singular/plural e sinónimos', () => {
  const items = C.aggregate([R('4 un | ovo\n1 un | courgette'), R('4 un | ovos\n1 un | curgete')], 2);
  assert.equal(items.length, 2);
  assert.equal(items.find(x => x.key === 'ovo').amount, '8 un');
  assert.equal(items.find(x => x.key === 'curgete').amount, '2 un');
});

test('unidades incompatíveis não se perdem', () => {
  const items = C.aggregate([R('200 g | tomate'), R('2 un | tomate'), R('q.b. | tomate')], 2);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, '200 g + 2 un + q.b.');
});

test('receita repetida na semana soma as quantidades', () => {
  const r = R('300 g | arroz', 2);
  assert.equal(C.aggregate([r, r, r], 2)[0].amount, '900 g');
  assert.equal(C.aggregate([r, r, r, r], 2)[0].amount, '1,2 kg');
});

test('soma de unidades fracionárias sem erro de vírgula flutuante', () => {
  const r = R('1 un | cebola', 3); // 2/3 de cebola por receita para 2 pessoas
  assert.equal(C.aggregate([r, r, r], 2)[0].amount, '2 un');
});

test('porções inválidas não geram NaN', () => {
  assert.equal(C.scaleRecipe(R('100 g | arroz', 0), 4)[0].amount, '200 g');
  assert.equal(C.scaleRecipe(R('100 g | arroz', 'abc'), 2)[0].amount, '100 g');
});

test('categorias', () => {
  assert.equal(C.categoryOf('Batatas'), 'Frutas e legumes');
  assert.equal(C.categoryOf('peito de frango'), 'Talho');
  assert.equal(C.categoryOf('posta de salmão'), 'Peixaria');
  assert.equal(C.categoryOf('atum'), 'Mercearia');
  assert.equal(C.categoryOf('leite de coco'), 'Mercearia');
  assert.equal(C.categoryOf('leite'), 'Laticínios e ovos');
  assert.equal(C.categoryOf('ovos'), 'Laticínios e ovos');
  assert.equal(C.categoryOf('grão cozido'), 'Mercearia');
  assert.equal(C.categoryOf('polpa de tomate'), 'Mercearia');
  assert.equal(C.categoryOf('pão'), 'Padaria');
  assert.equal(C.categoryOf('xpto'), 'Outros');
});
