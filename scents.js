/* =====================================================================
   OSMOS scent library
   ---------------------------------------------------------------------
   Each entry:
     id, name, cat, emoji
     col   association colour — the colour most people match to the
           odour's identified source (see Science panel for why).
     I     typical perceived intensity, 0–1 (everyday encounter)
     P     typical pleasantness (hedonic valence), −1 … +1
     V     volatility, 0 (base note, lingers) … 1 (top note, fleeting)
     d     descriptor applicability, 0–1, using the 20 semantic
           descriptors of Keller & Vosshall (2016) plus two from the
           Dravnieks (1985) atlas (earthy, metallic). Missing = 0.
     words search synonyms
     literal plain-language description (Describe mode)
     mol   key odour molecules, where well established
     note  an extra, verifiable fact (optional)

   IMPORTANT: I/P/V and descriptor values are editorial estimates for a
   typical everyday encounter, informed by the cited literature and
   standard flavour-chemistry references. They are not panel
   measurements, and real perception varies a lot between people.
   ===================================================================== */
(function(){
  "use strict";

  const CATEGORIES = [
    ["fruit",  "Fruit"],
    ["food",   "Food & drink"],
    ["herb",   "Herbs & spices"],
    ["floral", "Floral"],
    ["wood",   "Woods, resins & musks"],
    ["nature", "Nature & weather"],
    ["native", "Australian natives"],
    ["animal", "Animals & people"],
    ["home",   "Home & materials"],
    ["chem",   "Chemical & industrial"]
  ];

  // [key, short label, long label, source]
  const DESCRIPTORS = [
    ["edible","EDIBLE","Edible","KV"], ["bakery","BAKERY","Bakery","KV"],
    ["sweet","SWEET","Sweet","KV"],    ["fruit","FRUIT","Fruit","KV"],
    ["fish","FISH","Fish","KV"],       ["garlic","GARLIC","Garlic","KV"],
    ["spices","SPICES","Spices","KV"], ["cold","COLD","Cold","KV"],
    ["sour","SOUR","Sour","KV"],       ["burnt","BURNT","Burnt","KV"],
    ["acid","ACID","Acid","KV"],       ["warm","WARM","Warm","KV"],
    ["musky","MUSKY","Musky","KV"],    ["sweaty","SWEATY","Sweaty","KV"],
    ["ammonia","AMMONIA","Ammonia / urinous","KV"], ["decayed","DECAYED","Decayed","KV"],
    ["wood","WOOD","Wood","KV"],       ["grass","GRASS","Grass","KV"],
    ["flower","FLOWER","Flower","KV"], ["chemical","CHEM","Chemical","KV"],
    ["earthy","EARTHY","Earthy","D"],  ["metallic","METAL","Metallic","D"]
  ];

  const SCENTS = [];
  function parseD(str){
    const o = {};
    str.trim().split(/\s+/).forEach(tok=>{
      if(!tok) return;
      const [k,v] = tok.split(":");
      o[k] = parseFloat(v);
    });
    return o;
  }
  function add(id, name, cat, emoji, col, I, P, V, d, words, literal, mol, note){
    SCENTS.push({ id, name, cat, emoji, col, I, P, V, d: parseD(d),
      words: words || [], literal, mol: mol || "", note: note || "" });
  }

  /* ----------------------------- FRUIT ----------------------------- */
  add("strawberry","Strawberry","fruit","🍓","#e0314b", .6,.8,.7,
    "fruit:.9 sweet:.8 edible:.7 sour:.2 grass:.1",
    ["strawberry","strawberries"],
    "Sweet and juicy with a slightly green, grassy edge from the leaves. Ripe strawberries smell like sugared berries with a faint tang — similar to strawberry candy, but softer and less artificial.",
    "furaneol, methyl butanoate, ethyl hexanoate, γ-decalactone");
  add("lemon","Lemon","fruit","🍋","#f2e14a", .7,.7,.95,
    "fruit:.8 sour:.7 acid:.5 edible:.6 cold:.2 sweet:.2 chemical:.1",
    ["lemon","lemons","citrus","lemon zest"],
    "Sharp, clean and zesty. Most of what we call 'lemon' smell lives in the oil of the peel — scratch the skin and it jumps out. The juice on its own smells fainter and more sour.",
    "limonene, citral (geranial + neral)");
  add("orange","Orange","fruit","🍊","#f5922a", .6,.85,.9,
    "fruit:.9 sweet:.5 sour:.3 acid:.2 edible:.7",
    ["orange","oranges","mandarin","citrus","tangerine"],
    "Bright, sweet and tangy rather than sharp. The peel smells oilier and slightly bitter compared with the juicy, sugary scent of the flesh.",
    "limonene, octanal, decanal, linalool");
  add("lime","Lime","fruit","🍈","#8fd14f", .7,.7,.95,
    "fruit:.7 sour:.6 acid:.4 grass:.2 cold:.2 edible:.5",
    ["lime","limes"],
    "Sharper and greener than lemon, with a slightly bitter, almost floral peel note. Lime oil is part of the classic cola flavour.",
    "limonene, citral, γ-terpinene");
  add("grapefruit","Grapefruit","fruit","🍊","#f27a6b", .7,.6,.85,
    "fruit:.7 sour:.6 acid:.3 sweaty:.1 chemical:.1 edible:.5",
    ["grapefruit"],
    "Bitter-sweet and tangy with a faint sulfury, almost sweaty edge that makes it unmistakable.",
    "nootkatone, 1-p-menthene-8-thiol",
    "Its signature thiol has one of the lowest odour thresholds ever measured — detectable at well under a part per trillion in water.");
  add("banana","Banana","fruit","🍌","#f4d34a", .6,.65,.7,
    "fruit:.9 sweet:.7 edible:.7 chemical:.15",
    ["banana","bananas"],
    "Sweet, creamy and slightly musky. Banana candy often smells 'more banana' than a real one — the flavouring is a concentrated dose of isoamyl acetate, one of the key esters in ripe bananas.",
    "isoamyl acetate");
  add("apple","Apple","fruit","🍎","#d9493a", .45,.75,.75,
    "fruit:.8 sweet:.5 sour:.35 grass:.2 edible:.7",
    ["apple","apples"],
    "Crisp, sweet and slightly tart with a light, watery freshness — fainter than most fruit. A cut or bruised apple smells sharper as it oxidises.",
    "hexyl acetate, ethyl 2-methylbutanoate, β-damascenone");
  add("pineapple","Pineapple","fruit","🍍","#f1c232", .7,.8,.75,
    "fruit:.9 sweet:.7 sour:.4 acid:.2 edible:.7",
    ["pineapple"],
    "Intensely sweet, tropical and tangy, with a slightly fermented, almost boozy edge when very ripe.",
    "methyl and ethyl 2-methylbutanoate, furaneol");
  add("peach","Peach","fruit","🍑","#f6a37a", .5,.85,.6,
    "fruit:.9 sweet:.8 flower:.25 edible:.7 musky:.1",
    ["peach","peaches","apricot","nectarine"],
    "Soft, sweet and creamy-fruity with a velvety floral note. Real peach skin smells fuzzier and more floral than peach candy.",
    "γ-decalactone and related lactones, linalool");
  add("mango","Mango","fruit","🥭","#f7a623", .65,.8,.65,
    "fruit:.9 sweet:.7 sour:.2 wood:.15 chemical:.1 edible:.7",
    ["mango","mangoes"],
    "Lush and sweet with a resinous, slightly piney edge. Some varieties smell faintly of turpentine — the same family of terpene molecules.",
    "δ-3-carene, terpinolene, lactones, esters");
  add("coconut","Coconut","fruit","🥥","#f2ede4", .5,.75,.4,
    "sweet:.6 edible:.6 fruit:.3 wood:.15 musky:.1",
    ["coconut"],
    "Creamy, sweet and nutty with a gentle milky richness. Most 'coconut' in sunscreens and candles is a synthetic lactone that smells stronger and sweeter than the fruit itself.",
    "lactones (δ-octalactone, δ-decalactone)");
  add("raspberry","Raspberry","fruit","","#c2185b", .55,.85,.65,
    "fruit:.9 sweet:.7 flower:.3 sour:.3 edible:.7",
    ["raspberry","raspberries","blackberry","berries","berry"],
    "Sweet-tart and jammy with a distinctly floral, violet-like note — raspberries share their ionone molecules with violets.",
    "raspberry ketone, α- and β-ionone");
  add("cherry","Cherry","fruit","🍒","#9e1b32", .55,.75,.6,
    "fruit:.8 sweet:.7 edible:.6 chemical:.1 flower:.1",
    ["cherry","cherries"],
    "Sweet, deep and slightly almond-like. Artificial cherry flavour is mostly benzaldehyde — the same molecule as bitter almond — so cherry candy and marzipan are chemical cousins.",
    "benzaldehyde, linalool");
  add("grape","Grape (Concord)","fruit","🍇","#6a2c91", .6,.7,.6,
    "fruit:.9 sweet:.7 edible:.6 chemical:.2",
    ["grape","grapes","grape juice"],
    "That 'grape candy' smell is methyl anthranilate, prominent in Concord-type grapes. Most green table grapes smell far fainter — simply fresh and sweet.",
    "methyl anthranilate");
  add("watermelon","Watermelon","fruit","🍉","#f05a6e", .35,.75,.7,
    "fruit:.7 sweet:.5 grass:.35 cold:.2 edible:.6",
    ["watermelon","melon","rockmelon"],
    "Light, watery and green-sweet — remarkably close to cucumber, because both share the same 'green melon' aldehydes.",
    "(Z)-6-nonenal, (E,Z)-2,6-nonadienal");
  add("durian","Durian","fruit","","#c9c25a", .95,-.15,.6,
    "fruit:.6 garlic:.6 decayed:.5 sweet:.4 edible:.4 sweaty:.3 chemical:.2",
    ["durian"],
    "Sweet, custardy fruit layered over a powerful onion-and-gas sulfur note. Reactions range from adoration to revulsion.",
    "fruity esters plus volatile sulfur compounds (thiols)",
    "Pleasantness here is an average of strongly divided opinions — it's banned on some public transport in Southeast Asia.");

  /* ------------------------- FOOD & DRINK -------------------------- */
  add("coffee","Coffee","food","☕","#6b4226", .75,.65,.5,
    "burnt:.6 edible:.6 warm:.5 bakery:.3 acid:.25 wood:.2 sweet:.15 spices:.1",
    ["coffee","espresso","latte","cappuccino"],
    "Warm, roasted and slightly bitter, with notes of toasted nuts, dark chocolate and caramel. Fresh-ground coffee is sharper and more acidic; brewed coffee mellows into a rounder, smokier warmth.",
    "2-furfurylthiol, guaiacol, alkylpyrazines");
  add("chocolate","Chocolate","food","🍫","#5a3220", .55,.85,.3,
    "edible:.8 sweet:.7 bakery:.4 warm:.4 burnt:.25 musky:.1",
    ["chocolate","cocoa","cacao"],
    "Rich, slightly bitter and roasted, with a warm sweetness underneath — like coffee but rounder and creamier, often with a faint fruity or vanilla note depending on the cacao.",
    "pyrazines, 3-methylbutanal, phenylacetaldehyde");
  add("bakery","Fresh Bread","food","🥖","#d9a35b", .55,.85,.5,
    "bakery:.95 edible:.8 warm:.5 sweet:.3 burnt:.15 sour:.1",
    ["bread","bakery","croissant","baking","sourdough"],
    "Warm, yeasty and slightly sweet, with a toasted, nutty edge from the crust — often compared to a mix of malt, popcorn and warm butter.",
    "2-acetyl-1-pyrroline (crust), (E)-2-nonenal, yeast esters");
  add("toast","Burnt Toast","food","🍞","#3a2a20", .75,-.3,.5,
    "burnt:.95 bakery:.3 edible:.3 acid:.2 chemical:.1",
    ["burnt toast","toast","burnt"],
    "Acrid, bitter and smoky over a faint bready base — the toasty notes of good toast tipped over into char.",
    "furans, guaiacol, pyrazines");
  add("vanilla","Vanilla","food","🍦","#f3e3c3", .5,.85,.2,
    "sweet:.9 edible:.6 bakery:.5 warm:.4 wood:.15 flower:.1",
    ["vanilla"],
    "Warm, sweet and creamy, with a faint boozy or woody undertone. Real vanilla is less sugary and more complex than synthetic 'vanilla scent', which smells flatter.",
    "vanillin (plus hundreds of minor compounds in real vanilla)");
  add("caramel","Caramel","food","🍮","#b8742a", .6,.85,.35,
    "sweet:.9 edible:.8 bakery:.5 warm:.5 burnt:.35",
    ["caramel","toffee","butterscotch","burnt sugar","fairy floss","cotton candy"],
    "Rich, buttery burnt-sugar sweetness with a toasty, slightly bitter edge.",
    "furaneol, maltol, cyclotene");
  add("popcorn","Popcorn","food","🍿","#f4e2a6", .6,.8,.5,
    "edible:.8 bakery:.7 warm:.4 burnt:.3 sweet:.2",
    ["popcorn","corn chips"],
    "Toasty, buttery and corn-sweet. Its signature note is the same molecule that makes bread crust and basmati rice smell 'roasty'.",
    "2-acetyl-1-pyrroline, 6-acetyl-1,2,3,4-tetrahydropyridine");
  add("butter","Butter","food","🧈","#f6dc7a", .4,.7,.5,
    "edible:.8 sweet:.4 bakery:.3 sour:.15 musky:.1",
    ["butter","buttery"],
    "Creamy, rich and gently tangy. 'Butter flavour' in popcorn is mostly a single molecule, diacetyl.",
    "diacetyl, δ-lactones, traces of butyric acid");
  add("cheese","Aged Cheese","food","🧀","#f2c94c", .8,.2,.5,
    "sweaty:.6 edible:.6 sour:.5 decayed:.3 musky:.2 fruit:.1",
    ["cheese","parmesan","blue cheese"],
    "Savoury, tangy and sharp, with a sweaty, almost vomit-like note in aged hard cheeses — the very same fatty acids, which is why some people can't stand it.",
    "butyric acid, isovaleric acid, methyl ketones");
  add("bacon","Frying Bacon","food","🥓","#c0504d", .8,.75,.45,
    "edible:.9 burnt:.5 warm:.4 sweet:.2 wood:.2 spices:.1",
    ["bacon","ham"],
    "Smoky, salty-savoury and sweet from browning fat and sugar — Maillard browning layered over wood smoke.",
    "guaiacol and other smoke phenols, pyrazines, Maillard products");
  add("grilled","Grilled / BBQ","food","🍖","#7a3b22", .8,.7,.45,
    "edible:.8 burnt:.7 warm:.5 wood:.2",
    ["bbq","barbecue","grilled","sausage","hot dog","steak","sausage sizzle"],
    "Smoky, savoury and slightly sweet from caramelising fat and sugar — the specific smell of browning meat mixed with charcoal smoke.",
    "2-methyl-3-furanthiol, pyrazines, guaiacol");
  add("pizza","Pizza","food","🍕","#d9653b", .6,.8,.5,
    "edible:.9 bakery:.6 warm:.4 spices:.3 sour:.2 burnt:.2 sweet:.2 garlic:.15",
    ["pizza"],
    "Warm and savoury: baked dough, melted cheese and tomato, with oregano and a faint char from the crust. A blend rather than a single note.",
    "2-acetyl-1-pyrroline (crust), carvacrol (oregano), fatty acids (cheese)");
  add("donut","Donut","food","🍩","#e3b07a", .55,.85,.4,
    "sweet:.9 edible:.9 bakery:.8 warm:.3",
    ["donut","doughnut"],
    "Sweet and rich, dominated by fried dough and sugar glaze — warmer and oilier than a baked pastry.",
    "(E,E)-2,4-decadienal (fried note), vanillin, Maillard products");
  add("honey","Honey","food","🍯","#e8a317", .55,.85,.35,
    "sweet:.95 edible:.7 flower:.4 warm:.3 wood:.1",
    ["honey"],
    "Deep, sweet and floral-waxy. Every honey carries traces of the flowers the bees visited, so a eucalypt honey smells quite different from clover.",
    "phenylacetaldehyde, β-damascenone, floral compounds from the nectar source");
  add("maple","Maple Syrup","food","🥞","#a85d1f", .55,.85,.35,
    "sweet:.9 edible:.7 bakery:.3 warm:.3 wood:.25 burnt:.2",
    ["maple","maple syrup","pancakes"],
    "Sweet, caramel-like and gently woody — made as sap is boiled down and its sugars brown.",
    "vanillin, syringaldehyde, caramel-type furanones");
  add("rice","Basmati Rice","food","🍚","#f5f1e4", .4,.75,.5,
    "edible:.8 bakery:.5 sweet:.2 grass:.1",
    ["rice","basmati","jasmine rice","pandan"],
    "Gentle, popcorn-like and nutty. Fragrant rices carry the same roasty molecule as bread crust and pandan leaf.",
    "2-acetyl-1-pyrroline");
  add("peanut","Peanut Butter","food","🥜","#b5803e", .55,.8,.35,
    "edible:.9 bakery:.5 sweet:.4 warm:.3 burnt:.25",
    ["peanut","peanut butter","peanuts","nuts"],
    "Roasty, nutty and rich, with a faint sweetness — the roasting step creates almost all of the aroma.",
    "alkylpyrazines");
  add("almond","Almond / Marzipan","food","🌰","#f1e3c8", .55,.8,.5,
    "sweet:.6 edible:.7 bakery:.3 chemical:.15",
    ["almond","marzipan","amaretto"],
    "Sweet, cherry-like and marzipan-rich. Bitter almond oil is almost pure benzaldehyde; sweet almonds themselves smell much milder.",
    "benzaldehyde");
  add("fish","Fish","food","🐟","#9fb8c0", .85,-.4,.6,
    "fish:.95 decayed:.4 edible:.4 ammonia:.3",
    ["fish","fishy","seafood","prawns"],
    "Truly fresh fish smells of almost nothing but the sea. The 'fishy' smell is trimethylamine, produced as fish ages — so a strong fishy smell is a freshness warning.",
    "trimethylamine");
  add("garlic","Garlic","food","🧄","#f3efe0", .9,.3,.6,
    "garlic:.95 edible:.6 spices:.4 warm:.2 chemical:.1",
    ["garlic"],
    "Pungent, sulfurous and savoury. Raw crushed garlic is sharp and hot; cooked garlic turns sweet and nutty.",
    "allicin → diallyl disulfide, allyl methyl sulfide",
    "Garlic breath lasts because allyl methyl sulfide is absorbed into the blood and exhaled through the lungs for hours.");
  add("onion","Onion","food","🧅","#d7b37a", .85,.2,.7,
    "garlic:.8 edible:.5 sour:.3 chemical:.2 spices:.2",
    ["onion","onions","shallot"],
    "Sharp and sulfurous when cut; cooking turns it sweet and savoury.",
    "thiosulfinates, dipropyl disulfide",
    "The sting in your eyes is a separate gas, syn-propanethial-S-oxide, released when the cells are cut.");
  add("vinegar","Vinegar","food","🫙","#d8d3b0", .85,-.2,.8,
    "sour:.95 acid:.9 chemical:.3 edible:.3",
    ["vinegar","pickles"],
    "Sharp, sour and stinging — a smell you partly feel as a prickle in the nose, because acetic acid also stimulates the trigeminal (touch and pain) nerve.",
    "acetic acid");
  add("greens","Cooked Broccoli","food","🥦","#3f7d3a", .6,.3,.5,
    "grass:.5 edible:.5 garlic:.4 decayed:.2",
    ["broccoli","greens","cabbage","brussels sprouts","cauliflower"],
    "Green and slightly bitter, with a sulfurous edge that gets much stronger with cooking — the same family of compounds as cabbage and mustard.",
    "dimethyl sulfide, isothiocyanates (from glucosinolates)");
  add("carrot","Carrot","food","🥕","#f08a24", .35,.6,.55,
    "edible:.6 grass:.4 wood:.3 sweet:.3 spices:.1",
    ["carrot","carrots"],
    "Earthy and mildly sweet, with a green, woody, almost parsley-like top note. Milder than most root vegetables.",
    "terpenes such as terpinolene and β-caryophyllene");
  add("capsicum","Green Capsicum","food","🫑","#3e9a3b", .6,.4,.6,
    "grass:.9 edible:.5 chemical:.1",
    ["capsicum","bell pepper","green pepper","sauvignon blanc"],
    "Intensely green and vegetal.",
    "2-isobutyl-3-methoxypyrazine",
    "Its key molecule is detectable at a few parts per trillion, and is also what gives Sauvignon Blanc its 'green capsicum' character.");
  add("cucumber","Cucumber","food","🥒","#8fbf6a", .35,.75,.7,
    "grass:.7 cold:.4 edible:.5 fruit:.2",
    ["cucumber"],
    "Cool, watery and green — very close to watermelon rind.",
    "(E,Z)-2,6-nonadienal");
  add("wine","Red Wine","food","🍷","#7b1e3a", .6,.6,.65,
    "fruit:.6 edible:.4 sour:.35 chemical:.25 wood:.2 sweet:.2 flower:.15",
    ["wine","red wine","shiraz"],
    "Fruity and slightly sour, with a warm alcoholic sharpness and an earthy undertone from the barrel or grape skins. Reds skew darker and jammier; whites lighter and more floral.",
    "ethanol, esters, β-damascenone, rotundone (in some Shiraz)");
  add("beer","Beer","food","🍺","#e2a52b", .5,.5,.65,
    "edible:.5 bakery:.4 grass:.3 fruit:.3 sour:.2 chemical:.15 sweet:.1",
    ["beer","lager","ale","hops"],
    "Malty and bready with green, bitter, sometimes citrusy hop notes. Lagers lean grainy and clean; hoppy ales lean fruity and resinous.",
    "hop terpenes (myrcene, linalool), isoamyl acetate, ethanol");
  add("whisky","Peated Whisky","food","🥃","#b8732e", .85,.4,.5,
    "burnt:.7 wood:.6 warm:.5 chemical:.35 sweet:.25 spices:.2",
    ["whisky","whiskey","scotch","bourbon"],
    "Smoky, medicinal and woody — like bonfire smoke and seaweed, with vanilla underneath from the oak cask.",
    "phenols from peat smoke (guaiacol, cresols), vanillin, ethanol");

  /* ------------------------ HERBS & SPICES ------------------------- */
  add("mint","Peppermint","herb","🌱","#4fe0c8", .75,.8,.85,
    "cold:.95 grass:.3 sweet:.2 chemical:.1",
    ["mint","peppermint","menthol","toothpaste"],
    "Sharp, cool and sweet, with an unmistakable cooling sensation that's as much a feeling as a smell — that's menthol acting on cold receptors.",
    "menthol, menthone");
  add("spearmint","Spearmint","herb","🌿","#6fd08c", .65,.8,.8,
    "cold:.6 sweet:.4 grass:.4",
    ["spearmint","chewing gum"],
    "Sweet, soft and minty — rounder and less icy than peppermint.",
    "(R)-(−)-carvone",
    "Its mirror-image molecule, (S)-(+)-carvone, smells of caraway — same atoms, opposite handedness.");
  add("caraway","Caraway","herb","","#8c6a3c", .6,.55,.5,
    "spices:.8 warm:.3 bakery:.3 wood:.2",
    ["caraway","rye bread","dill"],
    "Warm, sharp and slightly anise-like — the flavour of rye bread.",
    "(S)-(+)-carvone, limonene",
    "Chemically the mirror image of spearmint's main molecule.");
  add("basil","Basil","herb","🌿","#3f9b48", .65,.8,.7,
    "grass:.6 spices:.6 sweet:.3 cold:.2 flower:.2",
    ["basil","pesto"],
    "Sweet, green and peppery with a hint of anise and clove.",
    "linalool, estragole, eugenol, 1,8-cineole");
  add("rosemary","Rosemary","herb","🌿","#5b7f62", .7,.75,.65,
    "wood:.5 cold:.5 spices:.4 grass:.4 chemical:.1",
    ["rosemary"],
    "Piney, camphor-cool and resinous — closer to eucalyptus than to sweet herbs.",
    "1,8-cineole, camphor, α-pinene");
  add("thyme","Thyme","herb","🌿","#7c8f5a", .7,.65,.55,
    "spices:.8 grass:.3 wood:.3 warm:.3 chemical:.2",
    ["thyme"],
    "Warm, herbal and slightly medicinal.",
    "thymol, p-cymene",
    "Thymol is antiseptic — it's an active ingredient in some mouthwashes.");
  add("oregano","Oregano","herb","🌿","#6b7f3a", .75,.65,.5,
    "spices:.85 edible:.3 grass:.3 warm:.3",
    ["oregano","marjoram"],
    "Pungent, warm and slightly bitter — the 'pizza herb'. Dried oregano often smells stronger than fresh.",
    "carvacrol");
  add("coriander","Coriander Leaf","herb","🌿","#5ca84a", .6,.2,.7,
    "grass:.6 chemical:.3 sour:.1 flower:.1 fruit:.1",
    ["coriander","cilantro"],
    "To most people: bright, green and citrusy. To a sizeable minority: soapy.",
    "(E)-2-alkenals and aldehydes such as (E)-2-decenal and decanal",
    "The 'soapy' perception is partly genetic: a variant near the receptor gene OR6A2, which detects these aldehydes, is associated with it (Eriksson et al. 2012). Pleasantness here is a divided average.");
  add("cinnamon","Cinnamon","herb","🟤","#8b4a2b", .7,.85,.4,
    "spices:.95 warm:.7 sweet:.5 wood:.3 bakery:.3",
    ["cinnamon","cassia","chai"],
    "Warm, sweet and spicy with a slight heat. Ground cinnamon is dustier and more intense than cinnamon sticks, which read woodier.",
    "cinnamaldehyde, eugenol (minor)");
  add("clove","Clove","herb","🌰","#6a3a2a", .85,.6,.35,
    "spices:.95 warm:.6 wood:.3 chemical:.3 sweet:.2",
    ["clove","cloves"],
    "Hot, sweet-spicy and medicinal — the classic dentist smell, because clove oil's eugenol has been used for toothache for centuries.",
    "eugenol (most of the oil)");
  add("nutmeg","Nutmeg","herb","","#a0673a", .6,.75,.45,
    "spices:.9 warm:.6 wood:.3 sweet:.3",
    ["nutmeg","mace","eggnog"],
    "Warm, sweet and woody-spicy with a slight piney freshness.",
    "sabinene, α-pinene, myristicin");
  add("pepper","Black Pepper","herb","","#3a3330", .6,.6,.55,
    "spices:.9 wood:.4 warm:.3 chemical:.1",
    ["black pepper","pepper","peppercorn"],
    "Woody, dry and spicy-fresh. The burn is piperine, which you taste rather than smell.",
    "rotundone, limonene, β-caryophyllene",
    "Roughly one in five people can't smell rotundone at all (Wood et al. 2008).");
  add("anise","Anise / Licorice","herb","⭐","#3b2b2b", .75,.55,.45,
    "spices:.8 sweet:.5 cold:.2 chemical:.1",
    ["anise","licorice","liquorice","fennel","star anise","ouzo","sambuca"],
    "Sweet, warm and licorice-like. Anise, star anise, fennel and licorice candy all smell alike because they share one molecule.",
    "trans-anethole",
    "Anethole is about 13 times sweeter than sugar.");
  add("ginger","Ginger","herb","🫚","#d9b25a", .65,.75,.6,
    "spices:.8 warm:.4 sour:.3 fruit:.2 wood:.2",
    ["ginger"],
    "Warm, zesty and lemony-spicy. The heat is gingerol, which is tasted; the aroma comes from lighter terpenes.",
    "zingiberene, citral, β-sesquiphellandrene");
  add("cumin","Cumin","herb","🫘","#a67b3a", .8,.4,.45,
    "spices:.9 sweaty:.5 warm:.5 musky:.3",
    ["cumin","curry"],
    "Warm, earthy and savoury with a distinctly sweaty, body-odour-like note that divides people.",
    "cuminaldehyde");
  add("cardamom","Cardamom","herb","🫛","#8fae6a", .65,.8,.6,
    "spices:.8 cold:.4 flower:.3 wood:.2 sweet:.2",
    ["cardamom"],
    "Fresh, eucalyptus-cool and sweetly floral-spicy.",
    "1,8-cineole, α-terpinyl acetate, linalool");
  add("fenugreek","Fenugreek","herb","","#c9a24a", .8,.5,.3,
    "spices:.6 sweet:.5 warm:.4 bakery:.3 burnt:.2",
    ["fenugreek","methi"],
    "Maple-syrup sweet at low levels, curry-like and savoury at high levels.",
    "sotolon",
    "Sotolon is so persistent that eating plenty of fenugreek can make your sweat smell of maple syrup.");
  add("saffron","Saffron","herb","🧡","#d4472a", .5,.7,.4,
    "spices:.6 sweet:.3 wood:.2 flower:.2 metallic:.2 chemical:.1",
    ["saffron"],
    "Honeyed and hay-like with a slightly metallic, bitter edge.",
    "safranal");
  add("wintergreen","Wintergreen","herb","🩹","#d7f0e8", .85,.5,.7,
    "cold:.6 chemical:.5 sweet:.4 spices:.2",
    ["wintergreen","deep heat","liniment","root beer"],
    "Sweet-minty and medicinal — the smell of heat rubs and many root-beer style flavours.",
    "methyl salicylate");

  /* ----------------------------- FLORAL ---------------------------- */
  add("rose","Rose","floral","🌹","#e75480", .6,.9,.45,
    "flower:.95 sweet:.5 fruit:.2 spices:.1",
    ["rose","roses"],
    "Sweet and floral with a slightly spicy, honeyed depth. Fresh roses smell lighter and greener than rose perfume, which is usually more concentrated and syrupy.",
    "2-phenylethanol, citronellol, geraniol, β-damascenone, rose oxide");
  add("jasmine","Jasmine","floral","🤍","#f7f4ea", .8,.8,.4,
    "flower:.95 sweet:.6 musky:.3 fruit:.2 decayed:.1",
    ["jasmine"],
    "Intensely sweet and floral, with an unusual musky undertone that keeps it from being purely 'pretty' — part of why it's prized in perfumery.",
    "benzyl acetate, linalool, indole, methyl jasmonate",
    "Indole, part of jasmine's richness, smells faecal on its own at high concentration.");
  add("lavender","Lavender","floral","💜","#9b7fd4", .6,.8,.6,
    "flower:.7 grass:.3 wood:.2 cold:.2 sweet:.2",
    ["lavender"],
    "Soft, herbal and slightly sweet, with a cooling, almost medicinal edge — related to rosemary, but rounder and less sharp.",
    "linalool, linalyl acetate, camphor (in spike lavender)");
  add("violet","Violet","floral","🪻","#7f4fc9", .4,.85,.4,
    "flower:.9 sweet:.5 wood:.2 fruit:.2",
    ["violet","violets","parma violet"],
    "Powdery, sweet and gently woody-fruity — the smell of violet sweets.",
    "α- and β-ionone",
    "Violets are famous for seeming to vanish after a few sniffs and then return — usually attributed to unusually fast adaptation to ionones.");
  add("lilac","Lilac","floral","🌸","#c8a2c8", .6,.85,.5,
    "flower:.9 sweet:.5 grass:.2",
    ["lilac"],
    "Fresh, sweet and green-floral, with an almondy, slightly spicy heart.",
    "lilac aldehydes and alcohols, linalool");
  add("gardenia","Gardenia","floral","🤍","#f8f3e6", .75,.8,.4,
    "flower:.95 sweet:.5 musky:.2 fruit:.2",
    ["gardenia","tuberose"],
    "Heady, creamy and rich — sweet white-flower with a slightly fruity, almost mushroomy depth.",
    "methyl benzoate, linalool, tiglate esters");
  add("neroli","Orange Blossom","floral","🌼","#fffbe8", .65,.85,.55,
    "flower:.9 sweet:.4 fruit:.3 musky:.1",
    ["orange blossom","neroli","citrus blossom"],
    "Sweet, honeyed white-floral with a fresh citrus lift.",
    "linalool, methyl anthranilate, nerolidol, indole");
  add("honeysuckle","Honeysuckle","floral","🌼","#f3e3a0", .55,.85,.5,
    "flower:.9 sweet:.7 fruit:.2",
    ["honeysuckle"],
    "Nectar-sweet, light and fresh-floral, strongest in the evening.",
    "linalool and other terpenoids");
  add("geranium","Geranium Leaf","floral","🌺","#6e9e4e", .6,.55,.55,
    "flower:.5 grass:.5 fruit:.2 sour:.1 spices:.1",
    ["geranium","pelargonium"],
    "Rub a leaf: rosy, lemony and green-minty all at once.",
    "geraniol, citronellol, rose oxide",
    "Geranium oil is used as a cheaper stand-in for rose in perfumery because it shares many of the same molecules.");
  add("lily","Stargazer Lily","floral","💮","#f2a7c0", .85,.6,.45,
    "flower:.9 sweet:.6 spices:.3 musky:.2",
    ["lily","lilies","stargazer"],
    "Heavy, sweet and spicy — strong enough indoors that some people find it overwhelming.",
    "linalool, (E)-β-ocimene, methyl benzoate, isoeugenol");
  add("frangipani","Frangipani","floral","🌺","#fcf2d6", .7,.85,.45,
    "flower:.9 sweet:.7 fruit:.4",
    ["frangipani","plumeria"],
    "Rich, creamy and sweet with peach-and-coconut tones. Strongest in the evening, when it's pollinated by night-flying moths.",
    "");
  add("chamomile","Chamomile","floral","🌼","#f2e6a0", .45,.7,.6,
    "flower:.5 fruit:.5 grass:.4 sweet:.3",
    ["chamomile","camomile"],
    "Apple-like, hay-sweet and gently herbal — the name comes from Greek for 'earth apple'.",
    "angelate esters (Roman chamomile), α-bisabolol (German chamomile)");

  /* --------------------- WOODS, RESINS & MUSKS --------------------- */
  add("cedar","Cedarwood","wood","🪵","#a85e3b", .55,.75,.25,
    "wood:.95 spices:.2 sweet:.1 chemical:.1",
    ["cedar","cedarwood","pencil","pencil shavings"],
    "Dry, clean pencil-shavings woodiness — pencils were traditionally made from cedar.",
    "cedrol, α-cedrene, thujopsene");
  add("sandalwood","Sandalwood","wood","🪵","#d2a679", .45,.85,.1,
    "wood:.9 sweet:.4 musky:.4 warm:.4 bakery:.1",
    ["sandalwood","santalum"],
    "Soft, creamy, milky-woody and very long-lasting. Western Australian sandalwood (Santalum spicatum) is now a major source, with a somewhat different, often drier profile than Indian sandalwood.",
    "α- and β-santalol");
  add("vetiver","Vetiver","wood","🌾","#6b5a3a", .6,.6,.1,
    "wood:.7 earthy:.7 grass:.3 burnt:.2",
    ["vetiver"],
    "Earthy, smoky-woody and rooty — oil distilled from the roots of a tropical grass.",
    "khusimone, vetiverols");
  add("patchouli","Patchouli","wood","🍃","#5b3a28", .75,.45,.05,
    "earthy:.85 wood:.6 musky:.4 sweet:.2 decayed:.1",
    ["patchouli"],
    "Dark, earthy and musty-sweet — damp forest floor with a sweet edge. One of the most persistent natural materials in perfumery.",
    "patchoulol, norpatchoulenol");
  add("frankincense","Frankincense","wood","🕯️","#e6d6b0", .65,.75,.45,
    "wood:.6 spices:.3 burnt:.3 sour:.2 chemical:.2 sweet:.1",
    ["frankincense","incense","olibanum","church","myrrh"],
    "Fresh, lemony-piney resin when raw; smoky and sweet-balsamic when burned.",
    "α-pinene, limonene; burning adds smoky phenols");
  add("oud","Oud (Agarwood)","wood","","#3a2418", .85,.4,.1,
    "wood:.8 musky:.6 burnt:.4 decayed:.3 sweet:.2 sweaty:.2",
    ["oud","agarwood","oudh"],
    "Deep, dark, smoky-woody with a leathery, almost barnyard edge.",
    "agarwood chromones and sesquiterpenes",
    "Agarwood resin forms only when the Aquilaria tree is wounded or infected — part of why it's among the most expensive natural materials in perfumery.");
  add("musk","Musk","wood","🫧","#e8dfd6", .5,.6,.05,
    "musky:.95 sweet:.3 wood:.2 sweaty:.15 flower:.1",
    ["musk","white musk","skin"],
    "Soft, warm, powdery and skin-like.",
    "muscone (historic deer musk, now rarely used); synthetic musks such as galaxolide",
    "Many people are partly or completely blind to individual musk molecules, which is why perfumes usually blend several.");
  add("ambergris","Ambergris","wood","","#c9b99a", .5,.6,.05,
    "musky:.6 wood:.4 earthy:.3 sweet:.3 fish:.1",
    ["ambergris","amber","ambrox"],
    "Sweet, earthy, marine-woody and skin-like.",
    "ambrein → ambroxide (Ambrox)",
    "It forms in sperm whales' intestines and ages for years at sea; perfumery now mostly uses its synthetic counterpart.");
  add("leather","Leather","wood","🧳","#5a3a26", .6,.55,.15,
    "musky:.4 burnt:.4 wood:.3 chemical:.3 earthy:.2 sweet:.1",
    ["leather","saddle","handbag"],
    "Rich, smoky and slightly sweet with a musky depth. New leather smells sharper and more chemical from tanning; aged leather is softer and warmer.",
    "birch-tar phenols (traditional), isobutyl quinoline (perfumery)");
  add("tonka","Tonka Bean","wood","🫘","#7a4a2a", .6,.85,.2,
    "sweet:.8 bakery:.4 warm:.4 wood:.3 spices:.2",
    ["tonka","tonka bean"],
    "Warm and sweet: almond, vanilla and fresh hay.",
    "coumarin",
    "Coumarin is restricted as a food flavouring in several countries (including the US) because of liver concerns at high doses.");

  /* ------------------------ NATURE & WEATHER ----------------------- */
  add("petrichor","Rain / Petrichor","nature","🌧️","#8a9ba8", .5,.8,.6,
    "earthy:.9 grass:.3 cold:.3 wood:.2 metallic:.1",
    ["rain","petrichor","storm","wet ground","after rain"],
    "An earthy, mineral smell released when rain hits dry ground, often described as simply 'clean'. Much of the earthy note is geosmin, made by soil bacteria — the same compound that gives beetroot its earthy taste.",
    "geosmin, plant oils released from soil and rock; ozone ahead of storms",
    "Humans can detect geosmin at a few parts per trillion in water. 'Petrichor' was coined by two Australian CSIRO scientists, Bear and Thomas, in 1964.");
  add("ocean","Sea Air","nature","🌊","#2f7fb5", .5,.75,.7,
    "cold:.3 fish:.2 earthy:.1 decayed:.1 chemical:.1",
    ["ocean","sea","beach","salt air","sea breeze","coast"],
    "Fresh, briny and faintly sulfurous-green. Salt itself has no smell — 'sea air' is mostly dimethyl sulfide, made as marine microbes break down a compound produced by plankton, plus seaweed compounds. In small doses it reads as fresh; concentrated, as cabbage or rotting seaweed.",
    "dimethyl sulfide, bromophenols, dictyopterenes");
  add("seaweed","Beach Wrack","nature","🪸","#5a6b2e", .7,.1,.5,
    "decayed:.6 fish:.4 earthy:.3 garlic:.2",
    ["seaweed","kelp","wrack","low tide"],
    "Heavy, sulfurous, iodine-and-cabbage marine smell of seaweed piled up on the shore.",
    "dimethyl sulfide, dictyopterenes, bromophenols");
  add("pine","Pine Forest","nature","🌲","#2e6b46", .6,.8,.7,
    "wood:.7 grass:.4 cold:.3 earthy:.2 chemical:.15",
    ["pine","forest","fir","conifer","woods","christmas tree"],
    "Sharp, resinous and green — like fresh sap and crushed needles. The same family as pine cleaning products, but earthier and less synthetic outdoors.",
    "α-pinene, β-pinene, bornyl acetate, limonene");
  add("grass","Cut Grass","nature","🌱","#66b544", .6,.75,.85,
    "grass:.95 sour:.1 cold:.1 earthy:.1",
    ["grass","cut grass","lawn","mowing"],
    "Sharp, green and slightly bitter — a burst of 'green' smell released when plant cells are damaged. It fades faster than most scents here.",
    "(Z)-3-hexenal, (Z)-3-hexenol");
  add("hay","Hay","nature","🌾","#d8c06a", .5,.75,.4,
    "grass:.5 sweet:.4 wood:.2 bakery:.2 earthy:.2",
    ["hay","straw","dried grass"],
    "Sweet, warm and grassy-dry, like vanilla mixed with dried herbs. The sweet note is coumarin, which builds up as certain grasses and clovers dry.",
    "coumarin");
  add("soil","Forest Soil","nature","","#4a3a2a", .5,.6,.4,
    "earthy:.95 wood:.3 decayed:.3 grass:.1",
    ["soil","dirt","earth","compost","forest floor","mud","beetroot"],
    "Damp, earthy and musty — the smell of turned garden soil.",
    "geosmin, 2-methylisoborneol (both made by soil microbes)");
  add("mushroom","Mushroom","nature","🍄","#b9a58a", .5,.5,.5,
    "earthy:.8 edible:.5 decayed:.2 musky:.1",
    ["mushroom","mushrooms","fungi"],
    "Earthy, damp and savoury — the woodland smell of fresh mushrooms.",
    "1-octen-3-ol ('mushroom alcohol')");
  add("truffle","Truffle","nature","🍄","#3b2f2a", .85,.5,.5,
    "earthy:.7 garlic:.6 edible:.5 musky:.4 decayed:.2",
    ["truffle","truffles","truffle oil"],
    "Earthy, musky and garlicky-gassy. Most 'truffle oil' is olive oil with a synthetic molecule that captures one note of a much more complex smell.",
    "bis(methylthio)methane (2,4-dithiapentane), dimethyl sulfide");
  add("tomatoleaf","Tomato Vine","nature","🍅","#4f8a3a", .6,.55,.6,
    "grass:.9 chemical:.2 spices:.15 sour:.1",
    ["tomato","tomato vine","tomato leaf","tomato plant"],
    "Brush a tomato plant and your hands smell intensely green and slightly bitter — very different from the fruit.",
    "2-isobutylthiazole");
  add("houseplant","Houseplant","nature","🪴","#4e8a4f", .25,.6,.5,
    "earthy:.6 grass:.5",
    ["plant","houseplant","fern","pot plant"],
    "A mild, green, mineral smell — mostly damp potting soil and leaf, without much sweetness.",
    "geosmin (from potting soil), green leaf volatiles");
  add("freshsnow","Fresh Snow","nature","❄️","#e8f1f8", .1,.6,.9,
    "cold:.7 metallic:.2",
    ["snow","ski","snowboard","winter","frost"],
    "Very faint and clean — technically almost scentless. Cold slows evaporation, so there's simply less to smell, leaving a sharp, mineral, almost metallic freshness.",
    "—");
  add("ozone","Ozone / Storm","nature","⚡","#9ad0ff", .6,.3,.9,
    "chemical:.6 metallic:.5 cold:.3",
    ["ozone","lightning","thunderstorm","photocopier"],
    "Sharp, clean and chlorine-like — the smell before a thunderstorm, or near an old photocopier. Breathing much of it irritates the lungs.",
    "ozone (O₃)",
    "The name comes from the Greek ozein, 'to smell'.");
  add("campfire","Campfire","nature","🔥","#b04a1f", .85,.55,.5,
    "burnt:.95 wood:.6 warm:.5 chemical:.15 spices:.1",
    ["campfire","bonfire","fire","woodsmoke","smoke","bushfire smoke"],
    "Dry, sharp and slightly acrid, like burning wood and charcoal. Clings heavily to fabric and hair.",
    "guaiacol, syringol, 4-methylguaiacol (from burning lignin)");

  /* ----------------------- AUSTRALIAN NATIVES ---------------------- */
  add("eucalyptus","Eucalyptus","native","🌿","#6fa7a0", .75,.75,.8,
    "cold:.7 wood:.4 chemical:.3 grass:.3 spices:.1",
    ["eucalyptus","gum","gum tree","gum leaves","eucalypt","vicks"],
    "Cool, camphor-like and medicinal-fresh — the smell of chest rubs, and of hot bushland in summer.",
    "1,8-cineole (eucalyptol), α-pinene",
    "On hot days eucalypt forests release so much oil vapour that it's thought to contribute to the blue haze over the Blue Mountains.");
  add("lemonmyrtle","Lemon Myrtle","native","🍃","#c9d93a", .8,.85,.85,
    "fruit:.6 sour:.5 grass:.4 cold:.2 flower:.1",
    ["lemon myrtle","backhousia"],
    "More lemony than lemon — a clean, sherbet-bright citrus with a green, herbal edge.",
    "citral (often over 90% of the oil)");
  add("teatree","Tea Tree","native","🌿","#8aa86a", .75,.4,.7,
    "chemical:.5 wood:.4 cold:.4 spices:.2 grass:.2",
    ["tea tree","melaleuca","antiseptic"],
    "Sharp, medicinal and woody-camphoraceous — the classic antiseptic smell. Less sweet and more pungent than eucalyptus.",
    "terpinen-4-ol, γ-terpinene, 1,8-cineole");
  add("boronia","Brown Boronia","native","🌸","#6b3a2a", .7,.85,.4,
    "flower:.9 sweet:.5 fruit:.4 wood:.2",
    ["boronia"],
    "Intensely sweet, fruity-floral and violet-like with a raspberry tone. Native to the south-west of Western Australia and prized in perfumery.",
    "β-ionone, dodecyl acetate",
    "Many people are partly blind to β-ionone (linked to the OR5A1 receptor gene), so boronia can smell very different from person to person.");
  add("wattle","Golden Wattle","native","🌼","#f7d117", .5,.7,.5,
    "flower:.7 sweet:.6 grass:.2 bakery:.1",
    ["wattle","acacia"],
    "Sweet, honeyed and powdery with a faint green note. Golden wattle is Australia's national floral emblem.",
    "");
  add("peppermintTree","WA Peppermint Tree","native","🌳","#6b8f4a", .6,.7,.75,
    "cold:.7 grass:.4 spices:.2 wood:.2",
    ["peppermint tree","agonis","willow myrtle"],
    "Crush a leaf and it releases a cool, peppermint-and-eucalyptus smell — hence the name. A common street and coastal tree in south-west WA.",
    "");

  /* ------------------------ ANIMALS & PEOPLE ----------------------- */
  add("wetdog","Wet Dog","animal","🐕","#8a6a4a", .6,-.2,.4,
    "musky:.6 decayed:.4 sweaty:.3 earthy:.3",
    ["dog","puppy","wet dog"],
    "Musty and damp with a warm, slightly sour animal note. Water releases volatile compounds made by bacteria and yeasts living on the fur.",
    "volatile by-products of microbes on fur");
  add("stable","Horse Stable","animal","🐴","#8b6b3a", .6,.3,.4,
    "musky:.5 grass:.5 earthy:.5 sweaty:.2 decayed:.2 ammonia:.2",
    ["horse","stable","barn","cow","farm"],
    "Warm and earthy — a mix of hay, leather, animal musk and a little ammonia.",
    "");
  add("wool","Wool / Lanolin","animal","🐑","#e9dcc0", .4,.3,.2,
    "musky:.5 sweaty:.3 earthy:.2 wood:.1 chemical:.1",
    ["sheep","wool","lanolin","wet wool"],
    "Oily and slightly sweet-animal, from lanolin — the natural wax that coats sheep's wool. Raw wool smells much stronger than washed knitwear.",
    "lanolin (wool wax) and its fatty-acid breakdown products");
  add("sweat","Sweat / Gym","animal","💪","#c8c1a0", .7,-.5,.4,
    "sweaty:.95 sour:.5 musky:.4 garlic:.2 ammonia:.1",
    ["sweat","gym","body odour","bo","feet","socks"],
    "Sour, cheesy and onion-like. Fresh sweat is nearly odourless — the smell is made by skin bacteria breaking it down.",
    "(E)-3-methyl-2-hexenoic acid, 3-methyl-3-sulfanylhexan-1-ol, isovaleric acid");
  add("skunk","Skunk","animal","🦨","#2b2b2b", .98,-.9,.6,
    "garlic:.7 decayed:.5 burnt:.4 chemical:.4",
    ["skunk"],
    "Overwhelming burnt-rubber, garlic and rotten-egg sulfur.",
    "(E)-2-butene-1-thiol, 3-methyl-1-butanethiol, thioacetates",
    "Its thioacetates slowly turn into thiols when wet — which is why a sprayed dog can smell worse after a bath.");
  add("beeswax","Beeswax","animal","🐝","#e8b84a", .4,.75,.15,
    "sweet:.6 flower:.2 musky:.2 wood:.1",
    ["beeswax","candle","honeycomb"],
    "Warm, honeyed and softly waxy, with a faint floral note from the hive.",
    "");

  /* ------------------------ HOME & MATERIALS ----------------------- */
  add("oldbook","Old Paper","home","📖","#c9a86a", .4,.75,.2,
    "sweet:.4 wood:.4 earthy:.3 musky:.2 bakery:.2",
    ["old book","books","paper","library","second hand bookshop"],
    "Sweet, woody and slightly vanilla-like over a dusty, musty base. As paper ages, its lignin and cellulose break down into compounds genuinely related to vanilla and almond.",
    "vanillin, benzaldehyde, furfural, 2-ethylhexanol (Strlič et al. 2009)");
  add("laundry","Fresh Laundry","home","🧺","#dbe9f6", .5,.85,.4,
    "flower:.5 musky:.5 sweet:.3 fruit:.2 chemical:.2",
    ["laundry","clean washing","detergent","clean sheets"],
    "Soft, 'clean', powdery-floral. Clean fabric itself smells of very little — the 'fresh laundry' smell is mostly perfume designed into detergents, so it differs by brand and country.",
    "fragrance additives: synthetic musks, aldehydes, linalool");
  add("oldtoy","Old Toy","home","🧸","#c9a98a", .3,.4,.2,
    "musky:.3 earthy:.3 sweet:.2 decayed:.1",
    ["teddy bear","toy","stuffed animal","plush"],
    "A soft, dusty, slightly stale smell — aged fabric, foam and household dust. It varies with what the toy is made of and where it's been.",
    "");
  add("electronics","New Electronics","home","💻","#b8c4d0", .3,.2,.6,
    "chemical:.7 burnt:.2 metallic:.2",
    ["laptop","phone","electronics","gadget","tv"],
    "Faint warm plastic, slightly sharp and chemical — off-gassing from new plastics, adhesives and flame retardants. Fades over days to weeks.",
    "volatile organic compounds from plastics and adhesives");
  add("newcar","New Car","home","🚗","#6a6f78", .6,.5,.5,
    "chemical:.8 sweet:.2 musky:.1",
    ["new car","car interior"],
    "Sweet-chemical, plasticky and faintly leathery — off-gassing from interior plastics, foams and adhesives. Fades over months.",
    "volatile organic compounds (e.g. toluene, xylenes, aldehydes)");
  add("metal","Metal / Coins","home","🪙","#a9b3bd", .3,.1,.5,
    "metallic:.95 chemical:.2 sour:.2 earthy:.1",
    ["knife","scissors","metal","fork","spoon","coins","keys","iron"],
    "Cold, sharp and coppery. That 'metal' smell on your hands is actually your skin's oils reacting with the iron — the metal itself is nearly odourless.",
    "1-octen-3-one (Glindemann et al. 2006)");
  add("surfwax","Surf Wax","home","🏄","#f2e6c8", .5,.7,.4,
    "sweet:.6 fruit:.3 flower:.2 chemical:.2",
    ["surfboard","surf wax"],
    "Sweet and waxy, usually scented on purpose with coconut or tropical fragrance — closer to sunscreen than anything oceanic.",
    "paraffin/beeswax base plus added fragrance (often coconut-type lactones)");
  add("sunscreen","Sunscreen","home","🧴","#fff3d6", .5,.75,.4,
    "sweet:.5 fruit:.3 flower:.3 chemical:.3",
    ["sunscreen","sunblock","sunblock lotion"],
    "Creamy, sweet and coconut-floral. The UV filters themselves contribute little; the 'beach' smell is mostly added fragrance.",
    "added fragrance, commonly coconut-type lactones");
  add("rubber","Tyres / Rubber","home","🛞","#2a2a2a", .6,0,.4,
    "chemical:.6 burnt:.5 sweet:.1 sour:.1",
    ["car","tire","tyre","rubber","road","bicycle","motorcycle"],
    "Warm, sharp and slightly sweet in a chemical way. Much stronger from a hot tyre than from rubber at room temperature.",
    "benzothiazole and other vulcanisation by-products");

  /* --------------------- CHEMICAL & INDUSTRIAL --------------------- */
  add("petrol","Petrol","chem","⛽","#8a7fb5", .85,.1,.85,
    "chemical:.95 sweet:.3 burnt:.2",
    ["gasoline","petrol","fuel","servo","gas station"],
    "Sharp, sweet and chemical, noticeable even in tiny amounts. Many people find it oddly pleasant despite it being harmful to breathe — pleasantness here is a divided average.",
    "aromatic hydrocarbons (toluene, xylenes), short-chain alkanes");
  add("acetone","Nail Polish Remover","chem","💅","#e7a6c7", .85,-.1,.95,
    "chemical:.9 sweet:.3 fruit:.3",
    ["nail polish","nail polish remover","acetone","solvent","pear drops"],
    "Sharp, sweet-solvent and fruity-chemical, evaporating almost instantly. Pear-drop sweets use related fruity-solvent esters.",
    "acetone or ethyl acetate");
  add("pool","Swimming Pool","chem","🏊","#6ec6e0", .75,.2,.8,
    "chemical:.9 sour:.2 cold:.2",
    ["pool","swimming pool","chlorine"],
    "Sharp, bleachy and stinging.",
    "chloramines (especially trichloramine)",
    "A strong 'chlorine' smell at a pool actually signals chloramines — chlorine reacting with sweat and urine. A well-kept pool smells of very little.");
  add("bleach","Bleach","chem","🧪","#f1f5f8", .9,-.2,.8,
    "chemical:.95 sour:.2 cold:.2",
    ["bleach","hypochlorite"],
    "Harsh, sharp and swimming-pool-like, with a slight sting in the nose. Never mix it with ammonia or acids — that releases toxic gases.",
    "hypochlorite / chlorine");
  add("ammonia","Ammonia","chem","🧴","#e8eef0", .95,-.6,.9,
    "ammonia:.95 chemical:.5 sour:.3",
    ["ammonia","urine","cat litter","window cleaner"],
    "Pungent, stinging and urine-like — you feel it as much as smell it. Found in some cleaners, and in stale urine as urea breaks down.",
    "ammonia (NH₃)");
  add("gas","Gas Leak (odorant)","chem","🔥","#8ca0b0", .9,-.7,.9,
    "decayed:.7 garlic:.6 chemical:.5 burnt:.2",
    ["gas","natural gas","lpg","gas leak"],
    "Rotten-cabbage sulfurous. Natural gas itself is odourless — suppliers add sulfur compounds so leaks can be noticed. If you smell it at home, get outside and call your gas emergency line.",
    "added thiols such as tert-butyl mercaptan; methane itself is odourless");
  add("sulfur","Rotten Egg","chem","🥚","#d8cf5a", .9,-.85,.9,
    "decayed:.9 garlic:.4 chemical:.3",
    ["rotten egg","rotten eggs","sulfur","sulphur","hydrogen sulfide","fart"],
    "Unmistakable, sickly rotten-egg sulfur.",
    "hydrogen sulfide (H₂S)",
    "At high concentrations hydrogen sulfide paralyses the sense of smell — which makes it more dangerous, not less.");
  add("paint","Fresh Paint","chem","🎨","#f0efe8", .7,0,.6,
    "chemical:.9 sweet:.1",
    ["paint","fresh paint","enamel"],
    "Sharp, solvent-chemical and slightly sweet. Water-based paints smell much milder than oil-based enamels.",
    "solvents and other volatile organic compounds");
  add("marker","Permanent Marker","chem","🖊️","#2b2b40", .8,.2,.85,
    "chemical:.9 sweet:.3 fruit:.1",
    ["marker","sharpie","texta","permanent marker"],
    "Sharp, sweet-solvent and heady — a quick hit that fades as the ink dries.",
    "alcohols and other solvents");
  add("cigarette","Stale Cigarette","chem","🚬","#9a9a9a", .85,-.5,.4,
    "burnt:.9 chemical:.4 wood:.2 decayed:.1 sweet:.1",
    ["cigarette","tobacco smoke","ashtray","smoke"],
    "Acrid, ashy and stale-sweet. Residue ('thirdhand smoke') clings to fabric and walls for months.",
    "pyridines, phenols, aldehydes");

  /* -------------------- descriptor keyword lexicon ------------------
     Used only when a typed word isn't in the library: we build a
     descriptor-only reading from recognised words, and say so. */
  const LEXICON = {
    edible:["food","tasty","delicious","savoury","savory","meal","cooking"],
    bakery:["bread","baked","baking","toast","toasty","cake","pastry","biscuit","cookie","malt","malty"],
    sweet:["sweet","sugar","sugary","candy","lolly","lollies","syrup","dessert"],
    fruit:["fruit","fruity","berry","juicy","jam","jammy","citrusy","tropical"],
    fish:["fish","fishy","seafood","briny","marine"],
    garlic:["sulfur","sulphur","sulfurous","eggy","oniony","gassy"],
    spices:["spicy","spice","spiced","peppery","curry"],
    cold:["cold","cool","cooling","icy","fresh","minty","menthol","crisp"],
    sour:["sour","tangy","tart","sharp"],
    burnt:["burnt","burning","smoke","smoky","smokey","char","charred","ash","ashy","roasted","roast"],
    acid:["acid","acidic","vinegary","stinging"],
    warm:["warm","cosy","cozy","hot"],
    musky:["musk","musky","animal","animalic","skin","powdery"],
    sweaty:["sweat","sweaty","body","armpit","cheesy","feet"],
    ammonia:["pee","urine","ammonia","wee"],
    decayed:["rotten","rot","rotting","decay","decaying","mould","mold","mouldy","moldy","musty","stale","damp","off","garbage","rubbish","bin"],
    wood:["wood","woody","oak","timber","sawdust","bark","resin","resinous"],
    grass:["grass","grassy","green","leaf","leafy","herb","herbal","herby","vegetal"],
    flower:["flower","flowers","floral","blossom","bloom","perfume","perfumed"],
    chemical:["chemical","plastic","plasticky","solvent","synthetic","medicinal","antiseptic","clean"],
    earthy:["earth","earthy","soil","dirt","dusty","dust","mud","muddy","moss","mossy","forest"],
    metallic:["metal","metallic","iron","copper","coins","blood","bloody","steel"]
  };
  const PLEASANT_WORDS = ["lovely","nice","beautiful","delicious","pleasant","sweet","fresh","clean","floral","cosy","cozy","yummy"];
  const UNPLEASANT_WORDS = ["gross","disgusting","rotten","rot","stinky","stink","foul","nasty","awful","off","vomit","sick","sewer","rubbish","garbage","sweaty"];

  /* ----------------- object-detection → scent mapping ---------------
     COCO-SSD recognises objects, not smells. Each mapping is an
     assumption about the object's typical smell, and is shown as such. */
  const COCO_TO_SCENT = {
    "banana":"banana", "apple":"apple", "orange":"orange", "broccoli":"greens",
    "carrot":"carrot", "hot dog":"grilled", "pizza":"pizza", "donut":"donut",
    "cake":"vanilla", "sandwich":"bakery", "wine glass":"wine", "cup":"coffee",
    "potted plant":"houseplant", "book":"oldbook", "vase":"rose", "teddy bear":"oldtoy",
    "dog":"wetdog", "horse":"stable", "sheep":"wool", "cow":"stable",
    "car":"rubber", "motorcycle":"rubber", "bus":"rubber", "truck":"rubber",
    "bicycle":"rubber", "skateboard":"rubber",
    "tv":"electronics", "laptop":"electronics", "mouse":"electronics",
    "remote":"electronics", "keyboard":"electronics", "cell phone":"electronics",
    "surfboard":"surfwax", "skis":"freshsnow", "snowboard":"freshsnow",
    "scissors":"metal", "knife":"metal", "fork":"metal", "spoon":"metal",
    "boat":"ocean", "toaster":"toast", "toothbrush":"mint",
    "backpack":"leather", "handbag":"leather", "suitcase":"leather",
    "baseball glove":"leather", "bed":"laundry"
  };

  window.OSMOS_DATA = { CATEGORIES, DESCRIPTORS, SCENTS, LEXICON, PLEASANT_WORDS, UNPLEASANT_WORDS, COCO_TO_SCENT };
})();
