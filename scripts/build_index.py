#!/usr/bin/env python3
"""
Build the static recipe index for Recipe Finder from the Food.com dataset.

Input  : RAW_recipes.csv  (required)  - Kaggle "Food.com Recipes and User Interactions"
         RAW_interactions.csv (optional) - adds ratings / review counts for ranking
Output : data/meta.json      - cuisines, staples, counts, build info
         data/vocab.json     - ingredient vocabulary (id = position), frequency, spice flag
         data/match.bin      - compact binary index the browser scans to match recipes
         data/recipes/NNN.json - recipe details (name, ingredients, steps, tags...) in shards

Usage  : python scripts/build_index.py RAW_recipes.csv [RAW_interactions.csv] [--out data]
                                       [--shards 1000] [--min-cuisine 20] [--limit N]

Standard library only - no pip install needed.
"""
import argparse
import ast
import csv
import json
import math
import os
import re
import shutil
import struct
import sys
import time
from collections import Counter, defaultdict

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

# ---------------------------------------------------------------------------
# Cuisine tags used by Food.com  ->  display label
# Only those present with at least --min-cuisine recipes end up in the app.
# ---------------------------------------------------------------------------
CUISINES = {
    # Broad regions
    "african": "African", "asian": "Asian", "european": "European",
    "middle-eastern": "Middle Eastern", "caribbean": "Caribbean",
    "south-american": "South American", "central-american": "Central American",
    "north-american": "North American", "scandinavian": "Scandinavian",
    "pacific-northwest": "Pacific Northwest",
    # South Asia
    "indian": "Indian", "pakistani": "Pakistani", "nepalese": "Nepalese",
    "sri-lankan": "Sri Lankan",
    # East & South-East Asia
    "chinese": "Chinese", "japanese": "Japanese", "korean": "Korean",
    "thai": "Thai", "vietnamese": "Vietnamese", "indonesian": "Indonesian",
    "malaysian": "Malaysian", "filipino": "Filipino", "cambodian": "Cambodian",
    "laotian": "Laotian", "mongolian": "Mongolian", "polynesian": "Polynesian",
    "hawaiian": "Hawaiian",
    # Middle East & Africa
    "lebanese": "Lebanese", "turkish": "Turkish", "iranian-persian": "Persian",
    "iraqi": "Iraqi", "palestinian": "Palestinian", "saudi-arabian": "Saudi Arabian",
    "egyptian": "Egyptian", "moroccan": "Moroccan", "ethiopian": "Ethiopian",
    "nigerian": "Nigerian", "south-african": "South African", "sudanese": "Sudanese",
    "somalian": "Somali", "libyan": "Libyan", "angolan": "Angolan",
    "georgian": "Georgian",
    # Europe
    "italian": "Italian", "french": "French", "greek": "Greek", "spanish": "Spanish",
    "portuguese": "Portuguese", "german": "German", "austrian": "Austrian",
    "swiss": "Swiss", "belgian": "Belgian", "dutch": "Dutch", "english": "English",
    "irish": "Irish", "scottish": "Scottish", "welsh": "Welsh", "polish": "Polish",
    "russian": "Russian", "hungarian": "Hungarian", "czech": "Czech",
    "danish": "Danish", "swedish": "Swedish", "norwegian": "Norwegian",
    "finnish": "Finnish", "icelandic": "Icelandic",
    # Americas & Oceania
    "american": "American", "southern-united-states": "Southern US",
    "southwestern-united-states": "Southwestern US",
    "northeastern-united-states": "Northeastern US", "midwestern": "Midwestern US",
    "californian": "Californian", "cajun": "Cajun", "creole": "Creole",
    "tex-mex": "Tex-Mex", "amish-mennonite": "Amish & Mennonite",
    "native-american": "Native American", "canadian": "Canadian",
    "quebec": "Québécois", "mexican": "Mexican", "cuban": "Cuban",
    "puerto-rican": "Puerto Rican", "guatemalan": "Guatemalan",
    "costa-rican": "Costa Rican", "honduran": "Honduran", "brazilian": "Brazilian",
    "argentine": "Argentine", "peruvian": "Peruvian", "chilean": "Chilean",
    "colombian": "Colombian", "ecuadorean": "Ecuadorian", "venezuelan": "Venezuelan",
    "australian": "Australian", "new-zealand": "New Zealand",
}

