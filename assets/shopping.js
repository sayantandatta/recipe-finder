/* Recipe Finder - shopping list: setup -> draft checklist -> final list with PDF, Excel and Print. */
(() => {
  "use strict";
  const Q = window.Quantities;
  const $ = (s, el = document) => el.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const g = n => `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 })} g`;
  const today = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  let recipe = null;   // {id, name, ingredients, tags, link, have}
  let setup = null;    // {guests, portion, accompaniments}
  let draft = null;    // {people, portion, items}
  let roundAll = false;

  // ------------------------------------------------------------------ dialog
  const dlg = el("dialog", "shop");
  dlg.setAttribute("aria-labelledby", "shopTitle");
  dlg.innerHTML = `
    <div class="shop-head">
      <div>
        <p class="shop-step" id="shopStep"></p>
        <h2 id="shopTitle"></h2>
      </div>
      <button type="button" class="shop-close" id="shopClose" aria-label="Close shopping list">×</button>
    </div>
    <div class="shop-body" id="shopBody"></div>
    <div class="shop-foot" id="shopFoot"></div>`;
  const printSheet = el("div", "print-sheet");
  printSheet.id = "printSheet";

  function init() {
    document.body.append(dlg, printSheet);
    $("#shopClose", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  }

  function frame(step, title) {
    $("#shopStep", dlg).textContent = step;
    $("#shopTitle", dlg).textContent = title;
    const body = $("#shopBody", dlg), foot = $("#shopFoot", dlg);
    body.textContent = "";
    foot.textContent = "";
    body.scrollTop = 0;
    return { body, foot };
  }

  function button(text, cls, onClick, type = "button") {
    const b = el("button", cls, text);
    b.type = type;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  // ------------------------------------------------------------------ step 1: setup
  function open(r) {
    recipe = r;
    setup = setup && setup.recipeId === r.id ? setup : { recipeId: r.id, guests: 4, portion: "moderate", accompaniments: [] };
    renderSetup();
    if (!dlg.open) dlg.showModal();
  }

  function renderSetup() {
    const { body, foot } = frame("Shopping list, step 1 of 3", recipe.name);
    const form = el("form", "shop-setup");
    form.id = "shopSetup";
    form.noValidate = true;

    // guests
    const guests = el("div", "field");
    const gl = el("label", "field-label", "Guests at the table");
    gl.htmlFor = "shopGuests";
    const stepper = el("div", "stepper");
    const gi = el("input");
    Object.assign(gi, { type: "number", id: "shopGuests", min: 1, max: 500, value: setup.guests, inputMode: "numeric" });
    const minus = button("−", "step-btn", () => { gi.value = Math.max(1, (+gi.value || 1) - 1); });
    const plus = button("+", "step-btn", () => { gi.value = Math.min(500, (+gi.value || 0) + 1); });
    minus.setAttribute("aria-label", "One guest fewer");
    plus.setAttribute("aria-label", "One guest more");
    stepper.append(minus, gi, plus);
    guests.append(gl, stepper);

    // portion size
    const portion = el("fieldset", "field portions");
    portion.append(el("legend", "field-label", "Portion size"));
    for (const [key, p] of Object.entries(Q.PORTIONS)) {
      const lab = el("label", "portion");
      const rb = el("input");
      Object.assign(rb, { type: "radio", name: "portion", value: key, checked: setup.portion === key });
      lab.append(rb, el("span", "portion-name", p.label), el("span", "portion-note", `${p.note}, ${p.factor}×`));
      portion.append(lab);
    }

    // accompaniments
    const acc = el("fieldset", "field");
    acc.append(el("legend", "field-label", "Accompaniments"));
    acc.append(el("p", "field-hint", "Anything you'll serve alongside, one per line. Optional."));
    const rows = el("ol", "acc-rows");
    rows.id = "accRows";
    const addAcc = (v = "", focus = false) => {
      const li = el("li", "acc-row");
      const inp = el("input");
      Object.assign(inp, { type: "text", value: v, placeholder: "e.g. jeera rice" });
      inp.setAttribute("aria-label", "Accompaniment");
      inp.setAttribute("list", "accList");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addAcc("", true); } });
      const rm = button("×", "remove", () => { li.remove(); if (!rows.children.length) addAcc(); });
      rm.setAttribute("aria-label", "Remove this accompaniment");
      li.append(inp, rm);
      rows.append(li);
      if (focus) inp.focus();
    };
    (setup.accompaniments.length ? setup.accompaniments : [""]).forEach(v => addAcc(v));
    const dl = el("datalist");
    dl.id = "accList";
    Object.keys(Q.ACCOMPANIMENTS).forEach(k => dl.append(new Option(k)));
    const picks = el("div", "quick");
    Q.ACCOMPANIMENT_PICKS.forEach(p => picks.append(button(p, null, () => {
      const empty = [...rows.querySelectorAll("input")].find(i => !i.value.trim());
      if (empty) empty.value = p; else addAcc(p);
    })));
    acc.append(rows, button("+ Add accompaniment", "add", () => addAcc("", true)), dl, picks);

    form.append(guests, portion, acc);
    form.addEventListener("submit", e => {
      e.preventDefault();
      setup.guests = Math.max(1, Math.min(500, Math.round(+gi.value || 1)));
      setup.portion = form.querySelector('input[name="portion"]:checked').value;
      setup.accompaniments = [...rows.querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean);
      draft = Q.estimate(recipe, { ...setup, have: recipe.have });
      roundAll = false;
      renderDraft();
    });
    body.append(form);

    const submit = button("Create shopping list", "primary", null, "submit");
    submit.setAttribute("form", "shopSetup");
    foot.append(button("Cancel", "ghost", () => dlg.close()), submit);
  }

  // ------------------------------------------------------------------ step 2: draft
  function forWhom() {
    const p = Q.PORTIONS[draft.portion];
    return `${draft.people} guest${draft.people === 1 ? "" : "s"}, ${p.label.toLowerCase()} portions`;
  }

  function renderDraft() {
    const { body, foot } = frame("Shopping list, step 2 of 3: draft", recipe.name);

    const intro = el("p", "shop-note");
    intro.append(el("strong", null, `For ${forWhom()}. `),
      "Food.com recipes don't list amounts, so these quantities are estimates. Change any figure before you shop.");
    body.append(intro);

    const bar = el("div", "draft-bar");
    const ra = el("label", "switch");
    const rac = el("input");
    rac.type = "checkbox";
    rac.id = "roundAll";
    rac.checked = roundAll;
    rac.addEventListener("change", () => {
      roundAll = rac.checked;
      draft.items.forEach(it => { if (it.pack) it.round = roundAll; });
      renderDraftList();
    });
    ra.append(rac, el("span", null, "Round everything up to the pack sizes sold in shops"));
    const sel = el("div", "draft-select");
    sel.append(button("Select all", "link", () => { draft.items.forEach(i => (i.checked = true)); renderDraftList(); }),
      button("Clear all", "link", () => { draft.items.forEach(i => (i.checked = false)); renderDraftList(); }));
    bar.append(ra, sel);
    body.append(bar);

    const listBox = el("div", "draft-list");
    listBox.id = "draftList";
    body.append(listBox);

    // add a custom line
    const addForm = el("form", "draft-add");
    addForm.noValidate = true;
    const an = el("input");
    Object.assign(an, { type: "text", id: "addName", placeholder: "Add an item, e.g. coriander" });
    an.setAttribute("aria-label", "Item name");
    const ag = el("input");
    Object.assign(ag, { type: "number", id: "addGrams", min: 0, step: "any", placeholder: "grams" });
    ag.setAttribute("aria-label", "Quantity in grams");
    addForm.append(an, ag, button("Add item", "secondary", null, "submit"));
    addForm.addEventListener("submit", e => {
      e.preventDefault();
      const name = an.value.trim();
      if (!name) { an.focus(); return; }
      const r = Q.rule(name);
      draft.items.push({
        id: "u" + Date.now(), name: name.charAt(0).toUpperCase() + name.slice(1), need: Math.max(0, +ag.value || 100),
        aisle: r.aisle || "Other", pack: r.pack, packLabel: r.label, loose: /^(loose|bunch)/.test(r.label),
        sources: ["Added by you"], inKitchen: false, checked: true, round: roundAll && !!r.pack,
      });
      an.value = ""; ag.value = "";
      renderDraftList();
      an.focus();
    });
    body.append(addForm);

    const count = el("p", "draft-count");
    count.id = "draftCount";
    count.setAttribute("aria-live", "polite");
    foot.append(count, button("Back", "ghost", renderSetup), button("Make final list", "primary", renderFinal));
    renderDraftList();
  }

  function renderDraftList() {
    const box = $("#draftList", dlg);
    box.textContent = "";
    for (const aisle of groups(draft.items)) {
      const sec = el("section", "aisle");
      sec.append(el("h3", null, aisle.name));
      const ul = el("ul");
      aisle.items.forEach(it => ul.append(draftRow(it)));
      sec.append(ul);
      box.append(sec);
    }
    updateCount();
  }

  function draftRow(it) {
    const li = el("li", "draft-row");
    li.classList.toggle("off", !it.checked);

    const cb = el("input");
    Object.assign(cb, { type: "checkbox", id: `chk-${it.id}`, checked: it.checked });
    const name = el("label", "item-name");
    name.htmlFor = cb.id;
    name.append(el("span", null, it.name));
    const meta = el("span", "item-meta", it.sources.join(", "));
    if (it.inKitchen) meta.append(el("span", "in-kitchen", "you have this"));
    name.append(meta);
    cb.addEventListener("change", () => { it.checked = cb.checked; li.classList.toggle("off", !it.checked); updateCount(); });

    const need = el("label", "item-need");
    const ni = el("input");
    Object.assign(ni, { type: "number", min: 0, step: "any", value: it.need, id: `need-${it.id}` });
    ni.setAttribute("aria-label", `Grams of ${it.name}`);
    need.append(ni, el("span", null, "g"));

    const pack = el("div", "item-pack");
    const buyText = el("span", "item-buy");
    const refresh = () => {
      const b = Q.buy(it);
      const detail = it.loose && !/^bunch/.test(it.packLabel) ? "" : `, ${b.text}`;
      buyText.textContent = it.round && it.pack ? `Buy ${g(b.grams)}${detail}` : "";
    };
    ni.addEventListener("input", () => { it.need = Math.max(0, +ni.value || 0); refresh(); });
    if (it.pack) {
      const rl = el("label", "round");
      const rc = el("input");
      Object.assign(rc, { type: "checkbox", checked: it.round, id: `round-${it.id}` });
      rc.addEventListener("change", () => { it.round = rc.checked; refresh(); });
      rl.append(rc, el("span", null, `Round up to ${packWord(it)}`));
      pack.append(rl, buyText);
    }
    refresh();
    li.append(cb, name, need, pack);
    return li;
  }

  function packWord(it) {
    if (/^bunch/.test(it.packLabel)) return "whole bunches";
    if (it.loose) return `${it.pack} g steps`;
    return it.packLabel;
  }

  function updateCount() {
    const n = draft.items.filter(i => i.checked).length;
    $("#draftCount", dlg).textContent = `${n} of ${draft.items.length} items on the list`;
  }

  function groups(items) {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.aisle)) map.set(it.aisle, []);
      map.get(it.aisle).push(it);
    }
    return [...map.entries()]
      .sort((a, b) => Q.AISLE_ORDER.indexOf(a[0]) - Q.AISLE_ORDER.indexOf(b[0]))
      .map(([name, items]) => ({ name, items }));
  }

  // ------------------------------------------------------------------ step 3: final list
  function finalRows() {
    return draft.items.filter(i => i.checked).map(it => {
      const b = Q.buy(it);
      return { aisle: it.aisle, name: it.name, grams: b.grams, pack: b.text, need: it.need, uses: it.sources.join(", ") };
    });
  }

  function renderFinal() {
    const rows = finalRows();
    const { body, foot } = frame("Shopping list, step 3 of 3", recipe.name);
    if (!rows.length) {
      body.append(el("p", "shop-note", "Nothing is ticked yet. Go back and tick the items you need to buy."));
      foot.append(button("Back to draft", "ghost", renderDraft));
      return;
    }
    const total = rows.reduce((s, r) => s + r.grams, 0);
    const head = el("p", "shop-note");
    head.append(el("strong", null, `For ${forWhom()}. `), `${rows.length} items, about ${(total / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg in all.`);
    body.append(head);

    const list = el("div", "final-list");
    for (const aisle of groups(rows)) {
      const sec = el("section", "aisle");
      sec.append(el("h3", null, aisle.name));
      const ul = el("ul");
      for (const r of aisle.items) {
        const li = el("li", "final-row");
        const box = el("span", "tick");
        box.setAttribute("aria-hidden", "true");
        const nm = el("span", "final-name", r.name);
        if (r.pack) nm.append(el("span", "item-meta", r.pack));
        li.append(box, nm, el("span", "final-qty", g(r.grams)));
        ul.append(li);
      }
      sec.append(ul);
      list.append(sec);
    }
    body.append(list);

    const actions = el("div", "final-actions");
    const status = el("p", "export-status");
    status.setAttribute("aria-live", "polite");
    const run = (label, fn) => button(label, "secondary", async e => {
      const b = e.currentTarget;
      b.disabled = true;
      status.textContent = "";
      try { await fn(rows); } catch (err) {
        console.error(err);
        status.textContent = `${label} didn't work in this browser. Try Print and choose “Save as PDF”.`;
      }
      b.disabled = false;
    });
    actions.append(run("Download PDF", downloadPdf), run("Download Excel", downloadExcel), run("Print", printList));
    foot.append(button("Back to draft", "ghost", renderDraft), actions, status);
  }

  // ------------------------------------------------------------------ exports
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = () => { delete scripts[src]; rej(new Error(`Couldn't load ${src}`)); };
        document.head.append(s);
      });
    }
    return scripts[src];
  }
  const fileBase = () => `Shopping list - ${recipe.name}`.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80);
  const ascii = s => String(s).replace(/×/g, "x").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/¾/g, "3/4").replace(/[^\x20-\xFF]/g, "");

  async function downloadPdf(rows) {
    await loadScript("assets/vendor/jspdf.umd.min.js");
    await loadScript("assets/vendor/jspdf.plugin.autotable.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(ascii(`Shopping list: ${recipe.name}`), 14, 18, { maxWidth: 182 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(ascii(`For ${forWhom()}  |  ${today()}`), 14, 26);
    const body = [];
    for (const a of groups(rows)) {
      body.push([{ content: a.name, colSpan: 4, styles: { fontStyle: "bold", fillColor: [232, 236, 234], textColor: 30 } }]);
      a.items.forEach(r => body.push(["", ascii(r.name), ascii(g(r.grams)), ascii(r.pack)]));
    }
    doc.autoTable({
      startY: 32,
      head: [["", "Item", "Quantity", "Pack"]],
      body,
      theme: "plain",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 2.2, lineColor: [210, 216, 213], lineWidth: { bottom: 0.2 } },
      headStyles: { fontStyle: "bold", textColor: 30, lineWidth: { bottom: 0.5 } },
      columnStyles: { 0: { cellWidth: 8 }, 2: { halign: "right", cellWidth: 28 }, 3: { textColor: 90, cellWidth: 52 } },
      didDrawCell: d => {
        if (d.section === "body" && d.column.index === 0 && d.row.raw.length === 4) {
          const s = 3.6, x = d.cell.x + 2, y = d.cell.y + (d.cell.height - s) / 2;
          doc.setDrawColor(60);
          doc.setLineWidth(0.3);
          doc.rect(x, y, s, s);
        }
      },
    });
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text("Quantities are estimates; liquids are counted at 1 ml = 1 g. Recipe from Food.com.", 14, Math.min(y, 287));
    doc.save(`${fileBase()}.pdf`);
  }

  async function downloadExcel(rows) {
    await loadScript("assets/vendor/xlsx.full.min.js");
    const XLSX = window.XLSX;
    const aoa = [
      [`Shopping list: ${recipe.name}`],
      [`For ${forWhom()}`],
      [`Made on ${today()}. Quantities are estimates; liquids counted at 1 ml = 1 g.`],
      [],
      ["Got it", "Aisle", "Item", "Quantity (g)", "Pack", "Used for"],
    ];
    for (const a of groups(rows)) a.items.forEach(r => aoa.push(["", a.name, r.name, r.grams, r.pack, r.uses]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 7 }, { wch: 26 }, { wch: 36 }, { wch: 13 }, { wch: 26 }, { wch: 34 }];
    ws["!merges"] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: 5 } }));
    ws["!autofilter"] = { ref: `A5:F${aoa.length}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shopping list");
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
  }

  function printList(rows) {
    printSheet.textContent = "";
    printSheet.append(el("h1", null, `Shopping list: ${recipe.name}`), el("p", "print-sub", `For ${forWhom()}, ${today()}`));
    for (const a of groups(rows)) {
      printSheet.append(el("h2", null, a.name));
      const ul = el("ul");
      a.items.forEach(r => {
        const li = el("li");
        li.append(el("span", "tick"), el("span", "p-name", r.name), el("span", "p-pack", r.pack), el("span", "p-qty", g(r.grams)));
        ul.append(li);
      });
      printSheet.append(ul);
    }
    printSheet.append(el("p", "print-note", "Quantities are estimates; liquids are counted at 1 ml = 1 g. Recipe from Food.com."));
    window.print();
  }

  window.Shopping = { init, open };
})();
