import { cleanLegoInput } from './brickset';

export interface LegoSetResult {
  setNumber: string;
  /** Brickset set number used to fetch the official RRP for a minifigure. */
  bricksetSetNumber?: string;
  name: string;
  theme: string;
  year?: number;
  pieces?: number;
  rrpEur?: number;
  imageUrl: string;
  type?: 'set' | 'minifig';
}

const BRICKSET_MINIFIG_SET_NUMBERS: Record<string, string> = {
  // Brickset stores this collectible minifigure under its containing set.
  COLSPI01: '71050',
};

export const getBricksetSetNumber = (itemNumber: string): string | undefined =>
  BRICKSET_MINIFIG_SET_NUMBERS[itemNumber.trim().toUpperCase()];

export const normalizeSetNumber = (raw: string): string => {
  const cleaned = raw.trim().replace(/\s+/g, '');
  // If user entered e.g. 75192-1 or 10316-2, strip the -1 for consistency
  if (/^\d+-\d+$/.test(cleaned)) {
    return cleaned.replace(/-\d+$/, '');
  }
  return cleaned;
};

export const getLegoImageUrl = (setNumber: string): string => {
  const cleaned = cleanLegoInput(setNumber);
  if (cleaned.itemType === 'MINIFIG') {
    const associatedSet = getBricksetSetNumber(cleaned.itemNo);
    if (associatedSet) {
      return `https://images.brickset.com/sets/images/${associatedSet}-1.jpg`;
    }
    return `https://img.bricklink.com/ItemImage/MN/0/${cleaned.itemNo}.png`;
  }
  const base = normalizeSetNumber(cleaned.itemNo);
  return `https://images.brickset.com/sets/images/${base}-1.jpg`;
};

