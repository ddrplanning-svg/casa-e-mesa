/* Casa & Mesa — aplicação */
(function () {
  'use strict';

  const C = window.CMCore;
  const STORAGE_KEY = 'casaMesaV1'; // mantém a mesma chave da versão 3 para não perder dados
  const VIEWS = ['inicio', 'calendario', 'receitas', 'compras', 'definicoes'];
  const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const DAY_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MEALS = [{ label: 'Almoço', icon: 'sun' }, { label: 'Jantar', icon: 'moon' }];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clone = o => JSON.parse(JSON.stringify(o));
  const clampInt = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const norm = s => C.deaccent(String(s).toLowerCase());
  const cap = s => { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ================= Estado e persistência ================= */
  function freshState() {
    return { version: 2, recipes: clone(window.CM_DEFAULT_RECIPES), plan: {}, manual: [], checked: {}, people: 2, libraryAdded: false };
  }

  /** Aceita dados da versão 3 (ou incompletos/corrompidos) e devolve um estado válido. */
  function normalizeState(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.recipes)) {
      const seen = new Set();
      s.recipes = raw.recipes.filter(r => r && typeof r === 'object' && String(r.name || '').trim()).map((r, i) => {
        let id = String(r.id || 'r' + Date.now() + '-' + i);
        while (seen.has(id)) id += '-' + i;
        seen.add(id);
        return {
          id, name: String(r.name).trim(), servings: clampInt(r.servings, 1, 100, 2),
          ingredients: String(r.ingredients || ''), instructions: String(r.instructions || '')
        };
      });
    }
    if (raw.plan && typeof raw.plan === 'object') {
      for (const [k, v] of Object.entries(raw.plan)) if (/^\d{4}-\d{2}-\d{2}-[01]$/.test(k) && v) s.plan[k] = String(v);
    }
    const oldChecked = raw.checked && typeof raw.checked === 'object' ? raw.checked : {};
    if (Array.isArray(raw.manual)) {
      s.manual = raw.manual.filter(m => m && String(m.text || '').trim()).map((m, i) => ({
        id: String(m.id || 'manual:' + Date.now() + '-' + i), text: String(m.text).trim(),
        done: !!(m.done || oldChecked[m.id] === true)
      }));
    }
    // Versão 2: produtos comprados guardados por semana ({ '2026-11-09': { chave: true } }).
    for (const [wk, v] of Object.entries(oldChecked)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(wk) && v && typeof v === 'object') {
        s.checked[wk] = {};
        for (const [k, on] of Object.entries(v)) if (on === true) s.checked[wk][k] = true;
      }
    }
    s.people = clampInt(raw.people, 1, 20, 2);
    s.libraryAdded = !!raw.libraryAdded || s.recipes.some(r => r.id.startsWith('gen-'));
    return s;
  }

  let state;
  try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch (e) { state = freshState(); }
  let storageWarned = false;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { if (!storageWarned) { storageWarned = true; toast('Não foi possível guardar neste navegador (modo privado?).'); } }
  }

  /* ================= Datas ================= */
  let offset = 0; // semana visível relativamente à atual
  const iso = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  function today() { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  /** Segunda-feira da semana (meio-dia, para evitar problemas com a hora de verão). */
  function mondayOf(off = offset) { const d = today(); return addDays(d, -((d.getDay() + 6) % 7) + off * 7); }
  const mealKey = (d, j) => iso(d) + '-' + j;
  function weekSlots(off = offset) {
    const start = mondayOf(off), out = [];
    for (let i = 0; i < 7; i++) { const d = addDays(start, i); for (let j = 0; j < 2; j++) out.push({ date: d, day: i, meal: j, key: mealKey(d, j) }); }
    return out;
  }
  function keyInfo(key) {
    const [y, m, d, j] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return { date, meal: j, day: (date.getDay() + 6) % 7 };
  }
  const shortDate = d => d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  function weekLabel(off = offset) {
    const a = mondayOf(off), b = addDays(a, 6);
    if (a.getFullYear() !== b.getFullYear()) return `${shortDate(a)} ${a.getFullYear()} – ${shortDate(b)} ${b.getFullYear()}`;
    if (a.getMonth() !== b.getMonth()) return `${shortDate(a)} – ${shortDate(b)} ${b.getFullYear()}`;
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  }
  const whenLabel = key => { const { date, meal, day } = keyInfo(key); return `${MEALS[meal].label} · ${DAY_NAMES[day]}, ${shortDate(date)}`; };

  /* ================= Receitas e plano ================= */
  const recipeById = id => state.recipes.find(r => r.id === id);
  const planned = key => recipeById(state.plan[key]);
  const ingredientCount = r => C.splitLines(r.ingredients).length;
  const peopleLabel = n => n + ' ' + (n === 1 ? 'pessoa' : 'pessoas');
  const usable = () => state.recipes.filter(r => C.splitLines(r.ingredients).length);

  function addLibrary() {
    let added = 0;
    for (const r of window.CM_LIBRARY) {
      const exists = state.recipes.some(x => x.id === r.id || norm(x.name) === norm(r.name));
      if (!exists) { state.recipes.push(clone(r)); added++; }
    }
    state.libraryAdded = true;
    return added;
  }

  /**
   * Escolhe uma receita evitando, por ordem de prioridade:
   * as já usadas nesta semana, as da semana anterior e a refeição anterior.
   */
  function chooseRecipe(pool, usedThisWeek, lastWeek, exclude) {
    const tiers = [
      r => !usedThisWeek.has(r.id) && !lastWeek.has(r.id) && !exclude.has(r.id),
      r => !usedThisWeek.has(r.id) && !exclude.has(r.id),
      r => !exclude.has(r.id),
      () => true
    ];
    for (const ok of tiers) { const c = pool.filter(ok); if (c.length) return pickRandom(c); }
    return null;
  }
  function recipesInWeek(off) { return new Set(weekSlots(off).map(s => state.plan[s.key]).filter(id => recipeById(id))); }

  function fillSlots(slots, keepExisting) {
    const pool = usable();
    if (!pool.length) { toast('Crie primeiro uma receita com ingredientes.'); return 0; }
    const lastWeek = recipesInWeek(offset - 1);
    const used = new Set(keepExisting ? weekSlots().map(s => state.plan[s.key]).filter(id => recipeById(id)) : []);
    let n = 0, prev = null;
    for (const s of slots) {
      if (keepExisting && planned(s.key)) { prev = state.plan[s.key]; continue; }
      if (used.size >= pool.length) used.clear(); // receitas esgotadas: permite repetir
      const r = chooseRecipe(pool, used, lastWeek, new Set(prev ? [prev] : []));
      state.plan[s.key] = r.id; used.add(r.id); prev = r.id; n++;
    }
    return n;
  }

  async function autoWeek(off) {
    if (off !== undefined) offset = off;
    if (!state.libraryAdded) addLibrary();
    const slots = weekSlots();
    if (slots.some(s => planned(s.key)) && !(await confirmDialog('Substituir as refeições desta semana por uma nova ementa automática?', 'Gerar nova ementa'))) return;
    if (fillSlots(slots, false)) { save(); render(); toast('Ementa da semana gerada ✨'); flashSlots(slots.map(s => s.key)); }
  }

  function fillWeek() {
    if (!state.libraryAdded) addLibrary();
    const n = fillSlots(weekSlots(), true);
    save(); render();
    toast(n ? `${n} ${n === 1 ? 'refeição preenchida' : 'refeições preenchidas'}` : 'A semana já está toda planeada.');
  }

  async function clearWeek() {
    const slots = weekSlots().filter(s => state.plan[s.key]);
    if (!slots.length) return toast('Esta semana já está vazia.');
    if (!(await confirmDialog('Limpar todas as refeições desta semana?', 'Limpar', true))) return;
    slots.forEach(s => delete state.plan[s.key]);
    save(); render(); toast('Semana limpa');
  }

  function swapMeal(key) {
    const pool = usable(), current = state.plan[key];
    if (pool.filter(r => r.id !== current).length === 0) { toast('Adicione mais receitas para poder trocar.'); return null; }
    const used = recipesInWeek(offsetOfKey(key));
    const r = chooseRecipe(pool, used, new Set(), new Set([current]));
    state.plan[key] = r.id; save(); render(); flashSlots([key]);
    return r;
  }
  function offsetOfKey(key) {
    const ms = keyInfo(key).date - mondayOf(0);
    return Math.floor(Math.round(ms / 864e5) / 7);
  }

  function flashSlots(keys) {
    requestAnimationFrame(() => keys.forEach(k => $$(`.slot[data-key="${k}"]`).forEach(el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); })));
  }

  /* ================= Lista de compras ================= */
  function shoppingData(off = offset) {
    const wk = iso(mondayOf(off));
    const recipes = weekSlots(off).map(s => planned(s.key)).filter(Boolean);
    const checked = state.checked[wk] || {};
    const items = C.aggregate(recipes, state.people).map(x => ({
      id: 'auto:' + x.key, name: cap(x.name), amount: x.amount, category: x.category, done: !!checked['auto:' + x.key]
    }));
    for (const m of state.manual) items.push({ id: m.id, name: cap(m.text), amount: '', category: C.categoryOf(m.text), done: m.done, manual: true });
    const groups = C.CATEGORIES.map(cat => ({ cat, items: items.filter(i => i.category === cat).sort((a, b) => a.name.localeCompare(b.name, 'pt')) })).filter(g => g.items.length);
    return { wk, items, groups, meals: recipes.length };
  }

  function toggleItem(id, on) {
    if (id.startsWith('auto:')) {
      const wk = iso(mondayOf());
      state.checked[wk] = state.checked[wk] || {};
      if (on) state.checked[wk][id] = true; else delete state.checked[wk][id];
    } else {
      const m = state.manual.find(x => x.id === id); if (m) m.done = on;
    }
    save();
  }

  function shoppingText() {
    const { groups } = shoppingData();
    const lines = ['Lista de compras — ' + weekLabel(), ''];
    for (const g of groups) {
      lines.push(g.cat.toUpperCase());
      for (const i of g.items) lines.push((i.done ? '☑ ' : '☐ ') + i.name + (i.amount ? ' — ' + i.amount : ''));
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  /* ================= Renderização ================= */
  function stepperHTML() {
    const n = state.people;
    return `<div class="stepper" role="group" aria-label="Número de pessoas">
      <button type="button" data-action="people-dec" aria-label="Menos uma pessoa" ${n <= 1 ? 'disabled' : ''}>${ic('minus')}</button>
      <output aria-live="polite"><strong>${n}</strong><span>${n === 1 ? 'pessoa' : 'pessoas'}</span></output>
      <button type="button" data-action="people-inc" aria-label="Mais uma pessoa" ${n >= 20 ? 'disabled' : ''}>${ic('plus')}</button>
    </div>`;
  }

  function slotHTML(key, mealIdx) {
    const r = planned(key), m = MEALS[mealIdx];
    const label = `${m.label}: ${r ? r.name : 'por definir'}`;
    return `<button class="slot ${r ? '' : 'is-empty'}" data-action="open-meal" data-key="${key}" aria-label="${esc(label)}">
      <span class="slot-tag">${ic(m.icon)}${m.label}</span>
      <span class="slot-name">${r ? esc(r.name) : ic('plus') + 'Escolher prato'}</span>
    </button>`;
  }

  function progressHTML(done, total, label) {
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="stat">${done}<small>/${total}</small></div>
      <div class="progress-body"><span>${label}</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${pct}%"></span></div></div>`;
  }

  function renderCalendar() {
    const todayIso = iso(today());
    $('#weekRange').textContent = weekLabel();
    $$('[data-action="week-today"]').forEach(b => b.classList.toggle('is-current', offset === 0));
    const slots = weekSlots();
    const count = slots.filter(s => planned(s.key)).length;
    $('#weekProgress').innerHTML = progressHTML(count, 14, count === 14 ? 'Semana completa. Bom apetite!' : `${14 - count} ${14 - count === 1 ? 'refeição' : 'refeições'} por planear`);
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(mondayOf(), i), isToday = iso(d) === todayIso;
      const n = [0, 1].filter(j => planned(mealKey(d, j))).length;
      const badge = isToday ? '<span class="badge badge-today">Hoje</span>' : n === 2 ? '<span class="badge badge-ok">Planeado</span>' : `<span class="badge badge-todo">${n === 0 ? 'Por planear' : '1 por planear'}</span>`;
      html += `<article class="day ${isToday ? 'is-today' : ''}" data-date="${iso(d)}">
        <div class="day-head"><div><span class="day-name">${DAY_NAMES[i]}</span><span class="day-date">${shortDate(d)}</span></div>${badge}</div>
        <div class="day-meals">${slotHTML(mealKey(d, 0), 0)}${slotHTML(mealKey(d, 1), 1)}</div>
      </article>`;
    }
    $('#weekGrid').innerHTML = html;
  }

  function renderHome() {
    const t = today(), h = new Date().getHours();
    $('#homeGreeting').textContent = h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
    $('#homeDate').textContent = `${DAY_LONG[t.getDay()]}, ${t.getDate()} de ${MONTHS[t.getMonth()]}`;
    $('#todayMeals').innerHTML = slotHTML(mealKey(t, 0), 0) + slotHTML(mealKey(t, 1), 1);
    const slots = weekSlots(0), count = slots.filter(s => planned(s.key)).length;
    $('#homeWeekRange').textContent = weekLabel(0);
    $('#homeProgress').innerHTML = `<div class="progress-card">${progressHTML(count, 14, 'refeições planeadas')}</div>`;
    const sd = shoppingData(0), left = sd.items.filter(i => !i.done).length;
    $('#homeShopping').textContent = sd.items.length
      ? `${left} ${left === 1 ? 'produto' : 'produtos'} por comprar · ajustado para ${peopleLabel(state.people)}`
      : 'Planeie refeições e a lista é criada automaticamente.';
  }

  function renderRecipes() {
    const q = norm($('#recipeSearch').value.trim());
    const inWeek = recipesInWeek(offset);
    const list = state.recipes.filter(r => !q || norm(r.name).includes(q) || norm(r.ingredients).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    $('#recipeCount').textContent = `${state.recipes.length} ${state.recipes.length === 1 ? 'receita' : 'receitas'} no seu livro`;
    if (!state.recipes.length) {
      $('#recipeGrid').innerHTML = `<div class="empty">${ic('book')}<p>Ainda não há receitas.</p><div class="row"><button class="btn" data-action="add-library">${ic('sparkle')}Adicionar sugeridas</button><button class="btn btn-primary" data-action="new-recipe">${ic('plus')}Nova receita</button></div></div>`;
      return;
    }
    if (!list.length) { $('#recipeGrid').innerHTML = `<div class="empty">${ic('search')}<p>Nenhuma receita encontrada para “${esc($('#recipeSearch').value)}”.</p></div>`; return; }
    $('#recipeGrid').innerHTML = list.map(r => {
      const names = C.splitLines(r.ingredients).map(l => C.parseLine(l).name);
      return `<article class="recipe-card">
        <button class="recipe-open" data-action="view-recipe" data-id="${esc(r.id)}">
          <span class="recipe-thumb" aria-hidden="true">${esc(r.name.trim().charAt(0).toUpperCase())}</span>
          <span class="recipe-info"><h3>${esc(r.name)}</h3><p>${esc(names.join(', ') || 'Sem ingredientes')}</p></span>
        </button>
        <div class="recipe-foot">
          <div class="tags"><span class="tag">${r.servings} ${r.servings === 1 ? 'porção' : 'porções'}</span><span class="tag">${names.length} ingredientes</span>${inWeek.has(r.id) ? '<span class="tag tag-warm">Nesta semana</span>' : ''}</div>
          <div class="actions">
            <button class="icon-btn" data-action="edit-recipe" data-id="${esc(r.id)}" aria-label="Editar ${esc(r.name)}" title="Editar">${ic('edit')}</button>
            <button class="icon-btn" data-action="delete-recipe" data-id="${esc(r.id)}" aria-label="Apagar ${esc(r.name)}" title="Apagar">${ic('trash')}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function renderShopping() {
    const sd = shoppingData();
    $('#shopRange').textContent = `${weekLabel()} · ${peopleLabel(state.people)}`;
    const done = sd.items.filter(i => i.done).length;
    $('#shopProgress').hidden = !sd.items.length;
    $('#shopProgress').innerHTML = progressHTML(done, sd.items.length, done === sd.items.length && done ? 'Tudo comprado!' : 'produtos comprados');
    if (!sd.items.length) {
      $('#shopList').innerHTML = `<div class="empty">${ic('cart')}<p>A lista está vazia. Planeie refeições para esta semana e os ingredientes aparecem aqui, já ajustados ao número de pessoas.</p><a class="btn btn-primary" href="#calendario">${ic('calendar')}Ir para o calendário</a></div>`;
      return;
    }
    $('#shopList').innerHTML = `<div class="shop-columns">` + sd.groups.map(g => `<section class="shop-group">
      <h2>${esc(g.cat)} <span>${g.items.filter(i => !i.done).length}</span></h2>
      <div class="shop-items">${g.items.map(i => `<div class="shop-item ${i.done ? 'done' : ''}">
        <label><input type="checkbox" data-check="${esc(i.id)}" ${i.done ? 'checked' : ''}><span class="shop-name">${esc(i.name)}${i.manual ? '<span class="manual-tag">manual</span>' : ''}</span><span class="shop-qty">${esc(i.amount)}</span></label>
        ${i.manual ? `<button class="icon-btn" data-action="remove-manual" data-id="${esc(i.id)}" aria-label="Remover ${esc(i.name)}">${ic('x')}</button>` : ''}
      </div>`).join('')}</div>
    </section>`).join('') + `</div>`;
  }

  function renderBadges() {
    const left = shoppingData(0).items.filter(i => !i.done).length;
    $$('[data-shop-badge]').forEach(b => { b.hidden = !left; b.textContent = left > 99 ? '99+' : left; });
  }

  function renderSettings() {
    const missing = window.CM_LIBRARY.filter(r => !state.recipes.some(x => x.id === r.id || norm(x.name) === norm(r.name))).length;
    $('#libraryInfo').textContent = missing
      ? `Há ${missing} receitas portuguesas e familiares sugeridas que ainda não estão no seu livro.`
      : 'Todas as receitas sugeridas já estão no seu livro.';
  }

  function render() {
    $$('[data-stepper-slot]').forEach(el => { el.innerHTML = stepperHTML(); });
    renderHome(); renderCalendar(); renderRecipes(); renderShopping(); renderSettings(); renderBadges();
    if ($('#recipeSheet').open && openRecipeId) renderRecipeSheet();
  }

  /* ================= Navegação ================= */
  function currentView() { const v = location.hash.slice(1); return VIEWS.includes(v) ? v : 'inicio'; }
  function showView() {
    const v = currentView();
    VIEWS.forEach(id => { $('#view-' + id).hidden = id !== v; });
    $$('[data-nav]').forEach(a => { const on = a.dataset.nav === v; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo({ top: 0 });
    if (v === 'calendario' && offset === 0 && window.matchMedia('(max-width: 639px)').matches) {
      const t = document.querySelector('.day.is-today');
      if (t && t.previousElementSibling) setTimeout(() => t.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
    }
  }
  window.addEventListener('hashchange', showView);

  /* ================= Diálogos ================= */
  function openDialog(d) { if (!d.open) d.showModal(); }
  function closeDialogs() { $$('dialog[open]').forEach(d => d.close()); }
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  let confirmResolve = null;
  function confirmDialog(text, okLabel = 'Confirmar', danger = false) {
    $('#confirmText').textContent = text;
    const ok = $('#confirmOk');
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    $('#confirmDialog').returnValue = '';
    openDialog($('#confirmDialog'));
    ok.focus();
    return new Promise(res => { confirmResolve = res; });
  }
  $('#confirmDialog').addEventListener('close', () => { if (confirmResolve) { confirmResolve($('#confirmDialog').returnValue === 'yes'); confirmResolve = null; } });
  $$('[data-confirm]').forEach(b => b.addEventListener('click', () => {
    const res = confirmResolve; confirmResolve = null;
    $('#confirmDialog').close(b.dataset.confirm);
    if (res) res(b.dataset.confirm === 'yes');
  }));
  $('#confirmDialog').addEventListener('cancel', () => { $('#confirmDialog').returnValue = 'no'; });

  // --- Refeição ---
  let mealKeyOpen = null;
  function openMeal(key, mode) {
    mealKeyOpen = key;
    const r = planned(key);
    $('#mealSheetWhen').textContent = whenLabel(key);
    if (r && mode !== 'pick') {
      $('#mealSheetTitle').textContent = r.name;
      $('#mealSheetBody').innerHTML = `<div class="action-list">
        <button class="action" data-action="view-recipe" data-id="${esc(r.id)}"><span class="ic-wrap">${ic('book')}</span><span>Ver receita<small>Ingredientes para ${peopleLabel(state.people)}</small></span></button>
        <button class="action" data-action="swap-meal"><span class="ic-wrap">${ic('shuffle')}</span><span>Sugerir outro prato<small>Escolha automática, sem repetir a semana</small></span></button>
        <button class="action" data-action="pick-meal"><span class="ic-wrap">${ic('edit')}</span><span>Escolher da lista<small>${state.recipes.length} receitas disponíveis</small></span></button>
        <button class="action danger" data-action="remove-meal"><span class="ic-wrap">${ic('trash')}</span><span>Remover desta refeição</span></button>
      </div>`;
    } else {
      $('#mealSheetTitle').textContent = r ? 'Trocar prato' : 'Escolher prato';
      $('#mealSheetBody').innerHTML = `<div class="picker">
        <label class="search">${ic('search')}<input id="pickerSearch" type="search" placeholder="Pesquisar receita…" aria-label="Pesquisar receita" autocomplete="off"></label>
        <div class="picker-list" id="pickerList"></div>
        <div class="row">
          ${usable().length ? `<button class="btn" data-action="swap-meal">${ic('shuffle')}Sugestão automática</button>` : ''}
          <button class="btn" data-action="new-recipe" data-assign="1">${ic('plus')}Nova receita</button>
        </div>
      </div>`;
      renderPicker();
      $('#pickerSearch').addEventListener('input', renderPicker);
    }
    openDialog($('#mealSheet'));
  }
  function renderPicker() {
    const q = norm(($('#pickerSearch') || {}).value || '');
    const current = state.plan[mealKeyOpen];
    const list = state.recipes.filter(r => !q || norm(r.name).includes(q) || norm(r.ingredients).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    $('#pickerList').innerHTML = list.length ? list.map(r => `<button class="pick ${r.id === current ? 'is-current' : ''}" data-action="choose-recipe" data-id="${esc(r.id)}">
      <span>${esc(r.name)}<br><small>${ingredientCount(r)} ingredientes · ${r.servings} ${r.servings === 1 ? 'porção' : 'porções'}</small></span>${r.id === current ? `<span class="tag">Atual</span>` : ''}</button>`).join('')
      : `<p class="muted small" style="padding:8px 4px">${state.recipes.length ? 'Nenhuma receita encontrada.' : 'Ainda não há receitas. Crie a primeira.'}</p>`;
  }

  // --- Ver receita ---
  let openRecipeId = null;
  function viewRecipe(id) {
    if (!recipeById(id)) return;
    openRecipeId = id;
    $('#mealSheet').close();
    renderRecipeSheet();
    openDialog($('#recipeSheet'));
  }
  function renderRecipeSheet() {
    const r = recipeById(openRecipeId);
    if (!r) { $('#recipeSheet').close(); return; }
    $('#recipeSheetTitle').textContent = r.name;
    $('#recipeSheetMeta').textContent = `Receita base: ${r.servings} ${r.servings === 1 ? 'porção' : 'porções'}`;
    const ings = C.scaleRecipe(r, state.people);
    const steps = r.instructions.replace(/\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, '.\n').split(/\n+/).map(s => s.trim()).filter(Boolean);
    $('#recipeSheetBody').innerHTML = `<div class="recipe-view">
      <div class="people-line"><span>Quantidades para</span>${stepperHTML()}</div>
      <section><h3>Ingredientes</h3>${ings.length ? `<ul class="ing-list">${ings.map(i => `<li><span>${esc(cap(i.name))}</span><strong>${esc(i.amount)}</strong></li>`).join('')}</ul>` : '<p class="muted">Sem ingredientes registados.</p>'}</section>
      <section><h3>Preparação</h3>${steps.length ? `<ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted">Sem instruções registadas.</p>'}</section>
      <div class="sheet-actions"><button class="btn" data-action="edit-recipe" data-id="${esc(r.id)}">${ic('edit')}Editar</button><button class="btn btn-primary" data-action="close-dialog">Fechar</button></div>
    </div>`;
  }

  // --- Editar receita ---
  let editingId = null, assignAfterSave = null;
  function openEditor(id, assignKey) {
    editingId = id; assignAfterSave = assignKey || null;
    const r = id ? recipeById(id) : null;
    $('#editTitle').textContent = r ? 'Editar receita' : 'Nova receita';
    $('#editName').value = r ? r.name : '';
    $('#editServings').value = r ? r.servings : 2;
    $('#editIngredients').value = r ? r.ingredients : '';
    $('#editInstructions').value = r ? r.instructions : '';
    $('#editError').hidden = true;
    closeDialogs();
    openDialog($('#editSheet'));
    if (!r) setTimeout(() => $('#editName').focus(), 50);
  }
  $('#editForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#editName').value.trim(), ingredients = C.splitLines($('#editIngredients').value).join('\n');
    const err = !name ? 'Indique o nome da receita.' : !ingredients ? 'Indique pelo menos um ingrediente.' : '';
    if (err) { $('#editError').textContent = err; $('#editError').hidden = false; return; }
    const r = { id: editingId || 'r' + Date.now(), name, servings: clampInt($('#editServings').value, 1, 100, 2), ingredients, instructions: $('#editInstructions').value.trim() };
    if (editingId) state.recipes = state.recipes.map(x => x.id === editingId ? r : x); else state.recipes.push(r);
    if (assignAfterSave) state.plan[assignAfterSave] = r.id;
    save(); $('#editSheet').close(); render();
    toast(editingId ? 'Receita atualizada' : assignAfterSave ? 'Receita criada e adicionada ao calendário' : 'Receita criada');
    if (assignAfterSave) flashSlots([assignAfterSave]);
  });

  async function deleteRecipe(id) {
    const r = recipeById(id); if (!r) return;
    const uses = Object.keys(state.plan).filter(k => state.plan[k] === id);
    const msg = `Apagar a receita “${r.name}”?` + (uses.length ? ` Será também removida de ${uses.length} ${uses.length === 1 ? 'refeição planeada' : 'refeições planeadas'}.` : '');
    if (!(await confirmDialog(msg, 'Apagar', true))) return;
    state.recipes = state.recipes.filter(x => x.id !== id);
    uses.forEach(k => delete state.plan[k]);
    save(); closeDialogs(); render(); toast('Receita apagada');
  }

  /* ================= Aviso ================= */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ================= Exportar / importar ================= */
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'casa-e-mesa', exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `casa-e-mesa-${iso(today())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Ficheiro exportado');
  }
  $('#importFile').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (err) { return toast('Ficheiro inválido.'); }
    if (!data || !Array.isArray(data.recipes)) return toast('Este ficheiro não parece ser uma cópia da Casa & Mesa.');
    if (!(await confirmDialog(`Importar ${data.recipes.length} receitas e as ementas guardadas? Os dados atuais deste navegador serão substituídos.`, 'Importar'))) return;
    state = normalizeState(data); save(); render(); toast('Dados importados');
  });

  async function copyList() {
    const text = shoppingText();
    try { await navigator.clipboard.writeText(text); toast('Lista copiada'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* ignorar */ }
      ta.remove();
      if (ok) toast('Lista copiada'); else window.prompt('Copie a lista:', text);
    }
  }

  function printView(name) {
    document.body.dataset.print = name;
    const clear = () => { delete document.body.dataset.print; window.removeEventListener('afterprint', clear); };
    window.addEventListener('afterprint', clear);
    window.print();
    setTimeout(clear, 1000);
  }

  /* ================= Ações ================= */
  function setPeople(n) { state.people = clampInt(n, 1, 20, 2); save(); render(); }

  const actions = {
    'people-dec': () => setPeople(state.people - 1),
    'people-inc': () => setPeople(state.people + 1),
    'week-prev': () => { offset--; render(); },
    'week-next': () => { offset++; render(); },
    'week-today': () => { offset = 0; render(); },
    'auto-week': el => autoWeek(el.dataset.week !== undefined ? Number(el.dataset.week) : undefined),
    'fill-week': fillWeek,
    'clear-week': clearWeek,
    'print-week': () => printView('calendario'),
    'open-meal': el => openMeal(el.dataset.key),
    'pick-meal': () => openMeal(mealKeyOpen, 'pick'),
    'choose-recipe': el => { state.plan[mealKeyOpen] = el.dataset.id; save(); render(); $('#mealSheet').close(); toast('Prato escolhido'); flashSlots([mealKeyOpen]); },
    'swap-meal': () => { const r = swapMeal(mealKeyOpen); if (r) { openMeal(mealKeyOpen); toast('Nova sugestão: ' + r.name); } },
    'remove-meal': () => { delete state.plan[mealKeyOpen]; save(); render(); $('#mealSheet').close(); toast('Prato removido'); },
    'view-recipe': el => viewRecipe(el.dataset.id),
    'new-recipe': el => openEditor(null, el.dataset.assign ? mealKeyOpen : null),
    'edit-recipe': el => openEditor(el.dataset.id),
    'delete-recipe': el => deleteRecipe(el.dataset.id),
    'add-library': () => { const n = addLibrary(); save(); render(); toast(n ? `${n} receitas adicionadas ao livro` : 'Todas as receitas sugeridas já estão no seu livro.'); },
    'close-dialog': el => { const d = el.closest('dialog'); if (d) d.close(); },
    'remove-manual': el => { state.manual = state.manual.filter(m => m.id !== el.dataset.id); save(); render(); },
    'copy-list': copyList,
    'print-list': () => printView('compras'),
    'uncheck-all': () => { delete state.checked[iso(mondayOf())]; state.manual.forEach(m => { m.done = false; }); save(); render(); toast('Lista desmarcada'); },
    'export': exportData,
    'import': () => $('#importFile').click(),
    'reset': async () => {
      if (!(await confirmDialog('Apagar todas as receitas, ementas e a lista de compras deste navegador? Esta ação não pode ser anulada.', 'Apagar tudo', true))) return;
      state = freshState(); offset = 0; save(); render(); toast('Dados repostos');
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-check]');
    if (el) { toggleItem(el.dataset.check, el.checked); render(); }
  });
  $('#recipeSearch').addEventListener('input', renderRecipes);
  $('#manualForm').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('#manualInput').value.trim(); if (!t) return;
    state.manual.push({ id: 'manual:' + Date.now(), text: t, done: false });
    $('#manualInput').value = ''; save(); render(); toast('Produto adicionado');
  });
  $('#recipeSheet').addEventListener('close', () => { openRecipeId = null; });

  // Exposto apenas para testes automáticos e diagnóstico.
  window.CasaMesa = { get state() { return state; }, get offset() { return offset; }, normalizeState, shoppingData, weekLabel };

  render();
  showView();
})();
