/* Recipe Finder - static, client-side recipe matching over a prebuilt Food.com index. */
(() => {
  "use strict";

  const PAGE = 20;
  const MAX_TERMS = 30;
  const $ = (s, el = document) => el.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmt = n => n.toLocaleString("en-IN");

  // ---------------------------------------------------------------- names
  // Indian, British and other everyday names -> the words Food.com recipes use
  const SYNONYMS = {
    haldi: "turmeric", "haldi powder": "turmeric", jeera: "cumin", "jeera powder": "ground cumin",
    "cumin powder": "ground cumin", dhania: "coriander", "dhania powder": "ground coriander",
    "coriander powder": "ground coriander", "dhania patta": "cilantro", "coriander leaves": "cilantro",
    "coriander leaf": "cilantro", "hara dhania": "cilantro", methi: "fenugreek", "kasuri methi": "fenugreek",
    hing: "asafoetida", elaichi: "cardamom", "hari elaichi": "cardamom", laung: "cloves", lavang: "cloves",
    dalchini: "cinnamon", kalonji: "nigella", saunf: "fennel", rai: "mustard seeds", sarson: "mustard",
    kesar: "saffron", "tej patta": "bay leaf", "lal mirch": "chili powder", "red chili powder": "chili powder",
    "kashmiri mirch": "paprika", "hari mirch": "green chilies", "green chilli": "green chilies",
    "kali mirch": "black pepper", "kadi patta": "curry leaves", "curry patta": "curry leaves",
    "amchur": "mango powder", "ajwain": "ajwain", pudina: "mint",
    pyaz: "onion", pyaaz: "onion", kanda: "onion", lahsun: "garlic", lehsun: "garlic", adrak: "ginger",
    aloo: "potatoes", alu: "potatoes", gobi: "cauliflower", "phool gobi": "cauliflower", "patta gobi": "cabbage",
    "band gobi": "cabbage", dahi: "yogurt", curd: "yogurt", palak: "spinach", baingan: "eggplant",
    brinjal: "eggplant", aubergine: "eggplant", bhindi: "okra", "lady finger": "okra", ladyfinger: "okra",
    "lady's finger": "okra", matar: "peas", mutter: "peas", chana: "chickpeas", "kabuli chana": "chickpeas",
    chole: "chickpeas", garbanzo: "chickpeas", "garbanzo beans": "chickpeas", rajma: "kidney beans",
    dal: "lentils", daal: "lentils", "toor dal": "lentils", "moong dal": "lentils", "masoor dal": "lentils",
    chawal: "rice", atta: "whole wheat flour", maida: "all-purpose flour", "plain flour": "all-purpose flour",
    besan: "chickpea flour", "gram flour": "chickpea flour", sooji: "semolina", suji: "semolina", rava: "semolina",
    tamatar: "tomatoes", nimbu: "lemon", gur: "jaggery", imli: "tamarind", nariyal: "coconut",
    makhan: "butter", doodh: "milk", malai: "cream", "fresh cream": "cream", "double cream": "heavy cream",
    "single cream": "light cream", murgh: "chicken", murg: "chicken", gosht: "lamb", mutton: "lamb",
    machli: "fish", machhli: "fish", jhinga: "shrimp", prawn: "shrimp", prawns: "shrimp", anda: "eggs",
    ande: "eggs", gajar: "carrots", kheera: "cucumber", lauki: "bottle gourd", karela: "bitter melon",
    capsicum: "bell pepper", "shimla mirch": "bell pepper", courgette: "zucchini", courgettes: "zucchini",
    "spring onion": "green onions", "spring onions": "green onions", scallion: "green onions",
    scallions: "green onions", beetroot: "beets", cornflour: "cornstarch", "icing sugar": "powdered sugar",
    "caster sugar": "sugar", "bicarbonate of soda": "baking soda", "bicarb": "baking soda",
    rocket: "arugula", mangetout: "snow peas", swede: "rutabaga", "minced meat": "ground beef",
    mince: "ground beef", keema: "ground lamb", "chilli flakes": "red pepper flakes",
    "chili flakes": "red pepper flakes",
  };

  const STOP = new Set(["fresh", "chopped", "diced", "sliced", "minced", "large", "small", "medium", "some",
    "a", "an", "the", "of", "and", "few"]);

  function stem(w) {
    if (w === "leaves") return "leaf";
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "i";
    if (w.length > 3 && w.endsWith("y")) return w.slice(0, -1) + "i";
    if (w.length > 4 && /(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    if (w === "chile" || w === "chilie") return "chili";
    return w;
  }
  function normalize(raw) {
    let t = raw.toLowerCase().replace(/chilli/g, "chili").replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
    return t;
  }
  function canonical(raw) {
    const t = normalize(raw);
    return SYNONYMS[t] || t;
  }
  const words = s => s.split(/[\s-]+/).filter(Boolean).map(stem);

  // ---------------------------------------------------------------- data
  const D = {};

  async function load() {
    const [meta, vocab, bin] = await Promise.all([
      fetch("data/meta.json").then(r => { if (!r.ok) throw new Error("meta"); return r.json(); }),
      fetch("data/vocab.json").then(r => r.json()),
      fetch("data/match.bin")
        .then(r => { if (!r.ok) throw new Error("bin"); return r.arrayBuffer(); })
        // hosts that won't serve binary files can carry the same index as base64 text
        .catch(() => fetch("data/match.b64.txt").then(r => r.text())
          .then(b64 => Uint8Array.from(atob(b64.trim()), ch => ch.charCodeAt(0)).buffer)),
    ]);
    const dv = new DataView(bin);
    if (String.fromCharCode(...new Uint8Array(bin, 0, 4)) !== "RCP1") throw new Error("Unexpected index format");
    const n = dv.getUint32(4, true), nRefs = dv.getUint32(8, true), nCui = dv.getUint32(12, true);
    let o = 16;
    const ids = new Uint32Array(bin, o, n); o += 4 * n;
    const reviews = new Uint16Array(bin, o, n); o += 2 * n;
    const refs = new Uint16Array(bin, o, nRefs); o += 2 * nRefs;
    const rating = new Uint8Array(bin, o, n); o += n;
    const ingCount = new Uint8Array(bin, o, n); o += n;
    const cuiCount = new Uint8Array(bin, o, n); o += n;
    const cuis = new Uint8Array(bin, o, nCui);

    // popularity: Bayesian average rating weighted by log review count
    const pop = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const N = reviews[i], R = rating[i] / 20;
      pop[i] = N ? ((R * N + 4 * 3) / (N + 3)) * Math.log2(2 + N) : 0;
    }

    const V = vocab.names.length;
    const vid = new Map();
    const wordIndex = new Map(); // stemmed word -> vocab ids
    vocab.names.forEach((name, i) => {
      vid.set(name, i);
      for (const w of new Set(words(name))) {
        let a = wordIndex.get(w);
        if (!a) wordIndex.set(w, (a = []));
        a.push(i);
      }
    });
    const isSpice = new Uint8Array(V);
    vocab.spice.forEach(i => (isSpice[i] = 1));

    Object.assign(D, { meta, vocab, V, vid, wordIndex, isSpice, n, ids, reviews, refs, rating, ingCount,
      cuiCount, cuis, pop });
  }

  /** term -> sorted vocab ids whose names contain every word of the term */
  const expandCache = new Map();
  function expand(term) {
    const t = canonical(term);
    if (!t) return [];
    if (expandCache.has(t)) return expandCache.get(t);
    let ws = words(t).filter(w => !STOP.has(w));
    if (!ws.length) ws = words(t);
    let ids = null;
    for (const w of ws) {
      const list = D.wordIndex.get(w) || [];
      if (ids === null) ids = list.slice();
      else { const s = new Set(list); ids = ids.filter(x => s.has(x)); }
      if (!ids.length) break;
    }
    ids = ids || [];
    expandCache.set(t, ids);
    return ids;
  }

  // ---------------------------------------------------------------- shards
  const shardCache = new Map();
  function shard(id) {
    const k = id % D.meta.shards;
    if (!shardCache.has(k)) {
      shardCache.set(k, fetch(`data/recipes/${k}.json`).then(r => r.json()).catch(() => ({})));
    }
    return shardCache.get(k).then(s => s[id]);
  }

  // ---------------------------------------------------------------- form
  const ingRows = $("#ingRows");
  const tpl = $("#ingRowTpl");
  const spices = []; // {raw, canon}
  const cuisinesSel = new Set();

  function addRow(value = "", focus = false) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    const input = $("input", li);
    input.value = value;
    input.addEventListener("input", () => { suggest(input.value, $("#ingList"), false); showMatches(li); });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = li.nextElementSibling;
        if (next) $("input", next).focus(); else addRow("", true);
      }
    });
    $(".remove", li).addEventListener("click", () => {
      if (ingRows.children.length > 1) { const prev = li.previousElementSibling || li.nextElementSibling; li.remove(); $("input", prev).focus(); }
      else { input.value = ""; showMatches(li); input.focus(); }
    });
    ingRows.appendChild(li);
    if (D.vocab) showMatches(li);
    if (focus) input.focus();
    return li;
  }

  function showMatches(li) {
    const p = $(".matches", li);
    const v = $("input", li).value.trim();
    p.className = "matches";
    if (!v || !D.vocab) { p.textContent = ""; return; }
    const ids = expand(v);
    const canon = canonical(v);
    const via = canon !== normalize(v) ? `“${canon}”: ` : "";
    if (!ids.length) { p.textContent = `${via}not found in any recipe. Check the spelling.`; p.classList.add("none"); return; }
    const top = ids.slice(0, 3).map(i => D.vocab.names[i]);
    p.textContent = `${via}matches ${top.join(", ")}${ids.length > 3 ? ` and ${ids.length - 3} more` : ""}`;
  }

  function suggest(value, list, spicesOnly) {
    list.textContent = "";
    const t = normalize(value);
    if (t.length < 2 || !D.vocab) return;
    const starts = [], contains = [];
    const names = D.vocab.names;
    for (let i = 0; i < names.length && starts.length < 10; i++) {
      if (spicesOnly && !D.isSpice[i]) continue;
      const nm = names[i];
      if (nm.startsWith(t)) starts.push(nm);
      else if (contains.length < 10 && nm.includes(t)) contains.push(nm);
    }
    for (const nm of starts.concat(contains).slice(0, 10)) list.appendChild(new Option(nm));
  }

  // spices
  const spiceInput = $("#spiceInput");
  function addSpice(raw) {
    raw = raw.trim();
    if (!raw) return;
    const canon = canonical(raw);
    if (spices.some(s => s.canon === canon)) return;
    spices.push({ raw, canon });
    renderSpices();
  }
  function renderSpices() {
    const box = $("#spiceChips");
    box.textContent = "";
    spices.forEach((s, i) => {
      const chip = el("span", "chip");
      chip.append(s.raw);
      if (s.canon !== normalize(s.raw)) chip.append(" ", el("small", null, `(${s.canon})`));
      if (D.vocab && !expand(s.raw).length) chip.append(" ", el("small", null, "not found"));
      const b = el("button", null, "×");
      b.type = "button";
      b.setAttribute("aria-label", `Remove ${s.raw}`);
      b.addEventListener("click", () => { spices.splice(i, 1); renderSpices(); });
      chip.append(b);
      box.append(chip);
    });
  }
  spiceInput.addEventListener("input", () => suggest(spiceInput.value, $("#spiceList"), true));
  spiceInput.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSpice(spiceInput.value);
      spiceInput.value = "";
    }
  });
  spiceInput.addEventListener("change", () => {
    // picking from the datalist fires change; add it straight away
    if (D.vid && D.vid.has(spiceInput.value.trim().toLowerCase())) { addSpice(spiceInput.value); spiceInput.value = ""; }
  });

  function renderQuickSpices() {
    const box = $("#spiceQuick");
    box.textContent = "";
    const picks = D.vocab.spice
      .filter(i => !/^(fresh |dried )?(cilantro|parsley|basil|mint|vanilla extract)/.test(D.vocab.names[i]))
      .slice(0, 14);
    for (const i of picks) {
      const b = el("button", null, D.vocab.names[i]);
      b.type = "button";
      b.addEventListener("click", () => addSpice(D.vocab.names[i]));
      box.append(b);
    }
  }

  // cuisines
  function renderCuisines() {
    const list = $("#cuiList");
    const q = normalize($("#cuiSearch").value);
    list.textContent = "";
    const items = D.meta.cuisines.filter(c => !q || c.label.toLowerCase().includes(q));
    if (!items.length) { list.append(el("li", "empty", "No cuisine by that name.")); }
    for (const c of items) {
      const li = el("li");
      const lab = el("label");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = cuisinesSel.has(c.key);
      cb.addEventListener("change", () => {
        cb.checked ? cuisinesSel.add(c.key) : cuisinesSel.delete(c.key);
        renderCuisineChips();
      });
      lab.append(cb, el("span", null, c.label), el("span", "count", fmt(c.count)));
      li.append(lab);
      list.append(li);
    }
  }
  function renderCuisineChips() {
    const box = $("#cuiChips");
    box.textContent = "";
    for (const key of cuisinesSel) {
      const c = D.meta.cuisines.find(x => x.key === key);
      if (!c) continue;
      const chip = el("span", "chip", c.label);
      const b = el("button", null, "×");
      b.type = "button";
      b.setAttribute("aria-label", `Remove ${c.label}`);
      b.addEventListener("click", () => { cuisinesSel.delete(key); renderCuisineChips(); renderCuisines(); });
      chip.append(b);
      box.append(chip);
    }
  }
  $("#cuiSearch").addEventListener("input", renderCuisines);

  const maxSel = $("#maxExtra");
  for (let i = 1; i <= 10; i++) maxSel.append(new Option(String(i), String(i), i === 10, i === 10));
  maxSel.addEventListener("click", e => e.stopPropagation());
  maxSel.addEventListener("change", () => { $('input[name="mode"][value="minimal"]').checked = true; });

  $("#addIng").addEventListener("click", () => addRow("", true));

  // ---------------------------------------------------------------- search
  let state = null; // last search: {order, groups, shown, query}

  function readQuery() {
    const ingredients = [...ingRows.querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean);
    return {
      ingredients: [...new Set(ingredients.map(i => i))].slice(0, MAX_TERMS),
      spices: spices.map(s => s.raw),
      cuisines: [...cuisinesSel],
      mode: $('input[name="mode"]:checked').value,
      maxExtra: +maxSel.value,
      staples: $("#staples").checked,
    };
  }

  function run(q) {
    const { n, V, refs, ingCount, cuiCount, cuis, pop } = D;
    const A = q.ingredients.map(expand);
    const S = q.spices.map(expand);
    const k = A.length;

    const have = new Uint8Array(V);     // 1 = user has it, 2 = staple
    const termMask = new Uint32Array(V);
    A.forEach((ids, t) => ids.forEach(v => { have[v] = 1; termMask[v] |= (1 << t) >>> 0; }));
    const spiceHit = new Uint8Array(V);
    S.forEach(ids => ids.forEach(v => { have[v] = 1; spiceHit[v] = 1; }));
    if (q.staples) D.meta.staples.forEach(name => { const v = D.vid.get(name); if (v != null && !have[v]) have[v] = 2; });

    const cuiIdx = new Map(D.meta.cuisines.map((c, i) => [c.key, i]));
    const wantCui = new Uint8Array(256);
    q.cuisines.forEach(key => { const i = cuiIdx.get(key); if (i != null) wantCui[i] = 1; });
    const filterCui = q.cuisines.length > 0;

    const hit = [], near = [];
    const covArr = new Uint8Array(n), extraArr = new Uint8Array(n);
    let r = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const ni = ingCount[i], nc = cuiCount[i];
      if (filterCui) {
        let ok = false;
        for (let j = 0; j < nc; j++) if (wantCui[cuis[c + j]]) { ok = true; break; }
        if (!ok) { r += ni; c += nc; continue; }
      }
      c += nc;
      let mask = 0, extras = 0, usesSpice = 0;
      for (let j = 0; j < ni; j++) {
        const v = refs[r + j];
        mask |= termMask[v];
        if (!have[v]) extras++;
        usesSpice |= spiceHit[v];
      }
      r += ni;
      let cov = 0;
      for (let m = mask; m; m &= m - 1) cov++;
      covArr[i] = cov; extraArr[i] = Math.min(extras, 255);

      const all = cov === k && (k > 0 || usesSpice);
      let ok;
      if (q.mode === "exact") ok = extras === 0 && (k ? cov > 0 : usesSpice);
      else if (q.mode === "minimal") ok = all && extras <= q.maxExtra;
      else ok = all;

      if (ok) hit.push(i);
      else if (q.mode !== "exact" && k > 1 && cov > 0 && (q.mode === "includes" || extras <= q.maxExtra)) near.push(i);
    }

    const byPop = (a, b) => pop[b] - pop[a];
    if (q.mode === "exact") hit.sort((a, b) => covArr[b] - covArr[a] || ingCount[b] - ingCount[a] || byPop(a, b));
    else if (q.mode === "minimal") hit.sort((a, b) => extraArr[a] - extraArr[b] || byPop(a, b));
    else hit.sort((a, b) => byPop(a, b) || extraArr[a] - extraArr[b]);
    near.sort((a, b) => covArr[b] - covArr[a] || extraArr[a] - extraArr[b] || byPop(a, b));

    return { q, A, S, have, termMask, hit, near: near.slice(0, 200), covArr, extraArr };
  }

  // ---------------------------------------------------------------- render
  const results = $("#results");

  function cuisineLabels(i) {
    // walk to recipe i's cuisines; precompute offsets lazily
    if (!D.cuiStart) {
      D.cuiStart = new Uint32Array(D.n + 1);
      for (let x = 0; x < D.n; x++) D.cuiStart[x + 1] = D.cuiStart[x] + D.cuiCount[x];
    }
    const out = [];
    for (let j = D.cuiStart[i]; j < D.cuiStart[i + 1]; j++) out.push(D.meta.cuisines[D.cuis[j]].label);
    // prefer specific cuisines over broad regions
    const broad = new Set(["Asian", "European", "North American", "South American", "Central American", "African",
      "Middle Eastern", "Scandinavian"]);
    const specific = out.filter(l => !broad.has(l));
    return (specific.length ? specific : out).slice(0, 3);
  }

  function minutes(m) {
    if (!m) return null;
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    if (h >= 48) return `${Math.round(h / 24)} days`;
    return r ? `${h} hr ${r} min` : `${h} hr`;
  }

  function link(id, d) {
    return D.meta.demo
      ? `https://www.food.com/search/${encodeURIComponent(d.n)}`
      : `https://www.food.com/recipe/${d.u}-${id}`;
  }

  // a steady colour per cuisine for the card's top band
  // food-like hues only: saffron, paprika, chili, mango, olive, leaf, mint, teal, aubergine
  const HUES = [38, 20, 6, 48, 72, 120, 150, 185, 300];
  const CUISINE_HUE = { Indian: 38, Pakistani: 38, Mexican: 6, Italian: 120, Chinese: 6, Thai: 150, Japanese: 185,
    French: 300, Greek: 185, Spanish: 20, "Middle Eastern": 48, Lebanese: 48, American: 20, Korean: 6 };
  function hue(label) {
    if (label in CUISINE_HUE) return CUISINE_HUE[label];
    let h = 0;
    for (const ch of label || "recipe") h = (h * 31 + ch.charCodeAt(0)) % 997;
    return HUES[h % HUES.length];
  }
  const svg = (paths, cls = "ico") =>
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
  const CLOCK = svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');

  function stars(rating, count) {
    const wrap = el("span", "rating");
    const s = el("span", "stars", "★★★★★");
    s.style.setProperty("--pct", `${Math.max(0, Math.min(100, (rating / 5) * 100))}%`);
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", `Rated ${rating.toFixed(1)} out of 5`);
    wrap.append(s, el("span", "rating-num", rating.toFixed(1)),
      el("span", "rating-count", `(${fmt(count)} review${count === 1 ? "" : "s"})`));
    return wrap;
  }

  function recipeItem(res, i, rank, d) {
    const id = D.ids[i];
    const li = el("li", "recipe");
    if (!d) { li.append(el("p", "skeleton", "Couldn't load this recipe's details.")); return li; }

    const labels = cuisineLabels(i);
    const top = el("div", "card-top");
    top.style.setProperty("--hue", hue(labels[0]));
    top.append(el("span", "rank-badge", String(rank)));
    if (labels.length) top.append(el("span", "card-cuisine", labels.join(" · ")));
    const t = minutes(d.m);
    if (t) {
      const tb = el("span", "time-badge");
      tb.innerHTML = CLOCK;
      tb.append(t);
      top.append(tb);
    }
    li.append(top);

    const body = el("div", "card-body");
    li.append(body);

    const h = el("h3");
    const a = el("a", null, d.n);
    a.href = link(id, d);
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Open on Food.com";
    h.append(a);
    body.append(h);

    if (d.r && d.r[1] > 0) body.append(stars(d.r[1], d.r[0]));
    else body.append(el("p", "rating rating-none", "No ratings yet"));

    const facts = el("p", "facts");
    facts.append(el("span", null, `${d.i.length} ingredients`));
    if (d.s && d.s.length) facts.append(el("span", null, `${d.s.length} steps`));
    if (d.c) facts.append(el("span", null, `${fmt(d.c)} kcal`));
    body.append(facts);

    if (d.d && !/^sample recipe/.test(d.d)) body.append(el("p", "desc", d.d));

    // ingredient check
    const need = [];
    const ul = el("ul", "ings");
    for (const name of d.i) {
      const v = D.vid.get(name);
      const status = v == null ? 0 : res.have[v];
      const cls = status === 1 ? "have" : status === 2 ? "staple" : "need";
      if (cls === "need") need.push(name);
      ul.append(el("li", cls, name));
    }
    const verdict = el("p", "verdict");
    if (!need.length) verdict.append(el("span", "ok", "You have everything for this."));
    else verdict.append(el("span", "need", `Need ${need.length} more`), `: ${need.join(", ")}`);
    body.append(verdict, ul);

    if (d.t && d.t.length) {
      const tags = el("ul", "tags");
      d.t.slice(0, 8).forEach(x => tags.append(el("li", null, x)));
      body.append(tags);
    }

    const foot = el("div", "card-foot");
    if (d.s && d.s.length) {
      const det = el("details", "method");
      det.append(el("summary", null, `Show the method`));
      const ol = el("ol");
      d.s.forEach(s => ol.append(el("li", null, s)));
      det.append(ol);
      foot.append(det);
    }

    if (window.Shopping) {
      const shop = el("button", "shop-btn", "Make a shopping list");
      shop.type = "button";
      shop.addEventListener("click", () => window.Shopping.open({
        id, name: d.n, ingredients: d.i, tags: d.t || [], link: a.href,
        have: name => { const v = D.vid.get(name); return v != null && res.have[v] === 1; },
      }));
      foot.append(shop);
    }
    li.append(foot);
    return li;
  }

  async function renderPage() {
    const res = state;
    const list = res.order.slice(res.shown, res.shown + PAGE);
    const details = await Promise.all(list.map(x => shard(D.ids[x.i])));

    let ul = [...results.querySelectorAll("ol.recipes")].pop();
    list.forEach((x, j) => {
      if (!ul || ul.dataset.group !== x.g) {
        if (x.g === "near" && res.hit.length) {
          const missing = res.q.ingredients.length;
          const note = el("p", "group-note");
          note.append(el("strong", null, "Close matches. "),
            `These use most, but not all, of your ${missing} ingredients.`);
          results.insertBefore(note, results.querySelector(".more"));
        }
        ul = el("ol", "recipes");
        ul.dataset.group = x.g;
        results.insertBefore(ul, results.querySelector(".more"));
      }
      ul.append(recipeItem(res, x.i, res.shown + j + 1, details[j]));
    });
    res.shown += list.length;

    const more = results.querySelector(".more");
    if (res.shown >= res.order.length) more.hidden = true;
    else more.textContent = `Show ${Math.min(PAGE, res.order.length - res.shown)} more`;
  }

  function describeMode(q) {
    if (q.mode === "exact") return "using only what you have";
    if (q.mode === "minimal") return `with at most ${q.maxExtra} extra ingredient${q.maxExtra === 1 ? "" : "s"}`;
    return "with all your ingredients";
  }

  async function search(e) {
    if (e) e.preventDefault();
    const q = readQuery();
    results.textContent = "";
    if (!q.ingredients.length && !q.spices.length) {
      results.append(el("p", "error", "Add at least one ingredient or spice, then press Find recipes."));
      $("input", ingRows).focus();
      return;
    }
    saveQuery(q);
    const t0 = performance.now();
    const res = run(q);
    const ms = Math.round(performance.now() - t0);

    res.order = res.hit.map(i => ({ i, g: "hit" }));
    const fill = res.order.length < PAGE ? res.near.slice(0, PAGE - res.order.length) : [];
    res.order = res.order.concat(fill.map(i => ({ i, g: "near" })));
    res.shown = 0;
    state = res;

    const head = el("div", "results-head");
    const count = res.hit.length;
    head.append(el("h2", null, count
      ? `${fmt(count)} recipe${count === 1 ? "" : "s"} ${describeMode(q)}`
      : `No recipes ${describeMode(q)}`));
    head.append(el("p", null, `Searched ${fmt(D.n)} recipes in ${ms} ms${count > PAGE ? `, showing the top ${PAGE}` : ""}`));
    results.append(head);

    if (!res.order.length) {
      const box = el("div", "empty-state");
      box.append(el("h2", null, "Nothing matched."));
      const tips = [];
      if (q.mode === "exact") tips.push("Switch to “A few more” to allow some extra ingredients.");
      if (q.mode === "minimal") tips.push("Switch to “Anything with these”, or raise the number of extras.");
      if (q.cuisines.length) tips.push("Remove a cuisine filter or two.");
      if (q.ingredients.length > 3) tips.push("Remove an ingredient: recipes must use every one you list.");
      tips.forEach(t => box.append(el("p", null, t)));
      results.append(box);
      return;
    }
    if (!count) {
      const note = el("p", "group-note");
      note.append(el("strong", null, "No exact hits. "), "Here are the closest recipes instead.");
      results.append(note);
    }
    const more = el("button", "more", "Show more");
    more.type = "button";
    more.addEventListener("click", renderPage);
    results.append(more);
    await renderPage();
    if (e) results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  // ---------------------------------------------------------------- URL state
  function saveQuery(q) {
    const p = new URLSearchParams();
    if (q.ingredients.length) p.set("i", q.ingredients.join("|"));
    if (q.spices.length) p.set("s", q.spices.join("|"));
    if (q.cuisines.length) p.set("c", q.cuisines.join("|"));
    p.set("m", q.mode);
    if (q.mode === "minimal" && q.maxExtra !== 10) p.set("x", q.maxExtra);
    if (!q.staples) p.set("st", "0");
    try { history.replaceState(null, "", "#" + p.toString()); } catch (_) { /* sandboxed preview */ }
  }
  function restoreQuery() {
    const p = new URLSearchParams(location.hash.slice(1));
    const split = k => (p.get(k) || "").split("|").map(s => s.trim()).filter(Boolean);
    split("i").forEach(v => addRow(v));
    split("s").forEach(addSpice);
    split("c").forEach(k => { if (D.meta.cuisines.some(c => c.key === k)) cuisinesSel.add(k); });
    const m = p.get("m");
    if (m && $(`input[name="mode"][value="${m}"]`)) $(`input[name="mode"][value="${m}"]`).checked = true;
    if (p.get("x")) maxSel.value = p.get("x");
    if (p.get("st") === "0") $("#staples").checked = false;
    return p.has("i") || p.has("s");
  }

  // ---------------------------------------------------------------- boot
  $("#finder").addEventListener("submit", search);
  if (window.Shopping) window.Shopping.init();

  (async () => {
    try {
      await load();
    } catch (err) {
      $("#source").textContent = "Recipe data didn't load.";
      results.append(el("p", "error",
        "The recipe index is missing or incomplete. Build it with scripts/build_index.py and publish the data folder."));
      console.error(err);
      addRow();
      return;
    }
    $("#source").textContent = `${fmt(D.n)} recipes from Food.com`;
    $("#demoBanner").hidden = !D.meta.demo;
    renderQuickSpices();
    let restored = restoreQuery();
    if (!restored && D.meta.demo) {
      // sample site: open on a worked example so the page shows what it does
      ["onion", "tomatoes"].forEach(v => addRow(v));
      ["turmeric", "garam masala"].forEach(addSpice);
      if (D.meta.cuisines.some(c => c.key === "indian")) cuisinesSel.add("indian");
      $('input[name="mode"][value="includes"]').checked = true;
      restored = true;
    }
    if (!ingRows.children.length) { addRow(); addRow(); addRow(); }
    ingRows.querySelectorAll(".row").forEach(showMatches);
    renderSpices();
    renderCuisines();
    renderCuisineChips();
    $("#findBtn").disabled = false;
    if (restored) search();
  })();
})();