// Curated database of iconic and popular investment LEGO sets with official RRP in EUR
export const POPULAR_LEGO_SETS: LegoSetResult[] = [
  // Star Wars UCS & Icons
  {
    setNumber: '75192',
    name: 'Millennium Falcon (UCS)',
    theme: 'Star Wars',
    year: 2017,
    pieces: 7541,
    rrpEur: 849.99,
    imageUrl: 'https://images.brickset.com/sets/images/75192-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75313',
    name: 'AT-AT (UCS)',
    theme: 'Star Wars',
    year: 2021,
    pieces: 6785,
    rrpEur: 849.99,
    imageUrl: 'https://images.brickset.com/sets/images/75313-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75252',
    name: 'Imperial Star Destroyer (UCS)',
    theme: 'Star Wars',
    year: 2019,
    pieces: 4784,
    rrpEur: 699.99,
    imageUrl: 'https://images.brickset.com/sets/images/75252-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75331',
    name: 'The Razor Crest (UCS)',
    theme: 'Star Wars',
    year: 2022,
    pieces: 6187,
    rrpEur: 599.99,
    imageUrl: 'https://images.brickset.com/sets/images/75331-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75367',
    name: 'Venator-Class Republic Attack Cruiser (UCS)',
    theme: 'Star Wars',
    year: 2023,
    pieces: 5374,
    rrpEur: 649.99,
    imageUrl: 'https://images.brickset.com/sets/images/75367-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75382',
    name: 'TIE Interceptor (UCS)',
    theme: 'Star Wars',
    year: 2024,
    pieces: 1931,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/75382-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75308',
    name: 'R2-D2',
    theme: 'Star Wars',
    year: 2021,
    pieces: 2314,
    rrpEur: 239.99,
    imageUrl: 'https://images.brickset.com/sets/images/75308-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75337',
    name: 'AT-TE Walker',
    theme: 'Star Wars',
    year: 2022,
    pieces: 1082,
    rrpEur: 139.99,
    imageUrl: 'https://images.brickset.com/sets/images/75337-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75060',
    name: 'Slave I (UCS)',
    theme: 'Star Wars',
    year: 2015,
    pieces: 1996,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/75060-1.jpg',
    type: 'set',
  },

  // Icons / Lord of the Rings / Creator Expert
  {
    setNumber: '10316',
    name: 'The Lord of the Rings: Rivendell',
    theme: 'Icons',
    year: 2023,
    pieces: 6167,
    rrpEur: 499.99,
    imageUrl: 'https://images.brickset.com/sets/images/10316-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10333',
    name: 'The Lord of the Rings: Barad-dûr',
    theme: 'Icons',
    year: 2024,
    pieces: 5471,
    rrpEur: 459.99,
    imageUrl: 'https://images.brickset.com/sets/images/10333-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10294',
    name: 'Titanic',
    theme: 'Icons',
    year: 2021,
    pieces: 9090,
    rrpEur: 679.99,
    imageUrl: 'https://images.brickset.com/sets/images/10294-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10307',
    name: 'Eiffel Tower',
    theme: 'Icons',
    year: 2022,
    pieces: 10001,
    rrpEur: 629.99,
    imageUrl: 'https://images.brickset.com/sets/images/10307-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10276',
    name: 'Colosseum',
    theme: 'Icons',
    year: 2020,
    pieces: 9036,
    rrpEur: 549.99,
    imageUrl: 'https://images.brickset.com/sets/images/10276-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10305',
    name: 'Lion Knights’ Castle',
    theme: 'Icons',
    year: 2022,
    pieces: 4514,
    rrpEur: 399.99,
    imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10497',
    name: 'Galaxy Explorer',
    theme: 'Icons',
    year: 2022,
    pieces: 1254,
    rrpEur: 99.99,
    imageUrl: 'https://images.brickset.com/sets/images/10497-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10300',
    name: 'Back to the Future Time Machine',
    theme: 'Icons',
    year: 2022,
    pieces: 1872,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10300-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10265',
    name: 'Ford Mustang',
    theme: 'Creator Expert',
    year: 2019,
    pieces: 1471,
    rrpEur: 169.99,
    imageUrl: 'https://images.brickset.com/sets/images/10265-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10274',
    name: 'Ghostbusters ECTO-1',
    theme: 'Icons',
    year: 2020,
    pieces: 2352,
    rrpEur: 239.99,
    imageUrl: 'https://images.brickset.com/sets/images/10274-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10323',
    name: 'PAC-MAN Arcade',
    theme: 'Icons',
    year: 2023,
    pieces: 2651,
    rrpEur: 269.99,
    imageUrl: 'https://images.brickset.com/sets/images/10323-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10318',
    name: 'Concorde',
    theme: 'Icons',
    year: 2023,
    pieces: 2083,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10318-1.jpg',
    type: 'set',
  },

  // Modular Buildings
  {
    setNumber: '10326',
    name: 'Natural History Museum',
    theme: 'Modular Buildings',
    year: 2023,
    pieces: 4014,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/10326-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10312',
    name: 'Jazz Club',
    theme: 'Modular Buildings',
    year: 2023,
    pieces: 2899,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/10312-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10297',
    name: 'Boutique Hotel',
    theme: 'Modular Buildings',
    year: 2022,
    pieces: 3066,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/10297-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10278',
    name: 'Police Station',
    theme: 'Modular Buildings',
    year: 2021,
    pieces: 2923,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10278-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10270',
    name: 'Bookshop',
    theme: 'Modular Buildings',
    year: 2020,
    pieces: 2504,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10270-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10255',
    name: 'Assembly Square',
    theme: 'Modular Buildings',
    year: 2017,
    pieces: 4002,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/10255-1.jpg',
    type: 'set',
  },

  // Ideas
  {
    setNumber: '21318',
    name: 'Tree House',
    theme: 'Ideas',
    year: 2019,
    pieces: 3036,
    rrpEur: 249.99,
    imageUrl: 'https://images.brickset.com/sets/images/21318-1.jpg',
    type: 'set',
  },
  {
    setNumber: '21325',
    name: 'Medieval Blacksmith',
    theme: 'Ideas',
    year: 2021,
    pieces: 2164,
    rrpEur: 179.99,
    imageUrl: 'https://images.brickset.com/sets/images/21325-1.jpg',
    type: 'set',
  },
  {
    setNumber: '21330',
    name: 'Home Alone McCallister House',
    theme: 'Ideas',
    year: 2021,
    pieces: 3955,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/21330-1.jpg',
    type: 'set',
  },
  {
    setNumber: '21338',
    name: 'A-Frame Cabin',
    theme: 'Ideas',
    year: 2023,
    pieces: 2082,
    rrpEur: 179.99,
    imageUrl: 'https://images.brickset.com/sets/images/21338-1.jpg',
    type: 'set',
  },
  {
    setNumber: '21344',
    name: 'The Orient Express Train',
    theme: 'Ideas',
    year: 2023,
    pieces: 2540,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/21344-1.jpg',
    type: 'set',
  },
  {
    setNumber: '21348',
    name: 'Dungeons & Dragons: Red Dragon’s Tale',
    theme: 'Ideas',
    year: 2024,
    pieces: 3745,
    rrpEur: 359.99,
    imageUrl: 'https://images.brickset.com/sets/images/21348-1.jpg',
    type: 'set',
  },

  // Technic Supercars & Vehicles
  {
    setNumber: '42115',
    name: 'Lamborghini Sián FKP 37',
    theme: 'Technic',
    year: 2020,
    pieces: 3696,
    rrpEur: 449.99,
    imageUrl: 'https://images.brickset.com/sets/images/42115-1.jpg',
    type: 'set',
  },
  {
    setNumber: '42143',
    name: 'Ferrari Daytona SP3',
    theme: 'Technic',
    year: 2022,
    pieces: 3778,
    rrpEur: 449.99,
    imageUrl: 'https://images.brickset.com/sets/images/42143-1.jpg',
    type: 'set',
  },
  {
    setNumber: '42083',
    name: 'Bugatti Chiron',
    theme: 'Technic',
    year: 2018,
    pieces: 3599,
    rrpEur: 369.99,
    imageUrl: 'https://images.brickset.com/sets/images/42083-1.jpg',
    type: 'set',
  },
  {
    setNumber: '42056',
    name: 'Porsche 911 GT3 RS',
    theme: 'Technic',
    year: 2016,
    pieces: 2704,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/42056-1.jpg',
    type: 'set',
  },
  {
    setNumber: '42171',
    name: 'Mercedes-AMG F1 W14 E Performance',
    theme: 'Technic',
    year: 2024,
    pieces: 1642,
    rrpEur: 219.99,
    imageUrl: 'https://images.brickset.com/sets/images/42171-1.jpg',
    type: 'set',
  },
  {
    setNumber: '42141',
    name: 'McLaren Formula 1 Race Car',
    theme: 'Technic',
    year: 2022,
    pieces: 1432,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/42141-1.jpg',
    type: 'set',
  },

  // Harry Potter
  {
    setNumber: '71043',
    name: 'Hogwarts Castle',
    theme: 'Harry Potter',
    year: 2018,
    pieces: 6020,
    rrpEur: 469.99,
    imageUrl: 'https://images.brickset.com/sets/images/71043-1.jpg',
    type: 'set',
  },
  {
    setNumber: '75978',
    name: 'Diagon Alley',
    theme: 'Harry Potter',
    year: 2020,
    pieces: 5544,
    rrpEur: 449.99,
    imageUrl: 'https://images.brickset.com/sets/images/75978-1.jpg',
    type: 'set',
  },
  {
    setNumber: '76417',
    name: 'Gringotts Wizarding Bank – Collectors’ Edition',
    theme: 'Harry Potter',
    year: 2023,
    pieces: 4803,
    rrpEur: 429.99,
    imageUrl: 'https://images.brickset.com/sets/images/76417-1.jpg',
    type: 'set',
  },

  // Marvel & DC
  {
    setNumber: '76178',
    name: 'Daily Bugle',
    theme: 'Marvel Super Heroes',
    year: 2021,
    pieces: 3772,
    rrpEur: 349.99,
    imageUrl: 'https://images.brickset.com/sets/images/76178-1.jpg',
    type: 'set',
  },
  {
    setNumber: '76269',
    name: 'Avengers Tower',
    theme: 'Marvel Super Heroes',
    year: 2023,
    pieces: 5201,
    rrpEur: 499.99,
    imageUrl: 'https://images.brickset.com/sets/images/76269-1.jpg',
    type: 'set',
  },
  {
    setNumber: '76240',
    name: 'Batmobile Tumbler',
    theme: 'DC Super Heroes',
    year: 2021,
    pieces: 2049,
    rrpEur: 269.99,
    imageUrl: 'https://images.brickset.com/sets/images/76240-1.jpg',
    type: 'set',
  },

  // Botanicals & Others
  {
    setNumber: '10280',
    name: 'Flower Bouquet',
    theme: 'Botanical Collection',
    year: 2021,
    pieces: 756,
    rrpEur: 59.99,
    imageUrl: 'https://images.brickset.com/sets/images/10280-1.jpg',
    type: 'set',
  },
  {
    setNumber: '10281',
    name: 'Bonsai Tree',
    theme: 'Botanical Collection',
    year: 2021,
    pieces: 878,
    rrpEur: 49.99,
    imageUrl: 'https://images.brickset.com/sets/images/10281-1.jpg',
    type: 'set',
  },
  {
    setNumber: '77015',
    name: 'Temple of the Golden Idol',
    theme: 'Indiana Jones',
    year: 2023,
    pieces: 1545,
    rrpEur: 149.99,
    imageUrl: 'https://images.brickset.com/sets/images/77015-1.jpg',
    type: 'set',
  },
];

