// Crop guidance: typical figures PER ACRE for irrigated farming in India.
// These are general package-of-practice numbers, NOT a substitute for a soil test or local advice.
// Check with your Krishi Vigyan Kendra (KVK) or agriculture officer before relying on them.
// To add a crop, copy one block below and change the numbers. No other code needs to change.
//
// Days ("das") count from the sowing date. For crops that are transplanted (rice, tomato,
// onion) they count from the TRANSPLANTING date, so enter the transplanting date as the sowing date.
// Negative days are things to do before that date (nursery, land preparation).

const ACRE_M2 = 4046.86;

// ---- small builders so the crop blocks below stay short ----
const prep = (das, detail) => ({ das, type: 'prep', title: 'Prepare the land', detail });
const sow = (das, title, detail) => ({ das, type: 'sowing', title, detail });
const fert = (das, title, share, detail) => ({ das, type: 'fertilizer', title, share, detail });
const irr = (das, title, depth_cm, detail) => ({ das, type: 'irrigation', title, depth_cm, detail });
const weed = (das, detail) => ({ das, type: 'weeding', title: 'Weeding', detail });
const pest = (das, title, detail) => ({ das, type: 'pest', title, detail });
const harvest = (das, detail) => ({ das, type: 'harvest', title: 'Harvest', detail });
const other = (das, title, detail) => ({ das, type: 'other', title, detail });