# Tags worth showing on a recipe card (course, diet, effort, time)
DISPLAY_TAGS = {
    "main-dish": "Main dish", "side-dishes": "Side dish", "appetizers": "Appetizer",
    "desserts": "Dessert", "breakfast": "Breakfast", "brunch": "Brunch",
    "lunch": "Lunch", "dinner-party": "Dinner party", "snacks": "Snack",
    "soups-stews": "Soup / stew", "salads": "Salad", "beverages": "Beverage",
    "breads": "Bread", "condiments-etc": "Condiment", "sauces": "Sauce",
    "curries": "Curry", "rice": "Rice dish", "pasta": "Pasta",
    "vegetarian": "Vegetarian", "vegan": "Vegan", "gluten-free": "Gluten-free",
    "low-carb": "Low-carb", "low-fat": "Low-fat", "low-sodium": "Low-sodium",
    "low-calorie": "Low-calorie", "high-protein": "High-protein",
    "healthy": "Healthy", "kosher": "Kosher", "egg-free": "Egg-free",
    "dairy-free": "Dairy-free", "nut-free": "Nut-free", "diabetic": "Diabetic-friendly",
    "easy": "Easy", "beginner-cook": "Beginner", "one-dish-meal": "One-pot",
    "kid-friendly": "Kid-friendly", "make-ahead": "Make-ahead",
    "15-minutes-or-less": "≤15 min", "30-minutes-or-less": "≤30 min",
    "60-minutes-or-less": "≤60 min", "4-hours-or-less": "≤4 hrs",
}

# Ingredients treated as "always in the pantry" when the user leaves the staples switch on
STAPLES = [
    "water", "ice", "ice cubes", "salt", "pepper", "black pepper", "salt and pepper",
    "kosher salt", "sea salt", "fresh ground black pepper", "ground black pepper",
    "fresh ground pepper", "oil", "vegetable oil", "olive oil", "canola oil",
    "cooking oil", "cooking spray", "nonstick cooking spray",
]

# Words that mark an ingredient as a spice / herb / seasoning (for the spices column)
SPICE_WORDS = [
    "cumin", "turmeric", "coriander", "paprika", "chili powder", "chile powder",
    "cayenne", "cinnamon", "nutmeg", "mace", "clove", "cardamom", "garam masala",
    "curry powder", "curry paste", "masala", "oregano", "basil", "thyme", "rosemary",
    "bay leaf", "bay leaves", "sage", "dill", "parsley", "cilantro", "mint",
    "fennel seed", "mustard seed", "fenugreek", "asafoetida", "saffron", "star anise",
    "anise", "allspice", "ground ginger", "ginger powder", "garlic powder",
    "onion powder", "peppercorn", "red pepper flakes", "chili flakes",
    "crushed red pepper", "five-spice", "five spice", "za'atar", "zaatar", "sumac",
    "italian seasoning", "seasoning", "old bay", "cajun", "creole seasoning",
    "taco seasoning", "herbes de provence", "tarragon", "marjoram", "chives",
    "nigella", "kalonji", "ajwain", "carom", "amchur", "chaat", "caraway",
    "celery seed", "poppy seed", "sesame seed", "juniper", "lemongrass",
    "kaffir lime", "curry leaves", "chipotle", "ancho", "smoked paprika",
    "white pepper", "black pepper", "jerk", "ras el hanout", "harissa",
    "berbere", "dukkah", "pumpkin pie spice", "apple pie spice", "vanilla",
    "spice", "dried red chilies", "dried red chili", "dried red chiles", "dried chilies",
    "kashmiri", "hing", "methi",
]

STEP_FIX = re.compile(r"\s+([,.;:!?)])")


