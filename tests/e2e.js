/*
 * Testes de ponta a ponta (Playwright). Executar: node tests/e2e.js
 * Serve a pasta do projeto num servidor local e testa a aplicação num navegador real.
 */
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS_DIR || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { failed++; console.log('  ✘ ' + name + '\n     ' + (e && e.message || e)); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'valor'}: esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'condição falhou'); }

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('404'); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  const URL = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();

  async function newPage(opts = {}, fixedTime) {
    const ctx = await browser.newContext({ locale: 'pt-PT', timezoneId: 'Europe/Lisbon', ...opts });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
    if (fixedTime) await page.clock.setFixedTime(new Date(fixedTime));
    return { ctx, page };
  }
  const S = page => page.evaluate(() => window.CasaMesa.state);

  console.log('Casa & Mesa — testes de ponta a ponta');

  /* ---------- Desktop ---------- */
  {
    const { ctx, page } = await newPage({ viewport: { width: 1366, height: 900 } }, '2026-11-11T10:00:00');
    await page.goto(URL);

    await t('carrega sem erros e mostra o início', async () => {
      ok(await page.isVisible('#view-inicio'), 'início visível');
      eq(await page.textContent('#homeDate'), 'quarta-feira, 11 de novembro');
      eq(await page.textContent('#homeGreeting'), 'Bom dia');
      eq(page.errors, [], 'erros na consola');
    });

    await t('gera ementa automática com 14 refeições sem repetir', async () => {
      await page.click('#view-inicio [data-action="auto-week"]');
      const st = await S(page);
      const ids = Object.entries(st.plan).filter(([k]) => k >= '2026-11-09' && k <= '2026-11-15-1').map(([, v]) => v);
      eq(ids.length, 14, 'refeições');
      eq(new Set(ids).size, 14, 'pratos diferentes');
      ok(st.recipes.length >= 24, 'biblioteca adicionada');
    });

    await t('calendário mostra a semana de 9 a 15 nov 2026 com hoje assinalado', async () => {
      await page.click('.topnav [data-nav="calendario"]');
      eq(await page.textContent('#weekRange'), '9–15 nov 2026');
      eq(await page.locator('.day').count(), 7);
      eq(await page.getAttribute('.day.is-today', 'data-date'), '2026-11-11');
      eq(await page.locator('#weekGrid .slot.is-empty').count(), 0);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'desktop-calendario.png'), fullPage: true });
    });

    await t('os dados persistem após atualizar a página', async () => {
      const before = (await S(page)).plan;
      await page.reload();
      eq((await S(page)).plan, before);
      eq(await page.isVisible('#view-calendario'), true, 'mantém a secção (hash)');
    });

    await t('remover, escolher e trocar refeição', async () => {
      const key = '2026-11-12-1';
      await page.click(`#weekGrid .slot[data-key="${key}"]`);
      ok(await page.isVisible('#mealSheet'), 'folha aberta');
      eq(await page.textContent('#mealSheetWhen'), 'Jantar · Quinta, 12 nov');
      await page.click('#mealSheet [data-action="remove-meal"]');
      ok(!(await S(page)).plan[key], 'removido');
      eq(await page.locator('#weekGrid .slot.is-empty').count(), 1);
      ok((await page.textContent('#weekProgress')).includes('1 refeição por planear'));
      // escolher da lista com pesquisa
      await page.click(`#weekGrid .slot[data-key="${key}"]`);
      await page.fill('#pickerSearch', 'bacalhau');
      eq(await page.locator('#pickerList .pick').count(), 1, 'pesquisa');
      await page.click('#pickerList .pick');
      eq((await S(page)).plan[key], 'r5');
      // trocar
      await page.click(`#weekGrid .slot[data-key="${key}"]`);
      await page.click('#mealSheet [data-action="swap-meal"]');
      const after = (await S(page)).plan[key];
      ok(after && after !== 'r5', 'trocado por outro prato');
      ok(await page.isVisible('#mealSheet'), 'folha continua aberta com o novo prato');
      await page.keyboard.press('Escape');
    });

    await t('receita mostra quantidades ajustadas ao número de pessoas', async () => {
      await page.evaluate(() => { location.hash = 'receitas'; });
      await page.fill('#recipeSearch', 'frango no forno');
      await page.click('#recipeGrid [data-action="view-recipe"]');
      const read = () => page.$$eval('#recipeSheetBody .ing-list li', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').trim()));
      eq((await read())[0], 'Peito ou coxas de frango 500 g', '2 pessoas');
      await page.click('#recipeSheetBody [data-action="people-inc"]');
      await page.click('#recipeSheetBody [data-action="people-inc"]');
      eq(await read(), ['Peito ou coxas de frango 1 kg', 'Batatas 1 kg', 'Cebola 2 un', 'Alho 4 dentes', 'Azeite 4 colheres'], '4 pessoas');
      await page.click('#recipeSheetBody [data-action="people-dec"]');
      eq((await read()).slice(0, 3), ['Peito ou coxas de frango 750 g', 'Batatas 750 g', 'Cebola 1,5 un'], '3 pessoas');
      eq((await S(page)).people, 3);
      await page.keyboard.press('Escape');
      await page.fill('#recipeSearch', '');
    });

    await t('limites de 1 a 20 pessoas', async () => {
      await page.evaluate(() => { location.hash = 'definicoes'; });
      for (let i = 0; i < 25; i++) await page.click('#view-definicoes [data-action="people-inc"]', { force: true }).catch(() => {});
      eq((await S(page)).people, 20);
      ok(await page.isDisabled('#view-definicoes [data-action="people-inc"]'), 'botão + desativado');
      for (let i = 0; i < 25; i++) await page.click('#view-definicoes [data-action="people-dec"]', { force: true }).catch(() => {});
      eq((await S(page)).people, 1);
      await page.click('#view-definicoes [data-action="people-inc"]');
      eq((await S(page)).people, 2);
    });

    await t('lista de compras agrega, soma e categoriza corretamente', async () => {
      await page.evaluate(() => {
        const st = window.CasaMesa.state;
        for (const k of Object.keys(st.plan)) delete st.plan[k];
        Object.assign(st.plan, { '2026-11-09-0': 'r3', '2026-11-09-1': 'gen-salada-de-grao-com-ovo', '2026-11-10-0': 'r5', '2026-11-10-1': 'r3' });
        st.people = 3;
        localStorage.setItem('casaMesaV1', JSON.stringify(st));
      });
      await page.reload();
      await page.evaluate(() => { location.hash = 'compras'; });
      const items = await page.evaluate(() => Object.fromEntries(window.CasaMesa.shoppingData().items.map(i => [i.name, i.amount + ' · ' + i.category])));
      // ovos: 2x omelete (4) + salada (4) + bacalhau (2) = 14 para 2 → 21 para 3
      eq(items['Ovo'], '21 un · Laticínios e ovos', 'ovos somados (singular/plural)');
      eq(items['Curgete'], '3 un · Frutas e legumes', 'curgete: 2 × 1,5 → 3');
      eq(items['Pepino'], '2 un · Frutas e legumes', 'pepino arredondado para cima');
      eq(items['Grão cozido'], '600 g · Mercearia');
      eq(items['Bacalhau'], '450 g · Peixaria');
      eq(items['Azeite'], '4,5 colheres · Mercearia');
      ok(!Object.keys(items).some(n => /^Ovos$|Courgette/i.test(n)), 'sem duplicados');
      const headings = await page.$$eval('.shop-group h2', hs => hs.map(h => h.firstChild.textContent.trim()));
      eq(headings, ['Frutas e legumes', 'Peixaria', 'Laticínios e ovos', 'Mercearia']);
    });

    await t('assinalar comprados persiste e é por semana', async () => {
      await page.check('[data-check="auto:ovo"]');
      await page.reload();
      ok(await page.isChecked('[data-check="auto:ovo"]'), 'continua assinalado');
      await page.click('#view-compras [data-action="week-next"]');
      eq(await page.textContent('#shopRange'), '16–22 nov 2026 · 3 pessoas');
      ok(await page.isVisible('#shopList .empty'), 'semana seguinte vazia');
      await page.click('#view-compras [data-action="week-today"]');
    });

    await t('produtos manuais: adicionar, assinalar, remover', async () => {
      await page.fill('#manualInput', 'leite, 1 l');
      await page.press('#manualInput', 'Enter');
      const m = (await S(page)).manual;
      eq(m.length, 1);
      ok((await page.textContent('#shopList')).includes('Leite, 1 l'));
      await page.check(`[data-check="${m[0].id}"]`);
      eq((await S(page)).manual[0].done, true);
      await page.click(`[data-action="remove-manual"][data-id="${m[0].id}"]`);
      eq((await S(page)).manual.length, 0);
    });

    await t('copiar lista', async () => {
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.click('[data-action="copy-list"]');
      const txt = await page.evaluate(() => navigator.clipboard.readText());
      ok(txt.startsWith('Lista de compras — 9–15 nov 2026'), txt.slice(0, 60));
      ok(txt.includes('☑ Ovo — 21 un'), 'item assinalado');
    });

    await t('apagar receita planeada atualiza o plano e o resumo', async () => {
      await page.evaluate(() => { location.hash = 'receitas'; });
      await page.click('[data-action="delete-recipe"][data-id="r3"]');
      ok((await page.textContent('#confirmText')).includes('2 refeições planeadas'));
      await page.click('[data-confirm="yes"]');
      const st = await S(page);
      ok(!st.recipes.some(r => r.id === 'r3') && !Object.values(st.plan).includes('r3'), 'removida');
      await page.evaluate(() => { location.hash = 'calendario'; });
      eq(await page.locator('#weekGrid .slot:not(.is-empty)').count(), 2);
      ok((await page.textContent('#weekProgress')).includes('12 refeições por planear'));
    });

    await t('receita apagada não volta ao gerar ementa', async () => {
      page.once('dialog', d => d.accept());
      await page.click('#view-calendario [data-action="auto-week"]');
      await page.click('[data-confirm="yes"]');
      ok(!(await S(page)).recipes.some(r => r.id === 'r3'));
    });

    await t('cancelar confirmação (Esc ou fundo) não executa a ação', async () => {
      const before = (await S(page)).plan;
      await page.click('[data-action="clear-week"]');
      await page.keyboard.press('Escape');
      eq((await S(page)).plan, before, 'Esc');
      await page.click('[data-action="clear-week"]');
      await page.mouse.click(5, 5);
      eq((await S(page)).plan, before, 'clique fora');
      await page.click('[data-action="clear-week"]');
      await page.click('[data-confirm="yes"]');
      eq(await page.locator('#weekGrid .slot.is-empty').count(), 14);
    });

    await t('preencher vazios mantém os pratos existentes', async () => {
      await page.click('#weekGrid .slot[data-key="2026-11-09-0"]');
      await page.click('#pickerList .pick >> nth=0');
      const first = (await S(page)).plan['2026-11-09-0'];
      await page.click('[data-action="fill-week"]');
      eq((await S(page)).plan['2026-11-09-0'], first);
      eq(await page.locator('#weekGrid .slot.is-empty').count(), 0);
    });

    await t('criar receita a partir de uma refeição vazia e editá-la', async () => {
      await page.click('#weekGrid .slot[data-key="2026-11-15-1"]');
      await page.click('#mealSheet [data-action="remove-meal"]');
      await page.click('#weekGrid .slot[data-key="2026-11-15-1"]');
      await page.click('#mealSheet [data-action="new-recipe"]');
      await page.click('#editForm button[type="submit"]');
      ok(await page.isVisible('#editError'), 'validação');
      await page.fill('#editName', 'Bifinhos <b>de</b> peru');
      await page.fill('#editServings', '4');
      await page.fill('#editIngredients', '600 g | peru\n1/2 kg | arroz\nq.b. | sal');
      await page.fill('#editInstructions', 'Grelhar o peru. Cozer o arroz.');
      await page.click('#editForm button[type="submit"]');
      const st = await S(page);
      const r = st.recipes.find(x => x.name === 'Bifinhos <b>de</b> peru');
      ok(r, 'criada');
      eq(st.plan['2026-11-15-1'], r.id, 'atribuída à refeição');
      ok((await page.textContent('#weekGrid .slot[data-key="2026-11-15-1"]')).includes('Bifinhos <b>de</b> peru'), 'texto escapado');
      await page.click('#weekGrid .slot[data-key="2026-11-15-1"]');
      await page.click('#mealSheet [data-action="view-recipe"]');
      const ing = await page.$$eval('#recipeSheetBody .ing-list li', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').trim()));
      eq(ing, ['Peru 450 g', 'Arroz 375 g', 'Sal q.b.'], 'escala 4 → 3 pessoas');
      eq(await page.locator('#recipeSheetBody .steps li').count(), 2, 'passos');
      await page.click('#recipeSheetBody [data-action="edit-recipe"]');
      await page.fill('#editName', 'Bifinhos de peru');
      await page.click('#editForm button[type="submit"]');
      ok((await S(page)).recipes.some(x => x.id === r.id && x.name === 'Bifinhos de peru'), 'editada');
    });

    await t('exportar e importar dados', async () => {
      await page.evaluate(() => { location.hash = 'definicoes'; });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
      eq(dl.suggestedFilename(), 'casa-e-mesa-2026-11-11.json');
      const file = path.join(require('os').tmpdir(), 'cm-export-test.json');
      await dl.saveAs(file);
      const before = await S(page);
      await page.click('[data-action="reset"]');
      await page.click('[data-confirm="yes"]');
      eq((await S(page)).recipes.length, 8, 'reposto');
      await page.setInputFiles('#importFile', file);
      await page.click('[data-confirm="yes"]');
      const after = await S(page);
      eq(after.plan, before.plan, 'plano importado');
      eq(after.recipes.length, before.recipes.length, 'receitas importadas');
    });

    await t('sem erros de JavaScript durante os testes', async () => eq(page.errors, []));
    await ctx.close();
  }

  /* ---------- Mudanças de mês, ano e hora de verão ---------- */
  await t('mudança de ano: semana 28 dez 2026 – 3 jan 2027', async () => {
    const { ctx, page } = await newPage({}, '2026-12-31T20:00:00');
    await page.goto(URL + '#calendario');
    eq(await page.textContent('#weekRange'), '28 dez 2026 – 3 jan 2027');
    eq(await page.$$eval('.day', ds => ds.map(d => d.dataset.date)), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    await page.click('[data-action="week-next"]');
    eq(await page.textContent('#weekRange'), '4–10 jan 2027');
    await page.click('[data-action="week-prev"]'); await page.click('[data-action="week-prev"]');
    eq(await page.textContent('#weekRange'), '21–27 dez 2026');
    eq(await page.textContent('#homeGreeting'), 'Boa noite');
    eq(page.errors, []);
    await ctx.close();
  });

  await t('mudança de mês e domingo como último dia', async () => {
    const { ctx, page } = await newPage({}, '2026-12-06T09:00:00'); // domingo
    await page.goto(URL + '#calendario');
    eq(await page.textContent('#weekRange'), '30 nov – 6 dez 2026');
    eq(await page.getAttribute('.day.is-today', 'data-date'), '2026-12-06');
    await ctx.close();
  });

  await t('hora de verão (Lisboa, 28 mar 2027) não duplica nem salta dias', async () => {
    const { ctx, page } = await newPage({}, '2027-03-28T22:30:00Z');
    await page.goto(URL + '#calendario');
    eq(await page.$$eval('.day', ds => ds.map(d => d.dataset.date)), ['2027-03-22', '2027-03-23', '2027-03-24', '2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28']);
    await page.click('[data-action="week-next"]');
    eq(await page.$$eval('.day', ds => ds[0].dataset.date + '/' + ds[6].dataset.date), '2027-03-29/2027-04-04');
    for (let i = 0; i < 40; i++) await page.click('[data-action="week-next"]');
    eq(await page.$$eval('.day', ds => ds[0].dataset.date), '2028-01-03', 'segunda-feira após 41 semanas');
    eq(await page.textContent('#weekRange'), '3–9 jan 2028');
    await ctx.close();
  });

  /* ---------- Migração de dados da versão 3 ---------- */
  await t('dados guardados pela versão 3 são aproveitados', async () => {
    const { ctx, page } = await newPage({}, '2026-11-11T10:00:00');
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('casaMesaV1', JSON.stringify({
        recipes: [{ id: 'r0', name: 'Arroz de frango', servings: 2, ingredients: '300 g | arroz\n350 g | frango', instructions: 'x' },
          { id: 'gen-frango-no-forno-com-batatas', name: 'Frango no forno com batatas', servings: 2, ingredients: '500 g | frango', instructions: 'y' }],
        plan: { '2026-11-11-0': 'r0', '2026-11-11-1': 'apagada' },
        manual: [{ id: 'manual:1', text: 'pão' }],
        checked: { 'manual:1': true, 'auto:arroz:g': true },
        people: 4
      }));
    });
    await page.goto(URL);
    const st = await S(page);
    eq(st.people, 4);
    eq(st.recipes.length, 2, 'não acrescenta receitas por cima das do utilizador');
    eq(st.manual[0].done, true, 'manual assinalado migrado');
    eq(st.libraryAdded, true);
    ok((await page.textContent('#todayMeals')).includes('Arroz de frango'));
    ok((await page.textContent('#todayMeals')).includes('Escolher prato'), 'receita inexistente tratada como vazia');
    await page.evaluate(() => { location.hash = 'calendario'; });
    ok((await page.textContent('#weekProgress')).includes('13 refeições por planear'), 'resumo conta só receitas válidas');
    eq(page.errors, []);
    await ctx.close();
  });

  await t('dados corrompidos ou incompletos não bloqueiam a aplicação', async () => {
    for (const bad of ['{"recipes":[],"plan":{}}', 'não é json', '{"recipes":[{"name":"X"}],"plan":null,"people":"abc"}', 'null']) {
      const { ctx, page } = await newPage();
      await page.addInitScript(v => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('casaMesaV1', v); } }, bad);
      await page.goto(URL + '#compras');
      ok(await page.isVisible('#view-compras'), 'renderiza com ' + bad);
      eq(page.errors, [], 'erros com ' + bad);
      await ctx.close();
    }
  });

  /* ---------- Telemóvel ---------- */
  for (const name of ['iPhone 13', 'Pixel 7', 'iPhone SE']) {
    await t(`telemóvel (${name}): navegação inferior, sem scroll horizontal, folhas inferiores`, async () => {
      const { ctx, page } = await newPage({ ...devices[name], locale: 'pt-PT', timezoneId: 'Europe/Lisbon' }, '2026-11-11T19:00:00');
      await page.goto(URL);
      ok(await page.isVisible('.bottomnav'), 'navegação inferior visível');
      ok(!(await page.isVisible('.topnav')), 'navegação superior escondida');
      await page.tap('#view-inicio [data-action="auto-week"]');
      for (const v of ['inicio', 'calendario', 'receitas', 'compras', 'definicoes']) {
        await page.tap(`.bottomnav [data-nav="${v}"]`);
        await page.waitForSelector('#view-' + v, { state: 'visible', timeout: 3000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        ok(overflow <= 0, `${v}: scroll horizontal de ${overflow}px`);
        if (SHOTS && name === 'iPhone 13') await page.screenshot({ path: path.join(SHOTS, `mobile-${v}.png`), fullPage: v !== 'calendario' });
      }
      // botões com área de toque adequada
      const small = await page.$$eval('.bottomnav a, #view-definicoes button', els => els.filter(e => e.offsetParent && (e.getBoundingClientRect().height < 40)).map(e => e.textContent.trim()));
      eq(small, [], 'alvos de toque < 40px');
      await page.tap('.bottomnav [data-nav="calendario"]');
      await page.waitForSelector('#view-calendario', { state: 'visible' });
      await page.tap('#weekGrid .slot[data-key="2026-11-11-1"]');
      await page.waitForTimeout(450); // fim da animação de entrada
      const box = await page.locator('#mealSheet').boundingBox();
      const vp = page.viewportSize();
      ok(Math.abs(box.y + box.height - vp.height) < 2 && box.width === vp.width, 'folha encostada ao fundo e à largura total');
      if (SHOTS && name === 'iPhone 13') await page.screenshot({ path: path.join(SHOTS, 'mobile-folha-refeicao.png') });
      await page.tap('#mealSheet [data-action="view-recipe"]');
      if (SHOTS && name === 'iPhone 13') { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'mobile-receita.png') }); }
      eq(page.errors, []);
      await ctx.close();
    });
  }

  await t('tablet (iPad Mini): calendário em duas colunas', async () => {
    const { ctx, page } = await newPage({ ...devices['iPad Mini'], locale: 'pt-PT', timezoneId: 'Europe/Lisbon' }, '2026-11-11T12:00:00');
    await page.goto(URL + '#calendario');
    const cols = await page.$eval('#weekGrid', g => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    eq(cols, 2);
    eq(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'tablet-calendario.png') });
    await ctx.close();
  });

  await browser.close();
  srv.close();
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
})();
