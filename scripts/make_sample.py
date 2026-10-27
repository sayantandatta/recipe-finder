#!/usr/bin/env python3
"""
Write a small sample RAW_recipes.csv + RAW_interactions.csv in the same format as the
Food.com Kaggle dataset, so the app can be previewed and tested before the real data is built.

    python scripts/make_sample.py sample
    python scripts/build_index.py sample/RAW_recipes.csv sample/RAW_interactions.csv --demo

The recipes are short illustrative write-ups, not copies of Food.com recipes.
"""
import csv
import os
import random
import sys

R = [
    # name, minutes, tags, ingredients, steps
    ("jeera aloo", 25, ["indian", "asian", "side-dishes", "vegetarian", "vegan", "easy", "30-minutes-or-less"],
     ["potatoes", "cumin seed", "turmeric", "green chilies", "fresh cilantro", "vegetable oil", "salt", "lemon juice"],
     ["boil the potatoes until just tender , then peel and cube", "heat oil and add cumin seed until it splutters",
      "add green chilies and turmeric , then the potatoes", "season with salt , toss for 5 minutes until golden",
      "finish with lemon juice and cilantro"]),
    ("chicken tikka masala", 70, ["indian", "asian", "main-dish", "curries", "high-protein", "4-hours-or-less"],
     ["boneless skinless chicken breasts", "plain yogurt", "garam masala", "ground cumin", "turmeric", "garlic",
      "fresh ginger", "onion", "tomato puree", "heavy cream", "butter", "salt", "fresh cilantro"],
     ["marinate chicken in yogurt , half the spices , garlic and ginger for 30 minutes",
      "grill or pan-sear the chicken until charred", "soften onion in butter , add remaining spices",
      "add tomato puree and simmer 10 minutes", "stir in cream and chicken , simmer 10 minutes", "garnish with cilantro"]),
    ("dal tadka", 45, ["indian", "asian", "main-dish", "vegetarian", "vegan", "gluten-free", "60-minutes-or-less"],
     ["yellow lentils", "water", "turmeric", "onion", "tomatoes", "garlic", "cumin seed", "dried red chilies",
      "ghee", "salt", "fresh cilantro"],
     ["rinse lentils and simmer in water with turmeric until soft", "heat ghee , add cumin seed and dried chilies",
      "add onion , garlic and tomatoes and cook down", "pour the tadka over the dal , season and simmer 5 minutes",
      "garnish with cilantro"]),
    ("palak paneer", 40, ["indian", "asian", "main-dish", "vegetarian", "gluten-free", "60-minutes-or-less"],
     ["fresh spinach", "paneer", "onion", "tomatoes", "garlic", "fresh ginger", "green chilies", "garam masala",
      "ground cumin", "heavy cream", "vegetable oil", "salt"],
     ["blanch spinach and blend to a puree", "fry paneer cubes until golden and set aside",
      "cook onion , garlic , ginger and chilies , then tomatoes and spices", "add spinach puree and simmer 5 minutes",
      "stir in cream and paneer"]),
    ("chana masala", 50, ["indian", "asian", "main-dish", "vegetarian", "vegan", "60-minutes-or-less"],
     ["chickpeas", "onion", "tomatoes", "garlic", "fresh ginger", "green chilies", "ground coriander", "ground cumin",
      "garam masala", "turmeric", "vegetable oil", "salt", "lemon juice"],
     ["saute onion until brown , add garlic , ginger and chilies", "add tomatoes and spices and cook to a paste",
      "add chickpeas with a little water and simmer 20 minutes", "finish with lemon juice"]),
    ("egg curry", 35, ["indian", "asian", "main-dish", "curries", "gluten-free", "60-minutes-or-less"],
     ["eggs", "onion", "tomatoes", "garlic", "fresh ginger", "turmeric", "chili powder", "garam masala",
      "vegetable oil", "salt", "fresh cilantro"],
     ["hard boil the eggs , peel and score them", "fry onion , garlic and ginger until golden",
      "add tomatoes and spices and cook until oil separates", "add eggs and a cup of water , simmer 10 minutes"]),
    ("potato and egg hash", 30, ["american", "north-american", "breakfast", "easy", "30-minutes-or-less"],
     ["potatoes", "eggs", "onion", "butter", "paprika", "salt", "pepper"],
     ["dice potatoes and fry in butter until crisp", "add onion and paprika and cook 5 minutes",
      "make wells and crack in the eggs , cover until set", "season and serve"]),
    ("spanish tortilla", 45, ["spanish", "european", "main-dish", "vegetarian", "gluten-free", "60-minutes-or-less"],
     ["potatoes", "eggs", "onion", "olive oil", "salt"],
     ["slice potatoes and onion thinly and poach in olive oil until soft", "drain and fold into beaten eggs with salt",
      "cook in a skillet over low heat until almost set", "flip onto a plate and slide back to finish"]),
    ("aloo paratha", 50, ["indian", "asian", "breakfast", "breads", "vegetarian", "60-minutes-or-less"],
     ["whole wheat flour", "potatoes", "green chilies", "fresh cilantro", "cumin seed", "garam masala", "ghee",
      "salt", "water"],
     ["knead flour , salt and water to a soft dough and rest", "mash boiled potatoes with chilies , cilantro and spices",
      "stuff dough balls with filling and roll out", "cook on a hot griddle with ghee until spotted on both sides"]),
    ("tomato rice", 30, ["indian", "asian", "main-dish", "rice", "vegetarian", "vegan", "30-minutes-or-less"],
     ["basmati rice", "tomatoes", "onion", "mustard seeds", "curry leaves", "green chilies", "turmeric",
      "vegetable oil", "salt", "water"],
     ["cook rice and spread to cool", "temper mustard seeds and curry leaves in oil",
      "add onion , chilies , tomatoes and turmeric and cook down", "fold in the rice and season"]),
    ("vegetable fried rice", 25, ["chinese", "asian", "main-dish", "rice", "vegetarian", "30-minutes-or-less"],
     ["cooked rice", "eggs", "frozen peas and carrots", "green onions", "garlic", "soy sauce", "sesame oil",
      "vegetable oil"],
     ["scramble eggs in a hot wok and set aside", "stir fry garlic and vegetables",
      "add rice and toss on high heat", "add soy sauce , sesame oil , eggs and green onions"]),
    ("kung pao chicken", 35, ["chinese", "asian", "main-dish", "60-minutes-or-less"],
     ["boneless skinless chicken breasts", "soy sauce", "rice vinegar", "sugar", "cornstarch", "dried red chilies",
      "garlic", "fresh ginger", "unsalted peanuts", "green onions", "vegetable oil"],
     ["toss diced chicken with soy sauce and cornstarch", "mix soy sauce , vinegar , sugar and cornstarch for the sauce",
      "stir fry chilies , garlic and ginger , then chicken until cooked", "add sauce , peanuts and green onions"]),
    ("garlic butter shrimp", 15, ["american", "north-american", "main-dish", "easy", "15-minutes-or-less", "low-carb"],
     ["shrimp", "butter", "garlic", "lemon juice", "fresh parsley", "red pepper flakes", "salt"],
     ["melt butter and cook garlic and pepper flakes 1 minute", "add shrimp and cook 2 minutes per side",
      "finish with lemon juice and parsley"]),
    ("prawn malai curry", 40, ["indian", "asian", "main-dish", "curries", "gluten-free", "60-minutes-or-less"],
     ["shrimp", "coconut milk", "onion", "garlic", "fresh ginger", "turmeric", "chili powder", "garam masala",
      "bay leaves", "mustard oil", "sugar", "salt"],
     ["rub shrimp with turmeric and salt and sear briefly", "fry bay leaves , onion , garlic and ginger in mustard oil",
      "add spices , then coconut milk and a pinch of sugar", "return shrimp and simmer 5 minutes"]),
    ("macher jhol", 45, ["indian", "asian", "main-dish", "curries", "gluten-free", "60-minutes-or-less"],
     ["fish fillets", "potatoes", "tomatoes", "turmeric", "ground cumin", "nigella seeds", "green chilies",
      "mustard oil", "salt", "fresh cilantro", "water"],
     ["rub fish with turmeric and salt and shallow fry", "fry potato wedges in the same oil",
      "temper nigella seeds and chilies , add tomatoes and spices", "add water , potatoes and fish and simmer 15 minutes"]),
    ("margherita pizza", 40, ["italian", "european", "main-dish", "vegetarian", "60-minutes-or-less"],
     ["pizza dough", "tomato sauce", "fresh mozzarella cheese", "fresh basil", "olive oil", "salt"],
     ["heat oven as hot as it goes", "stretch dough and spread with tomato sauce",
      "top with torn mozzarella and bake 10 minutes", "finish with basil and olive oil"]),
    ("spaghetti aglio e olio", 20, ["italian", "european", "main-dish", "vegetarian", "vegan", "easy",
                                    "30-minutes-or-less"],
     ["spaghetti", "garlic", "olive oil", "red pepper flakes", "fresh parsley", "salt"],
     ["cook spaghetti in salted water", "gently fry sliced garlic and pepper flakes in olive oil",
      "toss pasta with the oil , a splash of pasta water and parsley"]),
    ("penne arrabbiata", 30, ["italian", "european", "main-dish", "pasta", "vegetarian", "vegan", "30-minutes-or-less"],
     ["penne pasta", "canned tomatoes", "garlic", "red pepper flakes", "olive oil", "fresh basil", "salt"],
     ["cook penne", "fry garlic and pepper flakes in oil , add tomatoes and simmer 15 minutes",
      "toss with pasta and basil"]),
    ("caprese salad", 10, ["italian", "european", "salads", "vegetarian", "gluten-free", "easy", "15-minutes-or-less"],
     ["tomatoes", "fresh mozzarella cheese", "fresh basil", "olive oil", "balsamic vinegar", "salt", "pepper"],
     ["slice tomatoes and mozzarella", "layer with basil", "drizzle with oil and vinegar and season"]),
    ("chicken fajitas", 35, ["mexican", "tex-mex", "north-american", "main-dish", "60-minutes-or-less"],
     ["boneless skinless chicken breasts", "green bell pepper", "red bell pepper", "onion", "chili powder",
      "ground cumin", "garlic powder", "lime juice", "flour tortillas", "vegetable oil", "salt"],
     ["slice chicken and toss with spices , lime and oil", "sear chicken in a hot skillet and remove",
      "cook peppers and onion until charred", "return chicken and serve in warm tortillas"]),
    ("black bean tacos", 20, ["mexican", "north-american", "main-dish", "vegetarian", "easy", "30-minutes-or-less"],
     ["black beans", "corn tortillas", "onion", "ground cumin", "chili powder", "avocado", "lime juice",
      "fresh cilantro", "salt"],
     ["simmer beans with onion and spices and mash lightly", "warm tortillas",
      "fill with beans , avocado , cilantro and lime"]),
    ("guacamole", 10, ["mexican", "north-american", "appetizers", "vegetarian", "vegan", "gluten-free", "easy",
                        "15-minutes-or-less"],
     ["avocados", "lime juice", "onion", "tomatoes", "jalapeno", "fresh cilantro", "salt"],
     ["mash avocados with lime juice", "fold in diced onion , tomato , jalapeno and cilantro", "season with salt"]),
    ("thai green curry", 40, ["thai", "asian", "main-dish", "curries", "gluten-free", "60-minutes-or-less"],
     ["boneless skinless chicken breasts", "green curry paste", "coconut milk", "fish sauce", "brown sugar",
      "eggplant", "fresh basil", "kaffir lime leaves", "vegetable oil"],
     ["fry curry paste in oil until fragrant", "add coconut milk and bring to a simmer",
      "add chicken , eggplant and lime leaves and cook 15 minutes", "season with fish sauce and sugar , add basil"]),
    ("pad thai", 30, ["thai", "asian", "main-dish", "30-minutes-or-less"],
     ["rice noodles", "shrimp", "eggs", "bean sprouts", "green onions", "fish sauce", "tamarind paste", "brown sugar",
      "unsalted peanuts", "lime", "vegetable oil"],
     ["soak noodles until pliable", "mix fish sauce , tamarind and sugar", "stir fry shrimp , push aside and scramble eggs",
      "add noodles and sauce and toss", "add sprouts , green onions and peanuts , serve with lime"]),
    ("miso soup", 15, ["japanese", "asian", "soups-stews", "vegetarian", "15-minutes-or-less", "low-calorie"],
     ["water", "miso paste", "tofu", "dried seaweed", "green onions"],
     ["heat water to a bare simmer", "whisk in miso", "add tofu and seaweed and warm through", "top with green onions"]),
    ("greek salad", 15, ["greek", "european", "salads", "vegetarian", "gluten-free", "easy", "15-minutes-or-less"],
     ["tomatoes", "cucumber", "red onion", "kalamata olives", "feta cheese", "dried oregano", "olive oil",
      "red wine vinegar", "salt"],
     ["chop tomatoes , cucumber and onion", "add olives and a slab of feta",
      "dress with oil , vinegar , oregano and salt"]),
    ("shakshuka", 30, ["middle-eastern", "main-dish", "vegetarian", "gluten-free", "30-minutes-or-less"],
     ["eggs", "canned tomatoes", "onion", "red bell pepper", "garlic", "ground cumin", "paprika", "olive oil",
      "salt", "fresh parsley"],
     ["soften onion , pepper and garlic in olive oil", "add spices and tomatoes and simmer 10 minutes",
      "make wells and crack in the eggs , cover until set", "garnish with parsley"]),
    ("hummus", 10, ["middle-eastern", "lebanese", "appetizers", "vegetarian", "vegan", "gluten-free", "easy",
                     "15-minutes-or-less"],
     ["chickpeas", "tahini", "garlic", "lemon juice", "olive oil", "ground cumin", "salt", "water"],
     ["blend chickpeas , tahini , garlic and lemon juice", "add water until smooth and season",
      "serve with olive oil and cumin"]),
    ("french onion soup", 90, ["french", "european", "soups-stews", "4-hours-or-less"],
     ["onions", "butter", "beef broth", "dry white wine", "fresh thyme", "bay leaf", "french bread",
      "gruyere cheese", "salt", "pepper"],
     ["caramelize onions slowly in butter for 45 minutes", "add wine , broth , thyme and bay leaf and simmer 20 minutes",
      "ladle into bowls , top with toasted bread and cheese", "grill until bubbling"]),
    ("banana bread", 75, ["american", "north-american", "breads", "desserts", "vegetarian", "4-hours-or-less"],
     ["bananas", "all-purpose flour", "sugar", "butter", "eggs", "baking soda", "salt", "vanilla extract"],
     ["mash bananas and mix with melted butter , sugar , eggs and vanilla", "fold in flour , soda and salt",
      "bake in a loaf pan at 175c for 60 minutes"]),
    ("gajar halwa", 60, ["indian", "asian", "desserts", "vegetarian", "gluten-free", "60-minutes-or-less"],
     ["carrots", "milk", "sugar", "ghee", "cardamom", "cashews", "raisins"],
     ["simmer grated carrots in milk until it is absorbed", "add sugar and ghee and cook until glossy",
      "stir in cardamom , cashews and raisins"]),
    ("masala chai", 10, ["indian", "asian", "beverages", "vegetarian", "easy", "15-minutes-or-less"],
     ["water", "milk", "black tea leaves", "fresh ginger", "cardamom", "cloves", "cinnamon stick", "sugar"],
     ["boil water with crushed ginger and spices", "add tea and simmer 2 minutes",
      "add milk and sugar , bring to a boil and strain"]),
]


def main(out):
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(7)
    with open(os.path.join(out, "RAW_recipes.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "id", "minutes", "contributor_id", "submitted", "tags", "nutrition", "n_steps",
                    "steps", "description", "ingredients", "n_ingredients"])
        for i, (name, mins, tags, ings, steps) in enumerate(R):
            w.writerow([name, 900001 + i, mins, 1, "2026-10-27", repr(["time-to-make"] + tags),
                        repr([float(rnd.randint(120, 650)), 10.0, 5.0, 12.0, 20.0, 8.0, 6.0]), len(steps),
                        repr(steps), "sample recipe for previewing the app", repr(ings), len(ings)])
    with open(os.path.join(out, "RAW_interactions.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["user_id", "recipe_id", "date", "rating", "review"])
        for i in range(len(R)):
            for u in range(rnd.randint(0, 40)):
                w.writerow([u, 900001 + i, "2026-10-27", rnd.choice([3, 4, 4, 5, 5, 5, 0]), "sample"])
    print(f"Wrote {len(R)} sample recipes to {out}/")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sample")