def title_case(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    small = {"and", "or", "with", "in", "of", "a", "an", "the", "for", "on", "to", "de", "la", "al"}
    words = name.split(" ")
    out = []
    for i, w in enumerate(words):
        if i and w in small:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def clean_step(s: str) -> str:
    s = STEP_FIX.sub(r"\1", s.strip())
    s = re.sub(r"\(\s+", "(", s)
    return s[:1].upper() + s[1:] if s else s


def parse_list(raw: str):
    try:
        v = ast.literal_eval(raw)
        return v if isinstance(v, list) else []
    except Exception:
        return []


def is_spice(name: str) -> bool:
    if "garlic" in name and "powder" not in name:  # "garlic cloves" is not a spice
        return False
    n = " " + name + " "
    return any(re.search(r"(?<![a-z])" + re.escape(w) + r"s?(?![a-z])", n) for w in SPICE_WORDS)


def load_ratings(path):
    """recipe_id -> (number of reviews, average star rating)."""
    count, total, rated = Counter(), Counter(), Counter()
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            try:
                rid = int(row["recipe_id"])
                r = int(float(row["rating"] or 0))
            except (KeyError, ValueError):
                continue
            count[rid] += 1
            if r > 0:  # 0 = review without a star rating
                total[rid] += r
                rated[rid] += 1
    return {rid: (count[rid], total[rid] / rated[rid] if rated[rid] else 0.0) for rid in count}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("recipes", help="path to RAW_recipes.csv")
    ap.add_argument("interactions", nargs="?", help="optional path to RAW_interactions.csv")
    ap.add_argument("--out", default="data", help="output folder (default: data)")
    ap.add_argument("--shards", type=int, default=1000, help="number of recipe detail files")
    ap.add_argument("--min-cuisine", type=int, default=20, help="min recipes for a cuisine to be listed")
    ap.add_argument("--limit", type=int, default=0, help="only read the first N recipes (testing)")
    ap.add_argument("--no-description", action="store_true", help="drop descriptions to save space")
    ap.add_argument("--demo", action="store_true", help="mark the output as sample data (app shows a banner)")
    args = ap.parse_args()

    t0 = time.time()
    ratings = {}
    if args.interactions:
        print(f"Reading ratings from {args.interactions} ...")
        ratings = load_ratings(args.interactions)
        print(f"  {len(ratings):,} recipes have reviews")

    print(f"Reading recipes from {args.recipes} ...")
    recipes = []
    ing_freq = Counter()
    cui_freq = Counter()
    seen = set()
    with open(args.recipes, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            try:
                rid = int(row["id"])
            except (KeyError, ValueError):
                continue
            name = (row.get("name") or "").strip()
            ings = [re.sub(r"\s+", " ", i).strip().lower() for i in parse_list(row.get("ingredients", ""))]
            ings = list(dict.fromkeys(i for i in ings if i))  # dedupe, keep order
            if not name or not ings or rid in seen:
                continue
            seen.add(rid)
            tags = [t.strip().lower() for t in parse_list(row.get("tags", ""))]
            cuis = [t for t in tags if t in CUISINES]
            steps = [clean_step(str(s)) for s in parse_list(row.get("steps", "")) if str(s).strip()]
            nut = parse_list(row.get("nutrition", ""))
            try:
                minutes = int(float(row.get("minutes") or 0))
            except ValueError:
                minutes = 0
            recipes.append({
                "id": rid, "name": name, "ings": ings, "cuis": cuis, "tags": tags,
                "steps": steps, "minutes": minutes,
                "desc": "" if args.no_description else (row.get("description") or "").strip(),
                "cal": round(float(nut[0])) if nut else None,
            })
            ing_freq.update(ings)
            cui_freq.update(cuis)
            if args.limit and len(recipes) >= args.limit:
                break
    print(f"  {len(recipes):,} recipes, {len(ing_freq):,} distinct ingredients")

    # ---- vocabulary: id by descending frequency --------------------------------
    vocab = [w for w, _ in ing_freq.most_common()]
    if len(vocab) > 65535:
        sys.exit("More than 65,535 distinct ingredients - widen the index to 32-bit ids.")
    vid = {w: i for i, w in enumerate(vocab)}

    cuisine_keys = sorted((k for k, c in cui_freq.items() if c >= args.min_cuisine),
                          key=lambda k: CUISINES[k])
    if len(cuisine_keys) > 255:
        sys.exit("Too many cuisines for an 8-bit id.")
    cid = {k: i for i, k in enumerate(cuisine_keys)}

    # ---- binary match index ----------------------------------------------------
    n = len(recipes)
    ids, reviews, refs, rating, ing_count, cui_count, cui_refs = [], [], [], [], [], [], []
    for r in recipes:
        nrev, avg = ratings.get(r["id"], (0, 0.0))
        r["nrev"], r["rating"] = nrev, round(avg, 2)
        ids.append(r["id"])
        reviews.append(min(nrev, 65535))
        rating.append(min(100, round(avg * 20)))
        ing_ids = [vid[i] for i in r["ings"]][:255]
        refs.extend(ing_ids)
        ing_count.append(len(ing_ids))
        cs = [cid[c] for c in r["cuis"] if c in cid][:255]
        cui_refs.extend(cs)
        cui_count.append(len(cs))

    out = args.out
    os.makedirs(out, exist_ok=True)
    shard_dir = os.path.join(out, "recipes")
    if os.path.isdir(shard_dir):
        shutil.rmtree(shard_dir)
    os.makedirs(shard_dir)

    with open(os.path.join(out, "match.bin"), "wb") as fh:
        fh.write(b"RCP1")
        fh.write(struct.pack("<III", n, len(refs), len(cui_refs)))
        fh.write(struct.pack(f"<{n}I", *ids))
        fh.write(struct.pack(f"<{n}H", *reviews))
        fh.write(struct.pack(f"<{len(refs)}H", *refs))
        fh.write(bytes(rating))
        fh.write(bytes(ing_count))
        fh.write(bytes(cui_count))
        fh.write(bytes(cui_refs))

    # ---- vocabulary ------------------------------------------------------------
    with open(os.path.join(out, "vocab.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "names": vocab,
            "freq": [ing_freq[w] for w in vocab],
            "spice": [i for i, w in enumerate(vocab) if is_spice(w)],
        }, fh, separators=(",", ":"), ensure_ascii=False)

    # ---- recipe detail shards -------------------------------------------------
    shards = defaultdict(dict)
    for r in recipes:
        detail = {
            "n": title_case(r["name"]),
            "m": r["minutes"],
            "i": r["ings"],
            "s": r["steps"],
            "t": [DISPLAY_TAGS[t] for t in r["tags"] if t in DISPLAY_TAGS],
        }
        if r["desc"]:
            detail["d"] = r["desc"][:600]
        if r["cal"] is not None:
            detail["c"] = r["cal"]
        if r["nrev"]:
            detail["r"] = [r["nrev"], r["rating"]]
        detail["u"] = re.sub(r"[^a-z0-9]+", "-", r["name"].lower()).strip("-")
        shards[r["id"] % args.shards][r["id"]] = detail
    for k, recs in shards.items():
        with open(os.path.join(shard_dir, f"{k}.json"), "w", encoding="utf-8") as fh:
            json.dump(recs, fh, separators=(",", ":"), ensure_ascii=False)

    # ---- meta ------------------------------------------------------------------
    meta = {
        "version": 1,
        "built": time.strftime("%Y-%m-%d"),
        "source": "Food.com (Kaggle: Food.com Recipes and User Interactions)",
        "recipes": n,
        "ingredients": len(vocab),
        "shards": args.shards,
        "hasRatings": bool(ratings),
        "demo": args.demo,
        "cuisines": [{"key": k, "label": CUISINES[k], "count": cui_freq[k]} for k in cuisine_keys],
        "staples": [s for s in STAPLES if s in vid],
    }
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=1, ensure_ascii=False)

    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    print(f"Wrote {out}/ : {n:,} recipes, {len(cuisine_keys)} cuisines, "
          f"match.bin {os.path.getsize(os.path.join(out, 'match.bin')) / 1e6:.1f} MB, "
          f"total {size / 1e6:.1f} MB in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