const GUIDE = [
  {
    slug: 'wheat',
    name: 'Wheat',
    aliases: ['wheat', 'gehu', 'gehun', 'gehoon'],
    season: 'Rabi (sow late Oct to late Nov)',
    duration_days: [120, 140],
    seed: { min: 40, max: 50, unit: 'kg', note: 'Sow 5 cm deep in rows 20 cm apart. Treat seed with a fungicide.' },
    nutrients: { n: 48, p: 24, k: 16 },
    fym_tonnes: 4,
    water_mm: [400, 500],
    yield_quintal: [18, 22],
    schedule: [
      prep(-10, 'Plough 2 to 3 times and level. Spread farmyard manure (FYM) before the last ploughing.'),
      sow(0, 'Sow and apply basal fertilizer', 'Sow in rows with a seed drill if possible.'),
      fert(0, 'Basal fertilizer', { n: 0.5, p: 1, k: 1 }, 'Put all phosphorus and potash and half the nitrogen at sowing.'),
      irr(21, 'First irrigation (crown root stage)', 5, 'The most important irrigation. Do not skip or delay it.'),
      fert(22, 'Top-dress nitrogen', { n: 0.5 }, 'Spread urea after the first irrigation, when the soil is workable.'),
      weed(30, 'Remove weeds by hand or spray a recommended herbicide at 25 to 30 days.'),
      irr(42, 'Irrigation (tillering)', 5, 'Helps the plant make more shoots.'),
      pest(55, 'Watch for yellow rust and aphids', 'Look for yellow powder on leaves and small insects on the ear. Ask your KVK before spraying.'),
      irr(62, 'Irrigation (jointing)', 5, 'Stem is growing fast and needs water.'),
      irr(82, 'Irrigation (flowering)', 5, 'Water shortage now cuts yield badly.'),
      irr(102, 'Irrigation (grain filling)', 5, 'Last irrigation. Stop watering about 15 days before harvest.'),
      harvest(125, 'Harvest when the grain is hard and the straw is golden yellow, usually 120 to 140 days after sowing.'),
    ],
  },
  {
    slug: 'rice',
    name: 'Rice (paddy)',
    aliases: ['rice', 'paddy', 'dhan', 'chawal', 'basmati'],
    season: 'Kharif (nursery in June, transplant in July)',
    das_from: 'transplanting',
    duration_days: [90, 115],
    seed: { min: 8, max: 10, unit: 'kg', note: 'Seed for the nursery. Sow the nursery on about one tenth of the field area.' },
    nutrients: { n: 48, p: 24, k: 16 },
    fym_tonnes: 4,
    water_mm: [1200, 1500],
    yield_quintal: [20, 26],
    schedule: [
      sow(-25, 'Sow the nursery', 'Sow treated seed in a raised nursery bed. Seedlings are ready in 21 to 25 days.'),
      prep(-3, 'Puddle and level the field', 'Plough in standing water 2 to 3 times and level. Mix in farmyard manure (FYM).'),
      sow(0, 'Transplant seedlings', 'Plant 2 to 3 seedlings per hill, 20 cm by 15 cm apart.'),
      fert(0, 'Basal fertilizer', { n: 1 / 3, p: 1, k: 1 }, 'Put all phosphorus and potash and one third of the nitrogen at transplanting.'),
      irr(1, 'Keep water in the field', 5, 'Keep 2 to 5 cm of water standing from transplanting until the grain is in the dough stage.'),
      weed(20, 'Hand weeding or a recommended herbicide at 15 to 20 days. Weeds take a lot of fertilizer.'),
      fert(21, 'Top-dress nitrogen (tillering)', { n: 1 / 3 }, 'Spread urea when the plants start making new shoots.'),
      pest(30, 'Watch for stem borer, leaf folder and blast', 'Look for dead central shoots and grey spots on leaves. Ask your KVK before spraying.'),
      fert(45, 'Top-dress nitrogen (panicle start)', { n: 1 / 3 }, 'Last nitrogen dose, when the ear starts forming.'),
      irr(90, 'Drain the field', null, 'Let the water go about 10 days before harvest so the crop dries evenly.'),
      harvest(105, 'Harvest when 80 percent of the grains are golden and the lower ones are hard.'),
    ],
  },
  {
    slug: 'maize',
    name: 'Maize',
    aliases: ['maize', 'makka', 'makki', 'corn'],
    season: 'Kharif (sow June to July)',
    duration_days: [90, 110],
    seed: { min: 8, max: 10, unit: 'kg', note: 'Hybrid seed. Rows 60 cm apart, plants 20 cm apart.' },
    nutrients: { n: 48, p: 24, k: 16 },
    fym_tonnes: 4,
    water_mm: [500, 600],
    yield_quintal: [20, 28],
    schedule: [
      prep(-7, 'Prepare the land', 'Plough and level. Make sure rain water can drain out, maize cannot stand in water.'),
      sow(0, 'Sow the seed', 'Sow 4 to 5 cm deep.'),
      fert(0, 'Basal fertilizer', { n: 1 / 3, p: 1, k: 1 }, 'All phosphorus and potash and one third of the nitrogen at sowing.'),
      pest(15, 'Check for fall armyworm', 'Look inside the leaf whorl for chewed leaves and droppings. Act early and ask your KVK what to spray.'),
      weed(20, 'Weed and loosen the soil between rows.'),
      irr(25, 'Irrigation (knee-high stage)', 5, 'Only if rain has not come.'),
      fert(26, 'Top-dress nitrogen (knee-high)', { n: 1 / 3 }, 'Spread urea and earth up the rows.'),
      fert(48, 'Top-dress nitrogen (before tassel)', { n: 1 / 3 }, 'Last nitrogen dose.'),
      irr(50, 'Irrigation (tasseling)', 6, 'Water stress at tasseling and silking cuts yield the most.'),
      irr(65, 'Irrigation (silking)', 6, 'Do not let the field dry out.'),
      irr(80, 'Irrigation (grain filling)', 5, 'Only if the soil is dry.'),
      harvest(100, 'Harvest when the husk turns dry and the grain is hard with a black layer at the base.'),
    ],
  },
  {
    slug: 'cotton',
    name: 'Cotton',
    aliases: ['cotton', 'kapas', 'narma'],
    season: 'Kharif (sow May to June)',
    duration_days: [160, 190],
    seed: { min: 0.9, max: 1, unit: 'kg', note: 'Bt hybrid seed, about 2 packets of 450 g. Spacing about 90 cm by 60 cm.' },
    nutrients: { n: 60, p: 24, k: 24 },
    fym_tonnes: 4,
    water_mm: [700, 1000],
    yield_quintal: [6, 10],
    schedule: [
      prep(-10, 'Prepare the land', 'Deep plough, level, and mix in farmyard manure (FYM).'),
      sow(0, 'Sow the seed', 'Sow 2 to 3 seeds per hill and keep the strongest plant.'),
      fert(0, 'Basal fertilizer', { n: 1 / 3, p: 1, k: 0.5 }, 'All phosphorus, half of the potash and one third of the nitrogen.'),
      irr(0, 'Irrigation at sowing', 5, 'Sow in moist soil, or give a light irrigation right after sowing.'),
      weed(20, 'First weeding and thinning.'),
      irr(30, 'Irrigation (early growth)', 5, 'Only if the soil is dry.'),
      fert(40, 'Top-dress (squaring)', { n: 1 / 3, k: 0.5 }, 'Second dose of nitrogen and the rest of the potash.'),
      weed(45, 'Second weeding. Install pheromone traps to watch for bollworm.'),
      pest(45, 'Check for sucking pests and bollworm', 'Look at the underside of leaves every week for whitefly, jassids and aphids. Ask your KVK before spraying.'),
      irr(55, 'Irrigation (flowering)', 5, 'Important for flower and boll setting.'),
      fert(70, 'Top-dress nitrogen (flowering)', { n: 1 / 3 }, 'Last nitrogen dose.'),
      irr(80, 'Irrigation (boll formation)', 5, 'Keep the soil moist while bolls are forming.'),
      irr(105, 'Irrigation (boll development)', 5, 'Last irrigation if the weather is dry.'),
      harvest(150, 'Start picking when bolls open. Pick 3 to 4 times, every 15 to 20 days, until about 190 days.'),
    ],
  },
  {
    slug: 'soybean',
    name: 'Soybean',
    aliases: ['soybean', 'soyabean', 'soya', 'soy'],
    season: 'Kharif (sow late June to mid July)',
    duration_days: [90, 110],
    seed: { min: 28, max: 32, unit: 'kg', note: 'Treat seed with Rhizobium culture and a fungicide. Rows 45 cm apart.' },
    nutrients: { n: 8, p: 24, k: 16 },
    fym_tonnes: 2,
    water_mm: [450, 700],
    yield_quintal: [6, 10],
    schedule: [
      prep(-7, 'Prepare the land', 'Plough, level and make drainage channels. Soybean cannot stand in water.'),
      sow(0, 'Sow the seed', 'Sow 3 to 4 cm deep once the monsoon has settled.'),
      fert(0, 'Basal fertilizer', { n: 1, p: 1, k: 1 }, 'Apply everything at sowing. Soybean makes most of its own nitrogen.'),
      weed(20, 'First weeding at 20 days.'),
      weed(35, 'Second weeding at 35 days.'),
      pest(35, 'Watch for girdle beetle, stem fly and leaf eaters', 'Look at stems and leaves each week. Ask your KVK before spraying.'),
      irr(45, 'Irrigation (flowering), only if dry', 5, 'Give water if there has been no rain for 2 weeks.'),
      irr(70, 'Irrigation (pod filling), only if dry', 5, 'Water stress now reduces seed size.'),
      harvest(100, 'Harvest when leaves turn yellow and fall and the pods rattle.'),
    ],
  },
  {
    slug: 'chickpea',
    name: 'Chickpea (gram)',
    aliases: ['chickpea', 'chana', 'bengal gram', 'desi chana'],
    season: 'Rabi (sow mid Oct to mid Nov)',
    duration_days: [100, 120],
    seed: { min: 24, max: 30, unit: 'kg', note: 'Desi type. Treat seed with Rhizobium culture and a fungicide.' },
    nutrients: { n: 8, p: 16, k: 8 },
    fym_tonnes: 2,
    water_mm: [250, 300],
    yield_quintal: [6, 9],
    schedule: [
      prep(-7, 'Prepare the land', 'Plough once or twice and level. Chickpea needs well drained soil.'),
      sow(0, 'Sow the seed', 'Sow 8 to 10 cm deep in moist soil, rows 30 cm apart.'),
      fert(0, 'Basal fertilizer', { n: 1, p: 1, k: 1 }, 'Apply everything at sowing.'),
      weed(30, 'One hoeing and weeding at 30 days.'),
      irr(38, 'Irrigation (branching)', 5, 'Chickpea needs only 1 or 2 irrigations. Do not over-water.'),
      irr(68, 'Irrigation (pod filling)', 5, 'Only if the soil is dry. Too much water causes more leaf than pod.'),
      pest(70, 'Watch for pod borer and wilt', 'Look for holes in pods and caterpillars. Pheromone traps help. Ask your KVK before spraying.'),
      harvest(110, 'Harvest when leaves turn yellow and the pods are dry.'),
    ],
  },
  {
    slug: 'mustard',
    name: 'Mustard',
    aliases: ['mustard', 'sarson', 'sarso', 'rapeseed', 'rai'],
    season: 'Rabi (sow October)',
    duration_days: [110, 140],
    seed: { min: 1.5, max: 2, unit: 'kg', note: 'Rows 30 to 45 cm apart. Thin to one plant every 10 to 15 cm after 15 to 20 days.' },
    nutrients: { n: 32, p: 16, k: 16 },
    extras: [{ name: 'Gypsum (for sulphur, about 8 kg S)', kg_per_acre: 45 }],
    fym_tonnes: 4,
    water_mm: [240, 400],
    yield_quintal: [6, 9],
    schedule: [
      prep(-7, 'Prepare the land', 'Plough and level to a fine seedbed. Mustard seed is very small.'),
      sow(0, 'Sow the seed', 'Mix seed with sand or dry soil to sow evenly. Sow 2 to 3 cm deep.'),
      fert(0, 'Basal fertilizer', { n: 0.5, p: 1, k: 1 }, 'All phosphorus and potash, half the nitrogen and the gypsum (sulphur).'),
      other(18, 'Thin the plants', 'Keep one healthy plant every 10 to 15 cm.'),
      irr(28, 'Irrigation (rosette / branching)', 5, 'First irrigation. Give it at the same time as the nitrogen top-dress.'),
      fert(28, 'Top-dress nitrogen', { n: 0.5 }, 'Spread urea at the first irrigation.'),
      irr(55, 'Irrigation (flowering)', 5, 'Important for seed setting.'),
      pest(65, 'Watch for aphids', 'Check flower stalks in cool, cloudy weather. Ask your KVK before spraying.'),
      irr(80, 'Irrigation (pod filling)', 5, 'Only if the soil is dry.'),
      harvest(120, 'Harvest when about 75 percent of the pods turn yellow. Do not wait too long or the pods burst.'),
    ],
  },
  {
    slug: 'groundnut',
    name: 'Groundnut',
    aliases: ['groundnut', 'peanut', 'moongfali', 'mungfali', 'moongphali'],
    season: 'Kharif (sow June to July)',
    duration_days: [100, 130],
    seed: { min: 40, max: 50, unit: 'kg', note: 'Seed kernels (not pods). Treat with a fungicide. Rows 30 cm apart.' },
    nutrients: { n: 8, p: 16, k: 16 },
    extras: [{ name: 'Gypsum (at flowering and pegging)', kg_per_acre: 200 }],
    fym_tonnes: 4,
    water_mm: [500, 600],
    yield_quintal: [8, 12],
    schedule: [
      prep(-7, 'Prepare the land', 'Plough deeply and make the soil loose and well drained so pegs can enter the soil.'),
      sow(0, 'Sow the seed', 'Sow 5 cm deep.'),
      fert(0, 'Basal fertilizer', { n: 1, p: 1, k: 1 }, 'Apply everything at sowing.'),
      weed(20, 'First weeding at 20 days.'),
      irr(25, 'Irrigation (early growth), only if dry', 5, 'Groundnut is often rain-fed. Water only in a dry spell.'),
      other(35, 'Apply gypsum and earth up', 'Spread gypsum around the plants at flowering and lightly earth up so the pegs go into the soil.'),
      irr(45, 'Irrigation (pegging)', 5, 'Moisture is important while pegs enter the soil.'),
      pest(45, 'Watch for leaf spot and leaf miner', 'Look for brown spots on leaves. Ask your KVK before spraying.'),
      irr(65, 'Irrigation (pod development)', 5, 'Keep the soil moist but not wet.'),
      harvest(110, 'Harvest when leaves yellow and the inside of the pod shell shows dark marks.'),
    ],
  },
  {
    slug: 'potato',
    name: 'Potato',
    aliases: ['potato', 'aloo', 'alu'],
    season: 'Rabi (plant mid Oct to mid Nov in the plains)',
    duration_days: [80, 110],
    seed: { min: 1000, max: 1400, unit: 'kg', note: 'Healthy seed tubers of 30 to 50 g. Rows 60 cm apart, tubers 20 cm apart.' },
    nutrients: { n: 72, p: 32, k: 40 },
    fym_tonnes: 8,
    water_mm: [500, 700],
    yield_quintal: [80, 120],
    schedule: [
      prep(-10, 'Prepare the land', 'Plough 3 to 4 times to a fine soil. Mix in farmyard manure (FYM).'),
      sow(0, 'Plant the tubers', 'Plant 5 to 7 cm deep in ridges.'),
      fert(0, 'Basal fertilizer', { n: 0.5, p: 1, k: 1 }, 'All phosphorus and potash and half the nitrogen.'),
      irr(10, 'First light irrigation', 4, 'Give light irrigation, 7 to 10 days after planting.'),
      weed(20, 'Weed the field.'),
      irr(25, 'Irrigation with earthing up', 4, 'Earth up the ridges at 25 to 30 days.'),
      fert(26, 'Top-dress nitrogen', { n: 0.5 }, 'Spread urea and earth up.'),
      irr(40, 'Irrigation', 4, 'Light irrigation every 8 to 10 days, never let water stand.'),
      pest(40, 'Late blight and aphid watch', 'In cool, foggy or humid weather, look for dark spots on leaves. Protective sprays work best before it starts. Ask your KVK.'),
      irr(55, 'Irrigation', 4, 'Tubers are forming, keep the soil evenly moist.'),
      irr(70, 'Irrigation', 4, 'Last irrigation.'),
      other(82, 'Cut the haulms', 'Cut the vines about 10 days before digging so the skin hardens.'),
      harvest(92, 'Dig when the skin does not peel when rubbed. Stop irrigation 10 days before.'),
    ],
  },
  {
    slug: 'tomato',
    name: 'Tomato',
    aliases: ['tomato', 'tamatar'],
    season: 'Can be grown in most seasons. Avoid peak summer heat',
    das_from: 'transplanting',
    duration_days: [90, 130],
    seed: { min: 100, max: 150, unit: 'g', note: 'Seed for the nursery. About 12,000 to 15,000 seedlings per acre, plants 60 cm by 45 cm.' },
    nutrients: { n: 48, p: 24, k: 24 },
    fym_tonnes: 8,
    water_mm: [600, 800],
    yield_quintal: [100, 200],
    schedule: [
      sow(-28, 'Sow the nursery', 'Sow in a raised bed or trays. Seedlings are ready in 25 to 30 days.'),
      prep(-10, 'Prepare the land', 'Plough to a fine soil and mix in farmyard manure (FYM).'),
      sow(0, 'Transplant seedlings', 'Transplant in the evening and water straight away.'),
      fert(0, 'Basal fertilizer', { n: 1 / 3, p: 1, k: 0.5 }, 'All phosphorus, half of the potash and one third of the nitrogen.'),
      irr(1, 'Irrigation after transplanting', 4, 'Light irrigation every 7 to 10 days. Do not let the field dry out then flood it, that splits the fruit.'),
      irr(17, 'Irrigation', 4, 'Keep the moisture even.'),
      weed(20, 'Weed and loosen the soil.'),
      other(25, 'Stake the plants', 'Tie plants to stakes so fruit stays off the soil.'),
      pest(25, 'Weekly check for whitefly, fruit borer and blight', 'Look for curled yellow leaves, holes in fruit and dark leaf spots. Ask your KVK before spraying.'),
      fert(30, 'Top-dress (growth)', { n: 1 / 3, k: 0.5 }, 'Second dose of nitrogen and the rest of the potash.'),
      irr(37, 'Irrigation', 4, 'Flowering starts, keep the soil moist.'),
      weed(40, 'Second weeding.'),
      fert(50, 'Top-dress nitrogen (fruiting)', { n: 1 / 3 }, 'Last nitrogen dose.'),
      irr(55, 'Irrigation', 4, 'Fruit is setting.'),
      harvest(65, 'Start picking when fruit turns pink to red. Pick every 3 to 4 days for 6 to 8 weeks.'),
    ],
  },
  {
    slug: 'onion',
    name: 'Onion',
    aliases: ['onion', 'pyaz', 'pyaaz', 'kanda'],
    season: 'Rabi (nursery Oct to Nov, transplant Dec to Jan) or Kharif',
    das_from: 'transplanting',
    duration_days: [100, 130],
    seed: { min: 3, max: 4, unit: 'kg', note: 'Seed for the nursery. Seedlings are ready in 6 to 8 weeks. Plants 15 cm by 10 cm.' },
    nutrients: { n: 40, p: 20, k: 20 },
    fym_tonnes: 8,
    water_mm: [350, 550],
    yield_quintal: [80, 120],
    schedule: [
      sow(-45, 'Sow the nursery', 'Sow in a raised bed. Seedlings are ready in 6 to 8 weeks.'),
      prep(-10, 'Prepare the land', 'Plough to a fine soil and mix in farmyard manure (FYM). Make flat beds.'),
      sow(0, 'Transplant seedlings', 'Trim the leaf tips and plant 2 to 3 cm deep.'),
      fert(0, 'Basal fertilizer', { n: 0.5, p: 1, k: 1 }, 'All phosphorus and potash and half the nitrogen.'),
      irr(1, 'Irrigation after transplanting', 4, 'Light irrigation every 7 to 10 days.'),
      irr(17, 'Irrigation', 4, 'Keep the top soil moist.'),
      weed(20, 'Weed by hand. Onion roots are shallow, so avoid deep hoeing.'),
      fert(30, 'Top-dress nitrogen', { n: 0.25 }, 'Spread urea and water it in.'),
      pest(30, 'Watch for thrips and purple blotch', 'Look for silver streaks on leaves and purple spots. Ask your KVK before spraying.'),
      weed(40, 'Second weeding.'),
      irr(45, 'Irrigation (bulb growth)', 4, 'Bulbs are forming, do not let the soil dry out.'),
      fert(46, 'Top-dress nitrogen', { n: 0.25 }, 'Last nitrogen dose.'),
      irr(85, 'Irrigation', 4, 'Last irrigation.'),
      irr(100, 'Stop irrigation', null, 'Stop watering 10 to 15 days before harvest so bulbs mature.'),
      harvest(110, 'Harvest when 50 to 75 percent of the tops have fallen over. Dry in the shade for 7 to 10 days before storing.'),
    ],
  },
];