// Curated database of iconic, rare and collectible investment LEGO minifigures
export const POPULAR_LEGO_MINIFIGS: LegoSetResult[] = [
  {
    setNumber: 'sw0107',
    name: 'Boba Fett - Cloud City (Printed Arms & Legs)',
    theme: 'Star Wars Minifigures',
    year: 2003,
    pieces: 4,
    rrpEur: 1800.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0107.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0450',
    name: 'Captain Rex (Phase 2 with Pauldron)',
    theme: 'Star Wars Minifigures',
    year: 2013,
    pieces: 4,
    rrpEur: 160.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0450.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0115',
    name: 'Grand Admiral Thrawn',
    theme: 'Star Wars Minifigures',
    year: 2017,
    pieces: 4,
    rrpEur: 110.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0115.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0377',
    name: 'Clone Commander Wolffe',
    theme: 'Star Wars Minifigures',
    year: 2011,
    pieces: 4,
    rrpEur: 125.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0377.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0500',
    name: 'Jedi Knight Revan (Polybag Exclusive)',
    theme: 'Star Wars Minifigures',
    year: 2014,
    pieces: 4,
    rrpEur: 280.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0500.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0540',
    name: 'Darth Vader (Printed Arms)',
    theme: 'Star Wars Minifigures',
    year: 2014,
    pieces: 5,
    rrpEur: 75.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0540.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0742',
    name: 'Sabine Wren (with Helmet)',
    theme: 'Star Wars Minifigures',
    year: 2016,
    pieces: 4,
    rrpEur: 140.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0742.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sw0001a',
    name: 'Battle Droid (Tan with 1 Straight Arm)',
    theme: 'Star Wars Minifigures',
    year: 1999,
    pieces: 6,
    rrpEur: 5.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sw0001a.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'col143',
    name: 'Mr. Gold (Series 10 Collectible Minifigure)',
    theme: 'Collectible Minifigures',
    year: 2013,
    pieces: 5,
    rrpEur: 4500.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/col143.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sh030',
    name: 'Deadpool',
    theme: 'Marvel Super Heroes Minifigures',
    year: 2012,
    pieces: 4,
    rrpEur: 55.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sh030.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'sh012',
    name: 'Iron Man (Mark 6 Armor - Triangle on Chest)',
    theme: 'Marvel Super Heroes Minifigures',
    year: 2012,
    pieces: 4,
    rrpEur: 35.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sh012.jpg',
    type: 'minifig',
  },
  {
    setNumber: 'fig-000001',
    name: 'Classic Space Astronaut - Red',
    theme: 'Classic Space Minifigures',
    year: 1978,
    pieces: 5,
    rrpEur: 35.0,
    imageUrl: 'https://images.brickset.com/minifigs/images/sp005.jpg',
    type: 'minifig',
  },
];

