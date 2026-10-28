/* Recipe Finder - shopping quantities.
 * Food.com's dataset lists ingredient names without amounts, so quantities are estimated:
 *   grams per person for a normal portion, by ingredient type
 *   x a balancing factor so a dish's main components add up to a sensible plate for its course
 *   x guests x portion size
 * Pack sizes are the common retail sizes in Indian shops; liquids use 1 ml = 1 g.
 */
(() => {
  "use strict";

  const AISLE = {
    VEG: "Vegetables & fruit", MEAT: "Meat, fish & eggs", DAIRY: "Dairy & chilled", GRAIN: "Rice, flour & pulses",
    SPICE: "Spices & dried herbs", PACK: "Oils, sauces & packaged", BAKE: "Baking & sweeteners",
    BREAD: "Bakery", DRY: "Dry fruits & nuts", OTHER: "Other",
  };
  const AISLE_ORDER = Object.values(AISLE);

  // [pattern, grams per person, aisle, pack grams, pack label, kind, display name]
  // kind: M = main component (balanced against the course), A = accent (fixed per person), S = skip
  // A pack label starting with "loose" means the shop sells it by weight in steps of that size.
  const R = (re, g, aisle, pack, label, kind = "A", rename = null) => ({ re, g, aisle, pack, label, kind, rename });
  const { VEG, MEAT, DAIRY, GRAIN, SPICE, PACK, BAKE, BREAD, DRY, OTHER } = AISLE;
  const RULES = [
    R(/^(water|ice|ice cubes|ice water|boiling water|hot water|cold water|warm water|lukewarm water|crushed ice)$/, 0, null, 0, "", "S"),
    R(/cooking spray|nonstick spray/, 0, null, 0, "", "S"),

    // stocks, sauces and packaged foods
    R(/bouillon|stock cubes?|stock powder|maggi cube/, 3, PACK, 40, "pack of 4 cubes"),
    R(/\b(broth|stock)\b/, 150, PACK, 1000, "1 L pack"),
    R(/coconut (milk|cream)/, 80, PACK, 200, "200 ml pack", "M"),
    R(/tomato paste/, 10, PACK, 200, "200 g pack"),
    R(/tomato (puree|sauce)|passata|marinara/, 50, PACK, 200, "200 g pack", "M"),
    R(/(canned|crushed|diced|stewed|whole peeled) tomatoes|tomatoes,? (canned|crushed|diced)/, 80, PACK, 400, "400 g can", "M"),
    R(/ketchup/, 15, PACK, 500, "500 g bottle"),
    R(/mayonnaise|\bmayo\b/, 15, PACK, 250, "250 g jar"),
    R(/soy sauce|tamari/, 10, PACK, 200, "200 ml bottle"),
    R(/fish sauce|oyster sauce|hoisin|worcestershire|hot sauce|tabasco|sriracha|chili sauce|chilli sauce|bbq sauce|barbecue sauce|teriyaki/, 8, PACK, 200, "200 ml bottle"),
    R(/vinegar/, 8, PACK, 600, "600 ml bottle"),
    R(/curry paste/, 12, PACK, 100, "100 g pack"),
    R(/tamarind/, 8, PACK, 200, "200 g pack"),
    R(/peanut butter|tahini|nutella/, 15, PACK, 340, "340 g jar"),
    R(/\b(wine|sherry|beer|rum|brandy|vodka|whiskey|whisky|bourbon|liqueur|tequila)\b/, 30, PACK, 750, "750 ml bottle"),
    R(/\b(jam|jelly|preserves|marmalade)\b/, 15, PACK, 500, "500 g jar"),
    R(/olives/, 15, PACK, 250, "250 g jar"),
    R(/capers/, 3, PACK, 100, "100 g jar"),
    R(/miso/, 15, PACK, 200, "200 g pack"),
    R(/seaweed|\bnori\b|wakame/, 2, PACK, 25, "25 g pack"),
    R(/pickle|achaar|achar|salsa|pesto|chutney/, 15, PACK, 300, "300 g jar"),
    R(/papad|papadum|poppadom/, 10, PACK, 200, "200 g pack"),

    // fats
    R(/ghee/, 10, DAIRY, 500, "500 ml pack"),
    R(/sesame oil/, 4, PACK, 250, "250 ml bottle"),
    R(/olive oil/, 10, PACK, 500, "500 ml bottle"),
    R(/\boil\b/, 10, PACK, 1000, "1 L bottle"),

    // baking and sweeteners (before spices: "baking powder", "cocoa powder")
    R(/baking powder|baking soda|bicarbonate|cream of tartar/, 2, BAKE, 100, "100 g pack"),
    R(/yeast/, 2, BAKE, 25, "25 g pack"),
    R(/gelatin|agar/, 2, BAKE, 25, "25 g pack"),
    R(/cocoa/, 5, BAKE, 100, "100 g pack"),
    R(/chocolate/, 20, BAKE, 100, "100 g bar"),
    R(/vanilla/, 1, BAKE, 20, "20 ml bottle"),
    R(/condensed milk/, 30, DAIRY, 400, "400 g can", "M"),
    R(/milk powder|powdered milk/, 10, DAIRY, 500, "500 g pack"),
    R(/powdered sugar|icing sugar|confectioners/, 15, BAKE, 500, "500 g pack"),
    R(/brown sugar|jaggery|\bgur\b|demerara/, 15, BAKE, 500, "500 g pack"),
    R(/sugar/, 12, BAKE, 1000, "1 kg pack"),
    R(/honey/, 10, BAKE, 250, "250 g bottle"),
    R(/syrup|molasses|treacle/, 15, BAKE, 500, "500 ml bottle"),
    R(/corn ?starch|corn ?flour|arrowroot/, 4, BAKE, 100, "100 g pack"),
    R(/bread ?crumbs|panko/, 15, BREAD, 200, "200 g pack"),

    // spices and dried herbs
    R(/saffron|kesar/, 0.05, SPICE, 1, "1 g box"),
    R(/bay lea/, 0.3, SPICE, 25, "25 g pack"),
    R(/dried (red )?chil|whole red chil|kashmiri (red )?chil|red chil(i|ies|lies) (whole|dried)/, 1, SPICE, 100, "100 g pack"),
    R(/dried (oregano|basil|thyme|rosemary|parsley|mint|dill|sage|marjoram|tarragon)|\boregano\b|italian seasoning|herbes de provence|kasuri methi/, 0.5, SPICE, 50, "50 g pack"),
    R(/powder|\bground (?!beef|pork|lamb|turkey|chicken|meat|almonds|nuts)|masala|seasoning|paprika|cayenne|turmeric|haldi|five[- ]spice|za'?atar|sumac|chaat|amchur|asafoetida|\bhing\b|nutmeg|allspice|red pepper flakes|chil+i flakes|crushed red pepper|garam/, 1.5, SPICE, 100, "100 g pack"),
    R(/pomegranate/, 30, VEG, 250, "loose, 250 g"),
    R(/seeds?\b|cumin|jeera|fenugreek|methi seed|ajwain|carom|kalonji|nigella|caraway/, 1, SPICE, 100, "100 g pack"),
    R(/black pepper|white pepper|^pepper$|salt and pepper|peppercorns?/, 0.7, SPICE, 100, "100 g pack"),
    R(/\bsalt\b/, 3, SPICE, 1000, "1 kg pack"),
    R(/mustard/, 5, PACK, 200, "200 g bottle"),

    // dairy and chilled
    R(/paneer/, 100, DAIRY, 200, "200 g pack", "M"),
    R(/tofu/, 120, DAIRY, 200, "200 g pack", "M"),
    R(/buttermilk|chaas/, 60, DAIRY, 500, "500 ml pack", "M"),
    R(/\bbutter\b/, 10, DAIRY, 100, "100 g pack"),
    R(/cream cheese/, 30, DAIRY, 200, "200 g pack", "M"),
    R(/ice cream/, 80, DAIRY, 500, "500 ml tub", "M"),
    R(/sour cream|heavy cream|whipping cream|light cream|double cream|single cream|\bcream\b|half-and-half|malai/, 30, DAIRY, 250, "250 ml pack", "M"),
    R(/yogh?urt|\bcurd\b|dahi/, 60, DAIRY, 400, "400 g tub", "M"),
    R(/milk/, 100, DAIRY, 500, "500 ml pack", "M"),
    R(/parmesan|pecorino/, 10, DAIRY, 100, "100 g pack"),
    R(/mozzarella/, 50, DAIRY, 200, "200 g pack", "M"),
    R(/cheese|feta|ricotta|gruyere|cheddar|gouda|brie|halloumi/, 30, DAIRY, 200, "200 g pack", "M"),

    // meat, fish and eggs
    R(/egg noodles/, 80, GRAIN, 200, "200 g pack", "M"),
    R(/egg yolks?/, 17, MEAT, 300, "6 eggs", "M", "eggs"),
    R(/egg whites?/, 33, MEAT, 300, "6 eggs", "M", "eggs"),
    R(/\beggs?\b/, 50, MEAT, 300, "6 eggs", "M"),
    R(/bacon/, 40, MEAT, 200, "200 g pack", "M"),
    R(/sausage|chorizo|salami|pepperoni|\bham\b/, 80, MEAT, 250, "250 g pack", "M"),
    R(/ground (beef|pork|lamb|turkey|chicken|meat)|minced|keema|\bmince\b/, 125, MEAT, 500, "500 g pack", "M"),
    R(/chicken|turkey/, 150, MEAT, 500, "500 g pack", "M"),
    R(/mutton|lamb|goat|beef|steak|pork|veal/, 150, MEAT, 500, "500 g pack", "M"),
    R(/shrimp|prawns?|scallops|crab|lobster|squid|calamari|mussels|clams/, 125, MEAT, 250, "250 g pack", "M"),
    R(/tuna/, 80, MEAT, 185, "185 g can", "M"),
    R(/salmon|\bcod\b|tilapia|fish|fillets?|pomfret|rohu|basa|anchov|mackerel|sardine/, 150, MEAT, 500, "500 g pack", "M"),

    R(/tortillas?|pita|naan|bread|\bbuns?\b|\brolls?\b|baguette|croissant|pizza (dough|base|crust)|puff pastry|pastry|crackers|\bwraps?\b|pav\b/, 60, BREAD, 400, "400 g pack", "M"),
    // vegetables and fruit
    R(/garlic/, 5, VEG, 100, "loose, 100 g"),
    R(/ginger/, 5, VEG, 100, "loose, 100 g"),
    R(/cardamom|elaichi|\bcloves?\b|star anise|\bmace\b|cinnamon|dalchini/, 0.5, SPICE, 50, "50 g pack"),
    R(/green chil|chil+ies|chil+i peppers?|chiles|jalapeno|jalapeño|serrano|bird'?s eye|habanero|\bchil+i\b/, 4, VEG, 100, "loose, 100 g"),
    R(/curry lea|kadi patta/, 1, VEG, 50, "bunch, about 50 g"),
    R(/cilantro|coriander lea|fresh coriander|parsley|\bbasil\b|\bmint\b|\bdill\b|chives|kaffir|lemongrass|thyme|rosemary|\bsage\b|tarragon|marjoram/, 4, VEG, 100, "bunch, about 100 g"),
    R(/lemon juice/, 30, VEG, 250, "loose, 250 g", "A", "lemons (for juice)"),
    R(/lime juice/, 30, VEG, 250, "loose, 250 g", "A", "limes (for juice)"),
    R(/\blemons?\b|\blimes?\b|zest/, 30, VEG, 250, "loose, 250 g"),
    R(/green onions?|spring onions?|scallions?/, 10, VEG, 100, "bunch, about 100 g"),
    R(/\bonions?\b|shallots?/, 50, VEG, 250, "loose, 250 g", "M"),
    R(/tomato/, 60, VEG, 250, "loose, 250 g", "M"),
    R(/potato/, 120, VEG, 250, "loose, 250 g", "M"),
    R(/spinach|palak|\bkale\b|greens|fenugreek leaves|methi leaves|lettuce|cabbage|arugula|rocket|chard|bok choy/, 70, VEG, 250, "loose, 250 g", "M"),
    R(/cauliflower|broccoli|eggplant|aubergine|brinjal|okra|bhindi|zucchini|courgette|squash|pumpkin|gourd|cucumber|carrot|beets?\b|beetroot|radish|turnip|\bpeas\b|\bcorn\b|bell peppers?|\b(red|green|yellow|orange) peppers?\b|capsicum|green beans|french beans|string beans|mushroom|celery|leeks?\b|asparagus|avocado|sprouts|fennel bulb|artichoke|\bfennel\b|jackfruit|plantain/, 70, VEG, 250, "loose, 250 g", "M"),
    R(/banana|apple|mango|orange|berries|strawberr|blueberr|raspberr|pineapple|grapes|\bpears?\b|peach|papaya|pomegranate|melon|kiwi|cherries|guava|lychee/, 80, VEG, 500, "loose, 500 g", "M"),

    // rice, flour, pulses, bread
    R(/cooked rice|leftover rice/, 60, GRAIN, 1000, "1 kg pack", "M", "rice"),
    R(/rice noodles|noodles|ramen|vermicelli|sevai|udon|soba/, 80, GRAIN, 200, "200 g pack", "M"),
    R(/rice flour/, 30, GRAIN, 500, "500 g pack", "M"),
    R(/\brice\b|basmati/, 75, GRAIN, 1000, "1 kg pack", "M"),
    R(/spaghetti|penne|pasta|macaroni|fettuccine|linguine|lasagna|orzo|fusilli|rigatoni|couscous/, 85, GRAIN, 500, "500 g pack", "M"),
    R(/whole wheat flour|wholemeal flour|\batta\b|chapati flour/, 70, GRAIN, 1000, "1 kg pack", "M"),
    R(/chickpea flour|gram flour|besan/, 30, GRAIN, 500, "500 g pack", "M"),
    R(/semolina|sooji|suji|\brava\b/, 40, GRAIN, 500, "500 g pack", "M"),
    R(/flour|maida/, 50, GRAIN, 1000, "1 kg pack", "M"),
    R(/\boats\b|oatmeal|quinoa|\bpoha\b|cornmeal|polenta|bulgur|barley|millet/, 40, GRAIN, 500, "500 g pack", "M"),
    R(/lentils?|\bdal\b|daal|toor|moong|masoor|urad|split peas/, 60, GRAIN, 500, "500 g pack", "M"),
    R(/chickpeas|garbanzo|\bchana\b|chole/, 60, GRAIN, 500, "500 g pack", "M"),
    R(/beans/, 60, GRAIN, 500, "500 g pack", "M"),

    // dry fruits and nuts
    R(/cashew|almond|peanut|walnut|pecan|pistachio|hazelnut|pine nut|\bnuts\b|makhana/, 10, DRY, 100, "100 g pack"),
    R(/raisins|sultanas|\bdates\b|dried (apricots|cranberries|figs|fruit)|\bfigs\b|prunes/, 10, DRY, 200, "200 g pack"),
    R(/coconut/, 15, DRY, 200, "200 g pack"),
  ];
  const FALLBACK = R(/./, 40, OTHER, 100, "loose, 100 g");

  // Grams of main components on one normal plate, by course
  const COURSE_TARGET = [
    ["Beverage", 250], ["Soup / stew", 320], ["Salad", 180], ["Dessert", 130], ["Breakfast", 220],
    ["Bread", 100], ["Appetizer", 120], ["Snack", 100], ["Condiment", 40], ["Sauce", 60],
    ["Side dish", 200], ["Main dish", 380],
  ];

  // What goes into common accompaniments, grams per person for a normal portion
  const ACCOMPANIMENTS = {
    "rice": [["basmati rice", 75]],
    "steamed rice": [["basmati rice", 75]],
    "plain rice": [["basmati rice", 75]],
    "jeera rice": [["basmati rice", 75], ["cumin seed", 1], ["ghee", 5]],
    "pulao": [["basmati rice", 75], ["onion", 30], ["peas", 30], ["ghee", 8], ["bay leaves", 0.3]],
    "roti": [["whole wheat flour", 70]],
    "chapati": [["whole wheat flour", 70]],
    "phulka": [["whole wheat flour", 70]],
    "paratha": [["whole wheat flour", 80], ["ghee", 10]],
    "puri": [["whole wheat flour", 60], ["oil", 25]],
    "naan": [["naan", 90]],
    "raita": [["yogurt", 80], ["cucumber", 30], ["ground cumin", 0.5]],
    "salad": [["cucumber", 40], ["tomatoes", 40], ["onion", 30], ["lemons (for juice)", 15]],
    "kachumber": [["cucumber", 40], ["tomatoes", 40], ["onion", 30], ["lemons (for juice)", 15]],
    "green salad": [["lettuce", 40], ["cucumber", 30], ["tomatoes", 30], ["olive oil", 5]],
    "papad": [["papad", 10]],
    "pickle": [["pickle", 10]],
    "green chutney": [["fresh cilantro", 10], ["mint", 5], ["green chilies", 2], ["lemons (for juice)", 5]],
    "dal": [["lentils", 50], ["onion", 20], ["tomatoes", 20], ["ghee", 5], ["cumin seed", 1], ["turmeric", 0.5]],
    "curd": [["yogurt", 100]],
    "dahi": [["yogurt", 100]],
    "lassi": [["yogurt", 150], ["sugar", 15]],
    "chaas": [["yogurt", 100], ["ground cumin", 0.5]],
    "garlic bread": [["bread", 60], ["butter", 8], ["garlic", 3]],
    "bread": [["bread", 60]],
    "dinner rolls": [["dinner rolls", 60]],
    "french fries": [["potatoes", 150], ["oil", 20]],
    "fries": [["potatoes", 150], ["oil", 20]],
    "mashed potatoes": [["potatoes", 150], ["butter", 10], ["milk", 30]],
    "coleslaw": [["cabbage", 60], ["carrot", 20], ["mayonnaise", 15]],
  };
  const ACCOMPANIMENT_PICKS = ["Rice", "Roti", "Naan", "Raita", "Salad", "Papad", "Dal", "Green chutney"];

  const PORTIONS = {
    small: { factor: 0.75, label: "Small", note: "¾ of a normal portion" },
    moderate: { factor: 1, label: "Moderate", note: "a normal portion" },
    big: { factor: 2, label: "Big", note: "double a normal portion" },
  };

  function rule(name) {
    const n = name.toLowerCase();
    return RULES.find(r => r.re.test(n)) || FALLBACK;
  }

  function courseTarget(tags) {
    for (const [tag, g] of COURSE_TARGET) if ((tags || []).includes(tag)) return g;
    return 300;
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /**
   * Build the draft shopping list.
   * recipe: {name, ingredients: [names], tags: [display tags]}
   * opts: {guests, portion: "small"|"moderate"|"big", accompaniments: [names], have: name -> bool}
   */
  function estimate(recipe, opts) {
    const people = Math.max(1, Math.min(500, Math.round(opts.guests || 1)));
    const pf = (PORTIONS[opts.portion] || PORTIONS.moderate).factor;

    // balance the main components of the dish against its course
    const rows = recipe.ingredients.map(name => ({ name, r: rule(name) })).filter(x => x.r.kind !== "S");
    const mainSum = rows.filter(x => x.r.kind === "M").reduce((s, x) => s + x.r.g, 0);
    const balance = mainSum ? Math.min(1.6, Math.max(0.45, courseTarget(recipe.tags) / mainSum)) : 1;

    const items = new Map();
    const add = (name, gramsPerPerson, source, r, fromKitchen) => {
      const display = (r.rename || name).toLowerCase();
      const key = mergeKey(display);
      const grams = gramsPerPerson * people * pf;
      const prev = items.get(key);
      if (prev) {
        prev.need += grams;
        if (!prev.sources.includes(source)) prev.sources.push(source);
        prev.inKitchen = prev.inKitchen || fromKitchen;
      } else {
        items.set(key, {
          id: "i" + items.size,
          name: cap(display),
          need: grams,
          aisle: r.aisle || OTHER,
          pack: r.pack,
          packLabel: r.label,
          loose: /^(loose|bunch)/.test(r.label),
          sources: [source],
          inKitchen: !!fromKitchen,
          checked: true,
          round: false,
        });
      }
    };

    for (const { name, r } of rows) {
      const g = r.kind === "M" ? r.g * balance : r.g;
      add(name, g, recipe.name, r, opts.have && opts.have(name));
    }
    for (const raw of opts.accompaniments || []) {
      const label = raw.trim();
      if (!label) continue;
      const preset = ACCOMPANIMENTS[label.toLowerCase()];
      if (preset) preset.forEach(([n, g]) => add(n, g, cap(label), rule(n), false));
      else add(label.toLowerCase(), 100, cap(label), rule(label), false);
    }

    const list = [...items.values()];
    list.forEach(it => { it.need = tidy(it.need); });
    list.sort((a, b) => AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) || b.need - a.need);
    return { people, portion: opts.portion, items: list };
  }

  // ------------------------------------------------------------------ prices
  // Approximate retail prices in Delhi NCR, rupees per kg (per litre for liquids), October 2026.
  // Calibrated against Delhi government retail surveys and Gurugram meat rates; quick-commerce
  // apps are often 10-30% higher. First match wins, so specific names come before general ones.
  const PRICES_AS_OF = "October 2026";
  const PRICES = [
    // vegetables, herbs, fruit
    [/lemon|lime/, 120], [/garlic/, 300], [/ginger/, 160], [/curry lea/, 300],
    [/cilantro|coriander lea|mint|parsley|basil|dill|chives|thyme|rosemary|lemongrass|kaffir/, 200],
    [/green onion|spring onion|scallion/, 120], [/green chil|jalapeno|chil+ies$|chil+i peppers?|chiles$/, 100],
    [/\bonion|shallot/, 40], [/tomato(es)?$|cherry tomato/, 55], [/potato/, 35],
    [/spinach|palak|methi leaves|fenugreek leaves/, 60], [/cabbage/, 50], [/cauliflower|gobi/, 60],
    [/eggplant|brinjal|aubergine/, 50], [/okra|bhindi/, 80], [/cucumber/, 50], [/carrot/, 60],
    [/\bpeas\b/, 120], [/\bcorn\b/, 90], [/bell pepper|capsicum|(red|green|yellow) pepper/, 120],
    [/green beans|french beans/, 100], [/mushroom/, 300], [/lettuce|arugula|kale/, 250],
    [/broccoli|zucchini|courgette|asparagus|avocado/, 350], [/pumpkin|squash|gourd/, 45],
    [/beet|radish|turnip/, 60], [/banana/, 60], [/apple/, 200], [/pomegranate/, 220],
    [/mango|orange|papaya|pineapple|grapes|guava/, 140], [/berr/, 900],
    // meat, fish, eggs
    [/egg/, 140], [/chicken breast|boneless chicken|chicken (thigh|tender)/, 520], [/chicken|turkey/, 300],
    [/keema|minced|ground (lamb|mutton|meat)/, 850], [/mutton|lamb|goat/, 850], [/ground (beef|pork)|beef|steak|veal/, 450],
    [/pork|bacon|ham|sausage|salami|pepperoni|chorizo/, 900], [/shrimp|prawn/, 750], [/salmon/, 2500],
    [/tuna/, 1100], [/fish|fillet|cod|basa|pomfret|rohu|mackerel|anchov|sardine|crab|squid/, 550],
    // dairy
    [/paneer/, 450], [/tofu/, 400], [/buttermilk|chaas/, 50], [/ghee/, 650], [/\bbutter\b/, 580],
    [/cream cheese/, 950], [/condensed milk/, 400], [/milk powder|powdered milk/, 520], [/ice cream/, 320],
    [/cream|malai|half-and-half/, 300], [/yogh?urt|\bcurd\b|dahi/, 125], [/milk/, 66],
    [/parmesan|pecorino/, 3000], [/mozzarella/, 650], [/cheese|feta|ricotta|cheddar|gouda|halloumi/, 750],
    // rice, flour, pulses, bread
    [/basmati/, 140], [/rice flour/, 80], [/rice noodles|noodles|ramen|vermicelli/, 300], [/rice/, 75],
    [/whole wheat flour|\batta\b/, 52], [/chickpea flour|besan|gram flour/, 120], [/semolina|sooji|suji|rava/, 65],
    [/flour|maida/, 50], [/oats|poha/, 180], [/quinoa/, 650], [/lentil|dal|toor|moong|masoor|urad/, 150],
    [/chickpeas|chana|chole/, 120], [/beans/, 170], [/pasta|spaghetti|penne|macaroni|fusilli|couscous/, 260],
    [/naan/, 330], [/tortilla|pita|wrap/, 400], [/pizza/, 250], [/bread ?crumbs|panko/, 300], [/bread|bun|roll|pav/, 125],
    [/papad/, 400],
    // spices
    [/saffron|kesar/, 300000], [/cardamom|elaichi/, 3500], [/cloves?\b|laung/, 1500], [/star anise|mace/, 1500],
    [/cinnamon|dalchini/, 600], [/bay lea/, 400], [/black pepper|white pepper|^pepper$|peppercorn/, 1000],
    [/garam masala|curry powder|masala/, 800], [/dried (red )?chil|kashmiri/, 450], [/chil+i (powder|flakes)|red pepper flakes|cayenne|paprika/, 450],
    [/turmeric|haldi/, 320], [/ground cumin|cumin powder|jeera powder/, 600], [/cumin|jeera/, 500],
    [/coriander (powder|seed)|ground coriander/, 300], [/mustard seed|rai\b/, 160], [/fenugreek|methi|kasuri/, 300],
    [/fennel|saunf|ajwain|carom|nigella|kalonji|seeds?\b/, 400], [/asafoetida|hing/, 3000],
    [/oregano|italian seasoning|herbes|dried (basil|thyme|rosemary|parsley|mint|dill)/, 1500],
    [/\bsalt\b/, 28], [/seasoning|powder|spice/, 700],
    // oils, sauces, packaged
    [/olive oil/, 950], [/sesame oil/, 900], [/mustard oil/, 190], [/coconut oil/, 350], [/\boil\b/, 165],
    [/coconut (milk|cream)/, 400], [/tomato paste/, 300], [/tomato puree|tomato sauce|passata/, 125],
    [/(canned|crushed|diced) tomato/, 400], [/ketchup/, 200], [/mayonnaise|mayo/, 450],
    [/soy sauce|fish sauce|oyster sauce|hoisin|worcestershire|sriracha|hot sauce|chil+i sauce/, 450],
    [/vinegar/, 130], [/curry paste/, 1500], [/tamarind|imli/, 300], [/peanut butter|tahini/, 550],
    [/broth|stock/, 250], [/bouillon|cube/, 1000], [/wine|sherry|beer|rum|brandy|vodka|whisk|liqueur/, 1600],
    [/pickle|achar|chutney|salsa|pesto/, 450], [/jam|jelly|marmalade|preserves/, 400], [/olive/, 800], [/mustard/, 400],
    // baking and sweeteners
    [/brown sugar|jaggery|gur\b|demerara/, 110], [/powdered sugar|icing sugar/, 130], [/sugar/, 48],
    [/honey/, 600], [/syrup|molasses/, 500], [/baking powder/, 400], [/baking soda|bicarbonate/, 200],
    [/yeast/, 900], [/cocoa/, 1100], [/chocolate/, 1000], [/vanilla/, 3000], [/corn ?starch|corn ?flour/, 220],
    [/gelatin|agar/, 2000],
    // dry fruits and nuts
    [/cashew|almond/, 1050], [/pistachio/, 2200], [/walnut|pecan|hazelnut|pine nut/, 1700], [/peanut/, 180],
    [/raisin|sultana/, 450], [/dates/, 400], [/fig|apricot|cranberr|prune/, 1200], [/coconut/, 400], [/makhana/, 1300],
  ];
  const AISLE_PRICE = { [VEG]: 80, [MEAT]: 500, [DAIRY]: 400, [GRAIN]: 120, [SPICE]: 600, [PACK]: 400,
    [BAKE]: 300, [BREAD]: 200, [DRY]: 900, [OTHER]: 300 };

  /** Rupees per kg for an item name */
  function pricePerKg(name, aisle) {
    const n = name.toLowerCase();
    const hit = PRICES.find(([re]) => re.test(n));
    return hit ? hit[1] : AISLE_PRICE[aisle] || 300;
  }
  /** Estimated rupees for a number of grams of an item, rounded to the rupee */
  function cost(name, aisle, grams) {
    return Math.max(grams > 0 ? 1 : 0, Math.round((grams / 1000) * pricePerKg(name, aisle)));
  }

  // "plain yogurt" and "yogurt", "onions" and "onion" end up on one line
  const DESCRIPTORS = new Set(["fresh", "plain", "unsalted", "salted", "boneless", "skinless", "large", "small",
    "medium", "chopped", "diced", "sliced", "minced", "whole", "raw", "organic", "low-fat", "lowfat", "full-fat",
    "natural", "regular", "cold", "warm", "frozen", "ripe"]);
  function mergeKey(name) {
    return name.split(/\s+/).filter(w => !DESCRIPTORS.has(w))
      .map(w => w.replace(/(oes|ies|s)$/, m => (m === "ies" ? "y" : m === "oes" ? "o" : ""))).join(" ") || name;
  }

  /** Round an estimate to a sensible shopping figure, in grams */
  function tidy(g) {
    if (g <= 0) return 0;
    if (g < 1) return Math.round(g * 10) / 10;
    if (g < 20) return Math.round(g);
    if (g < 200) return Math.round(g / 5) * 5;
    return Math.round(g / 10) * 10;
  }

  /** What to buy for an item: grams, and how it's packed */
  function buy(it) {
    if (!it.round || !it.pack) return { grams: it.need, text: "" };
    const n = Math.max(1, Math.ceil(it.need / it.pack - 1e-9));
    const grams = n * it.pack;
    if (/^bunch/.test(it.packLabel)) return { grams, text: `${n} bunch${n > 1 ? "es" : ""}` };
    if (it.loose) return { grams, text: `loose, in ${it.pack} g steps` };
    if (/eggs$/.test(it.packLabel)) return { grams, text: `${n * parseInt(it.packLabel, 10)} eggs` };
    return { grams, text: `${n} × ${it.packLabel}` };
  }

  window.Quantities = { estimate, buy, tidy, rule, cost, pricePerKg, PRICES_AS_OF, PORTIONS, ACCOMPANIMENT_PICKS,
    ACCOMPANIMENTS, AISLE_ORDER };
})();
