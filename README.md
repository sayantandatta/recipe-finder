# Recipe Finder

Tell it what's in your kitchen and get 20 recipes you can cook, drawn from the Food.com recipe collection
(about 231,000 recipes). Each result links back to the recipe on Food.com and shows its ingredients,
cuisine, cooking time, rating, tags and the full method.

## How it works

The form has three columns:

- **Ingredients**: one per line, with a button to add more lines. Indian and British names are understood
  (aloo, pyaz, paneer, palak, aubergine, courgette, prawns…), and each line shows which recipe ingredients
  it matched.
- **Spices**: type and press Enter, or tap one of the common spices. Jeera, haldi, dhania and similar work.
- **Cuisines**: pick any number. A recipe qualifies if it belongs to any of them. Leave empty for all.

Three ways to match:

| Option | A recipe is shown when… | Ranked by |
|---|---|---|
| Only what I have | it needs nothing beyond your ingredients, spices and pantry staples | how many of your ingredients it uses, then rating |
| A few more | it uses all your ingredients and needs at most N extra (N = 1–10, default 10) | fewest extras, then rating |
| Anything with these | it uses all your ingredients, with any number of extras | rating and review count |

Spices count as "already in the kitchen" but aren't required. Water, salt, pepper and oil count as staples
unless you switch that off. If fewer than 20 recipes qualify, the list is topped up with close matches that
use most of your ingredients, under a separate heading. The search is encoded in the page URL, so a results
page can be bookmarked or shared.

## Shopping lists

Every recipe has a **Make a shopping list** button, which opens three steps:

1. **Setup**: number of guests, portion size (Small = 0.75 ×, Moderate = 1 ×, Big = 2 × a normal portion)
   and any accompaniments, one per line. Common ones (rice, roti, naan, raita, salad, dal, papad and others)
   are broken down into their ingredients.
2. **Draft**: a checklist grouped by shop aisle, with every item ticked. Untick what you don't need, change
   any quantity, add your own items, and round any item (or everything) up to the pack sizes sold in Indian
   shops: loose vegetables in 250 g steps, herbs by the bunch, paneer in 200 g packs, spices in 100 g packs,
   rice and atta in 1 kg packs, and so on.
3. **Final list**: only the ticked items, in grams, with **Download PDF**, **Download Excel** and **Print**.

Food.com's data lists ingredients without amounts, so quantities are estimates. Each ingredient type has a
typical grams-per-person figure for a normal portion. The dish's main components are scaled together so a
plate adds up to a sensible weight for its course (a main dish is about 380 g a head). Spices, oils and
aromatics stay at fixed small amounts. The rules and pack sizes are in `assets/quantities.js` if you want to
tune them. Liquids are counted at 1 ml = 1 g.

## How it's built

Everything runs in the browser. There is no server or database to maintain. `scripts/build_index.py`
turns the dataset into a compact binary index (about 6 MB, 3 MB compressed) that the page scans in
roughly 50 ms, and about 1,000 small JSON files of recipe details that are fetched only for the dishes shown.

## Deploy to GitHub Pages

1. Create a new repository (for example `recipe-finder`) and upload the contents of this folder.
2. Get a Kaggle API token: kaggle.com > Settings > API > **Create New Token**. This downloads
   `kaggle.json` with your username and key.
3. In the repository: **Settings > Secrets and variables > Actions > New repository secret**. Add
   `KAGGLE_USERNAME` and `KAGGLE_KEY` with the values from `kaggle.json`.
4. **Settings > Pages > Build and deployment > Source**: choose **GitHub Actions**.
5. **Actions > Build and deploy > Run workflow**. The first run takes about 5 minutes. The site appears at
   `https://<your-username>.github.io/recipe-finder/`.

Without the Kaggle secrets the workflow still publishes the site using 32 sample recipes, with a banner
saying so.

## Build locally instead

```bash
# Download RAW_recipes.csv and RAW_interactions.csv from
# https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions
python scripts/build_index.py RAW_recipes.csv RAW_interactions.csv --out data
python -m http.server 8000     # then open http://localhost:8000
```

Only Python's standard library is needed. To try it without the dataset:

```bash
python scripts/make_sample.py sample
python scripts/build_index.py sample/RAW_recipes.csv sample/RAW_interactions.csv --demo --shards 8 --min-cuisine 1
```

## Data notes

- The dataset was collected from Food.com and covers recipes posted up to 2018. Check the dataset's terms
  on Kaggle before using the site commercially.
- Cuisine comes from Food.com's own tags. Not every recipe carries one, so choosing a cuisine narrows
  results to recipes tagged with it.
- Matching is word-based. "Chicken" matches "chicken breasts" and "chicken broth"; "oil" matches every oil.
  The line under each ingredient shows exactly what it matched.
- therecipelibrary.co isn't included yet. If an export of its recipes becomes available, it can be merged
  in by converting it to the same CSV columns as `RAW_recipes.csv`.