export const ALL_CURATED_LEGO_ITEMS: LegoSetResult[] = [
  ...POPULAR_LEGO_SETS,
  ...POPULAR_LEGO_MINIFIGS,
];

export const searchLegoSets = async (
  query: string,
  apiKey?: string,
): Promise<LegoSetResult[]> => {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const keyToUse =
    apiKey ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('strata_rebrickable_key') ?? undefined
      : undefined);

  // 1. Search local curated sets and minifigures
  const localMatches = ALL_CURATED_LEGO_ITEMS.filter((item) => {
    return (
      item.setNumber.toLowerCase().includes(trimmed) ||
      item.name.toLowerCase().includes(trimmed) ||
      item.theme.toLowerCase().includes(trimmed)
    );
  });

  // 2. If an API key is available, query Rebrickable for full catalog (both sets and minifigs)
  if (keyToUse) {
    try {
      const headers = { Authorization: `key ${keyToUse}` };
      const encoded = encodeURIComponent(trimmed);

      // Concurrently query sets and minifigures
      const [setsRes, minifigsRes] = await Promise.allSettled([
        fetch(
          `https://rebrickable.com/api/v3/lego/sets/?search=${encoded}&page_size=15`,
          { headers },
        ),
        fetch(
          `https://rebrickable.com/api/v3/lego/minifigs/?search=${encoded}&page_size=15`,
          { headers },
        ),
      ]);

      const apiResults: LegoSetResult[] = [];

      // Parse Sets
      if (setsRes.status === 'fulfilled' && setsRes.value.ok) {
        const data = (await setsRes.value.json()) as {
          results?: Array<{
            set_num: string;
            name: string;
            year: number;
            num_parts: number;
            set_img_url: string | null;
          }>;
        };
        if (Array.isArray(data.results)) {
          for (const r of data.results) {
            const cleanNum = normalizeSetNumber(r.set_num);
            apiResults.push({
              setNumber: cleanNum,
              name: r.name,
              theme: 'LEGO Set',
              year: r.year,
              pieces: r.num_parts,
              imageUrl: r.set_img_url || getLegoImageUrl(cleanNum),
              type: 'set',
            });
          }
        }
      }

      // Parse Minifigures
      if (minifigsRes.status === 'fulfilled' && minifigsRes.value.ok) {
        const data = (await minifigsRes.value.json()) as {
          results?: Array<{
            set_num: string;
            name: string;
            num_parts: number;
            set_img_url: string | null;
          }>;
        };
        if (Array.isArray(data.results)) {
          for (const m of data.results) {
            apiResults.push({
              setNumber: m.set_num,
              name: m.name,
              theme: 'Minifigures',
              pieces: m.num_parts,
              imageUrl: m.set_img_url || getLegoImageUrl(m.set_num),
              type: 'minifig',
            });
          }
        }
      }

      // If user typed a specific set or minifig code that wasn't in top 15, try direct lookup
      const isDirectMinifigCode = /^(fig-\d+|[a-z]{2,5}\d+[a-z]?)$/i.test(trimmed);
      const isDirectSetCode = /^\d{4,6}$/.test(trimmed);

      if (isDirectMinifigCode && !apiResults.some((r) => r.setNumber.toLowerCase() === trimmed)) {
        try {
          const directMinifigRes = await fetch(
            `https://rebrickable.com/api/v3/lego/minifigs/${encodeURIComponent(trimmed)}/`,
            { headers },
          );
          if (directMinifigRes.ok) {
            const m = (await directMinifigRes.json()) as {
              set_num: string;
              name: string;
              num_parts: number;
              set_img_url: string | null;
            };
            if (m.set_num) {
              apiResults.unshift({
                setNumber: m.set_num,
                name: m.name,
                theme: 'Minifigures',
                pieces: m.num_parts,
                imageUrl: m.set_img_url || getLegoImageUrl(m.set_num),
                type: 'minifig',
              });
            }
          }
        } catch {
          // Ignore direct lookup error
        }
      }

      if (isDirectSetCode && !apiResults.some((r) => r.setNumber.toLowerCase() === trimmed)) {
        try {
          const directSetRes = await fetch(
            `https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(trimmed)}-1/`,
            { headers },
          );
          if (directSetRes.ok) {
            const s = (await directSetRes.json()) as {
              set_num: string;
              name: string;
              year: number;
              num_parts: number;
              set_img_url: string | null;
            };
            if (s.set_num) {
              apiResults.unshift({
                setNumber: normalizeSetNumber(s.set_num),
                name: s.name,
                theme: 'LEGO Set',
                year: s.year,
                pieces: s.num_parts,
                imageUrl: s.set_img_url || getLegoImageUrl(s.set_num),
                type: 'set',
              });
            }
          }
        } catch {
          // Ignore direct lookup error
        }
      }

      // Merge local matches and API results without duplicates
      const seen = new Set<string>();
      const combined: LegoSetResult[] = [];
      for (const item of [...apiResults, ...localMatches]) {
        const id = item.setNumber.toLowerCase();
        if (!seen.has(id)) {
          seen.add(id);
          combined.push(item);
        }
      }

      if (combined.length > 0) {
        return combined;
      }
    } catch {
      // Fallback to local matches if network or auth error
    }
  }

  // Synthesize direct numeric set or minifigure code (including Brickset URLs)
  const cleaned = cleanLegoInput(trimmed);
  if (cleaned.itemType === 'MINIFIG') {
    if (!localMatches.some((m) => m.setNumber.toLowerCase() === cleaned.itemNo.toLowerCase())) {
      return [
        {
          setNumber: cleaned.itemNo,
          name: `Minifigure #${cleaned.itemNo.toUpperCase()} (Brickset)`,
          theme: 'Minifigures',
          type: 'minifig',
          imageUrl: getLegoImageUrl(cleaned.itemNo),
        },
        ...localMatches,
      ];
    }
  } else if (/^\d{4,7}(-\d+)?$/.test(cleaned.itemNo)) {
    const rawNum = cleaned.itemNo.replace(/-\d+$/, '');
    const setNum = trimmed.includes('-') ? cleaned.itemNo : rawNum;
    if (!localMatches.some((m) => normalizeSetNumber(m.setNumber) === rawNum)) {
      return [
        {
          setNumber: setNum,
          name: `LEGO Set #${setNum} (Brickset)`,
          theme: 'LEGO Set',
          type: 'set',
          imageUrl: getLegoImageUrl(cleaned.itemNo),
        },
        ...localMatches,
      ];
    }
  }

  return localMatches;
};