// ---------- calculations (pure functions, easy to test) ----------

const r1 = (x) => Math.round(x * 10) / 10;

function findGuide(name) {
  const q = String(name || '').trim().toLowerCase();
  if (!q) return null;
  const words = q.split(/[^a-z]+/).filter(Boolean);
  return (
    GUIDE.find((g) => g.aliases.includes(q)) ||
    GUIDE.find((g) => g.aliases.some((alias) => words.includes(alias) || (alias.includes(' ') && q.includes(alias)))) ||
    null
  );
}

// Turns nutrient kg (N, P2O5, K2O) into the fertilizer bags a farmer actually buys:
// DAP (18-46-0) gives the phosphorus plus some nitrogen, urea (46% N) covers the rest, MOP (60% K2O) gives potash.
function fertilizerProducts({ n = 0, p = 0, k = 0 }) {
  const dap = p / 0.46;
  const urea = Math.max(0, n - dap * 0.18) / 0.46;
  const mop = k / 0.6;
  const out = [];
  if (dap > 0.05) out.push({ name: 'DAP', kg: r1(dap) });
  if (urea > 0.05) out.push({ name: 'Urea', kg: r1(urea) });
  if (mop > 0.05) out.push({ name: 'MOP (potash)', kg: r1(mop) });
  return out;
}

const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (fromIso, toIso) =>
  Math.round((new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)) / 86400000);

// Builds the guidance for one crop: totals for its area plus a dated task list.
function buildGuidance(guide, { area_acres, sowing_date }, today = new Date().toISOString().slice(0, 10)) {
  const hasArea = Number.isFinite(area_acres) && area_acres > 0;
  const area = hasArea ? area_acres : 1;
  const scale = (x) => r1(x * area);

  const total = {
    seed: { min: r1(guide.seed.min * area), max: r1(guide.seed.max * area), unit: guide.seed.unit },
    nutrients: { n: scale(guide.nutrients.n), p: scale(guide.nutrients.p), k: scale(guide.nutrients.k) },
    products: fertilizerProducts({
      n: guide.nutrients.n * area,
      p: guide.nutrients.p * area,
      k: guide.nutrients.k * area,
    }),
    extras: (guide.extras || []).map((e) => ({ name: e.name, kg: r1(e.kg_per_acre * area) })),
    fym_tonnes: r1(guide.fym_tonnes * area),
    water_litres: {
      min: Math.round(guide.water_mm[0] * ACRE_M2 * area),
      max: Math.round(guide.water_mm[1] * ACRE_M2 * area),
    },
    yield_quintal: { min: r1(guide.yield_quintal[0] * area), max: r1(guide.yield_quintal[1] * area) },
  };

  const tasks = guide.schedule
    .map((t) => {
      const task = {
        das: t.das,
        type: t.type,
        title: t.title,
        detail: t.detail,
        date: sowing_date ? addDays(sowing_date, t.das) : null,
      };
      if (t.type === 'fertilizer') {
        const part = {
          n: guide.nutrients.n * (t.share.n || 0) * area,
          p: guide.nutrients.p * (t.share.p || 0) * area,
          k: guide.nutrients.k * (t.share.k || 0) * area,
        };
        task.products = fertilizerProducts(part);
      }
      if (t.type === 'irrigation' && t.depth_cm) {
        task.depth_cm = t.depth_cm;
        task.water_litres = Math.round((t.depth_cm * 40468.6 * area) / 1000) * 1000; // 1 cm of water on 1 acre is about 40,469 litres
      }
      if (task.date) {
        task.days_from_today = daysBetween(today, task.date);
        task.when =
          task.days_from_today < 0 ? 'past' : task.days_from_today === 0 ? 'today' : task.days_from_today <= 7 ? 'soon' : 'later';
      }
      return task;
    })
    .sort((a, b) => a.das - b.das);

  return {
    matched: true,
    slug: guide.slug,
    guide_name: guide.name,
    season: guide.season,
    das_from: guide.das_from || 'sowing',
    duration_days: guide.duration_days,
    area_acres: hasArea ? area_acres : null,
    per_acre_only: !hasArea,
    seed_note: guide.seed.note,
    per_acre: {
      seed: { min: guide.seed.min, max: guide.seed.max, unit: guide.seed.unit },
      nutrients: guide.nutrients,
      fym_tonnes: guide.fym_tonnes,
      water_mm: guide.water_mm,
      yield_quintal: guide.yield_quintal,
    },
    total,
    tasks,
  };
}

const listGuides = () => GUIDE.map((g) => ({ slug: g.slug, name: g.name, season: g.season }));

module.exports = { GUIDE, findGuide, buildGuidance, fertilizerProducts, listGuides, addDays };
