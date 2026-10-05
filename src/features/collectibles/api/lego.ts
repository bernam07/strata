export interface LegoSetResult {
  setNumber: string;
  name: string;
  theme: string;
  year?: number;
  pieces?: number;
  rrpEur?: number;
  imageUrl: string;
}

export const normalizeSetNumber = (raw: string): string => {
  const cleaned = raw.trim().replace(/\s+/g, '');
  // If user entered e.g. 75192-1, strip the -1 for consistency
  return cleaned.replace(/-[0-9]+$/, '');
};

export const getLegoImageUrl = (setNumber: string): string => {
  const base = normalizeSetNumber(setNumber);
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
  },
  {
    setNumber: '75313',
    name: 'AT-AT (UCS)',
    theme: 'Star Wars',
    year: 2021,
    pieces: 6785,
    rrpEur: 849.99,
    imageUrl: 'https://images.brickset.com/sets/images/75313-1.jpg',
  },
  {
    setNumber: '75252',
    name: 'Imperial Star Destroyer (UCS)',
    theme: 'Star Wars',
    year: 2019,
    pieces: 4784,
    rrpEur: 699.99,
    imageUrl: 'https://images.brickset.com/sets/images/75252-1.jpg',
  },
  {
    setNumber: '75331',
    name: 'The Razor Crest (UCS)',
    theme: 'Star Wars',
    year: 2022,
    pieces: 6187,
    rrpEur: 599.99,
    imageUrl: 'https://images.brickset.com/sets/images/75331-1.jpg',
  },
  {
    setNumber: '75367',
    name: 'Venator-Class Republic Attack Cruiser (UCS)',
    theme: 'Star Wars',
    year: 2023,
    pieces: 5374,
    rrpEur: 649.99,
    imageUrl: 'https://images.brickset.com/sets/images/75367-1.jpg',
  },
  {
    setNumber: '75382',
    name: 'TIE Interceptor (UCS)',
    theme: 'Star Wars',
    year: 2024,
    pieces: 1931,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/75382-1.jpg',
  },
  {
    setNumber: '75308',
    name: 'R2-D2',
    theme: 'Star Wars',
    year: 2021,
    pieces: 2314,
    rrpEur: 239.99,
    imageUrl: 'https://images.brickset.com/sets/images/75308-1.jpg',
  },
  {
    setNumber: '75337',
    name: 'AT-TE Walker',
    theme: 'Star Wars',
    year: 2022,
    pieces: 1082,
    rrpEur: 139.99,
    imageUrl: 'https://images.brickset.com/sets/images/75337-1.jpg',
  },
  {
    setNumber: '75060',
    name: 'Slave I (UCS)',
    theme: 'Star Wars',
    year: 2015,
    pieces: 1996,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/75060-1.jpg',
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
  },
  {
    setNumber: '10333',
    name: 'The Lord of the Rings: Barad-dûr',
    theme: 'Icons',
    year: 2024,
    pieces: 5471,
    rrpEur: 459.99,
    imageUrl: 'https://images.brickset.com/sets/images/10333-1.jpg',
  },
  {
    setNumber: '10294',
    name: 'Titanic',
    theme: 'Icons',
    year: 2021,
    pieces: 9090,
    rrpEur: 679.99,
    imageUrl: 'https://images.brickset.com/sets/images/10294-1.jpg',
  },
  {
    setNumber: '10307',
    name: 'Eiffel Tower',
    theme: 'Icons',
    year: 2022,
    pieces: 10001,
    rrpEur: 629.99,
    imageUrl: 'https://images.brickset.com/sets/images/10307-1.jpg',
  },
  {
    setNumber: '10276',
    name: 'Colosseum',
    theme: 'Icons',
    year: 2020,
    pieces: 9036,
    rrpEur: 549.99,
    imageUrl: 'https://images.brickset.com/sets/images/10276-1.jpg',
  },
  {
    setNumber: '10305',
    name: 'Lion Knights’ Castle',
    theme: 'Icons',
    year: 2022,
    pieces: 4514,
    rrpEur: 399.99,
    imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
  },
  {
    setNumber: '10497',
    name: 'Galaxy Explorer',
    theme: 'Icons',
    year: 2022,
    pieces: 1254,
    rrpEur: 99.99,
    imageUrl: 'https://images.brickset.com/sets/images/10497-1.jpg',
  },
  {
    setNumber: '10300',
    name: 'Back to the Future Time Machine',
    theme: 'Icons',
    year: 2022,
    pieces: 1872,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10300-1.jpg',
  },
  {
    setNumber: '10265',
    name: 'Ford Mustang',
    theme: 'Creator Expert',
    year: 2019,
    pieces: 1471,
    rrpEur: 169.99,
    imageUrl: 'https://images.brickset.com/sets/images/10265-1.jpg',
  },
  {
    setNumber: '10274',
    name: 'Ghostbusters ECTO-1',
    theme: 'Icons',
    year: 2020,
    pieces: 2352,
    rrpEur: 239.99,
    imageUrl: 'https://images.brickset.com/sets/images/10274-1.jpg',
  },
  {
    setNumber: '10323',
    name: 'PAC-MAN Arcade',
    theme: 'Icons',
    year: 2023,
    pieces: 2651,
    rrpEur: 269.99,
    imageUrl: 'https://images.brickset.com/sets/images/10323-1.jpg',
  },
  {
    setNumber: '10318',
    name: 'Concorde',
    theme: 'Icons',
    year: 2023,
    pieces: 2083,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10318-1.jpg',
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
  },
  {
    setNumber: '10312',
    name: 'Jazz Club',
    theme: 'Modular Buildings',
    year: 2023,
    pieces: 2899,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/10312-1.jpg',
  },
  {
    setNumber: '10297',
    name: 'Boutique Hotel',
    theme: 'Modular Buildings',
    year: 2022,
    pieces: 3066,
    rrpEur: 229.99,
    imageUrl: 'https://images.brickset.com/sets/images/10297-1.jpg',
  },
  {
    setNumber: '10278',
    name: 'Police Station',
    theme: 'Modular Buildings',
    year: 2021,
    pieces: 2923,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10278-1.jpg',
  },
  {
    setNumber: '10270',
    name: 'Bookshop',
    theme: 'Modular Buildings',
    year: 2020,
    pieces: 2504,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/10270-1.jpg',
  },
  {
    setNumber: '10255',
    name: 'Assembly Square',
    theme: 'Modular Buildings',
    year: 2017,
    pieces: 4002,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/10255-1.jpg',
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
  },
  {
    setNumber: '21325',
    name: 'Medieval Blacksmith',
    theme: 'Ideas',
    year: 2021,
    pieces: 2164,
    rrpEur: 179.99,
    imageUrl: 'https://images.brickset.com/sets/images/21325-1.jpg',
  },
  {
    setNumber: '21330',
    name: 'Home Alone McCallister House',
    theme: 'Ideas',
    year: 2021,
    pieces: 3955,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/21330-1.jpg',
  },
  {
    setNumber: '21338',
    name: 'A-Frame Cabin',
    theme: 'Ideas',
    year: 2023,
    pieces: 2082,
    rrpEur: 179.99,
    imageUrl: 'https://images.brickset.com/sets/images/21338-1.jpg',
  },
  {
    setNumber: '21344',
    name: 'The Orient Express Train',
    theme: 'Ideas',
    year: 2023,
    pieces: 2540,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/21344-1.jpg',
  },
  {
    setNumber: '21348',
    name: 'Dungeons & Dragons: Red Dragon’s Tale',
    theme: 'Ideas',
    year: 2024,
    pieces: 3745,
    rrpEur: 359.99,
    imageUrl: 'https://images.brickset.com/sets/images/21348-1.jpg',
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
  },
  {
    setNumber: '42143',
    name: 'Ferrari Daytona SP3',
    theme: 'Technic',
    year: 2022,
    pieces: 3778,
    rrpEur: 449.99,
    imageUrl: 'https://images.brickset.com/sets/images/42143-1.jpg',
  },
  {
    setNumber: '42083',
    name: 'Bugatti Chiron',
    theme: 'Technic',
    year: 2018,
    pieces: 3599,
    rrpEur: 369.99,
    imageUrl: 'https://images.brickset.com/sets/images/42083-1.jpg',
  },
  {
    setNumber: '42056',
    name: 'Porsche 911 GT3 RS',
    theme: 'Technic',
    year: 2016,
    pieces: 2704,
    rrpEur: 299.99,
    imageUrl: 'https://images.brickset.com/sets/images/42056-1.jpg',
  },
  {
    setNumber: '42171',
    name: 'Mercedes-AMG F1 W14 E Performance',
    theme: 'Technic',
    year: 2024,
    pieces: 1642,
    rrpEur: 219.99,
    imageUrl: 'https://images.brickset.com/sets/images/42171-1.jpg',
  },
  {
    setNumber: '42141',
    name: 'McLaren Formula 1 Race Car',
    theme: 'Technic',
    year: 2022,
    pieces: 1432,
    rrpEur: 199.99,
    imageUrl: 'https://images.brickset.com/sets/images/42141-1.jpg',
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
  },
  {
    setNumber: '75978',
    name: 'Diagon Alley',
    theme: 'Harry Potter',
    year: 2020,
    pieces: 5544,
    rrpEur: 449.99,
    imageUrl: 'https://images.brickset.com/sets/images/75978-1.jpg',
  },
  {
    setNumber: '76417',
    name: 'Gringotts Wizarding Bank – Collectors’ Edition',
    theme: 'Harry Potter',
    year: 2023,
    pieces: 4803,
    rrpEur: 429.99,
    imageUrl: 'https://images.brickset.com/sets/images/76417-1.jpg',
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
  },
  {
    setNumber: '76269',
    name: 'Avengers Tower',
    theme: 'Marvel Super Heroes',
    year: 2023,
    pieces: 5201,
    rrpEur: 499.99,
    imageUrl: 'https://images.brickset.com/sets/images/76269-1.jpg',
  },
  {
    setNumber: '76240',
    name: 'Batmobile Tumbler',
    theme: 'DC Super Heroes',
    year: 2021,
    pieces: 2049,
    rrpEur: 269.99,
    imageUrl: 'https://images.brickset.com/sets/images/76240-1.jpg',
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
  },
  {
    setNumber: '10281',
    name: 'Bonsai Tree',
    theme: 'Botanical Collection',
    year: 2021,
    pieces: 878,
    rrpEur: 49.99,
    imageUrl: 'https://images.brickset.com/sets/images/10281-1.jpg',
  },
  {
    setNumber: '77015',
    name: 'Temple of the Golden Idol',
    theme: 'Indiana Jones',
    year: 2023,
    pieces: 1545,
    rrpEur: 149.99,
    imageUrl: 'https://images.brickset.com/sets/images/77015-1.jpg',
  },
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

  // 1. First search local curated popular sets
  const localMatches = POPULAR_LEGO_SETS.filter((set) => {
    return (
      set.setNumber.toLowerCase().includes(trimmed) ||
      set.name.toLowerCase().includes(trimmed) ||
      set.theme.toLowerCase().includes(trimmed)
    );
  });

  // 2. If an API key is available, query Rebrickable for full catalog
  if (keyToUse) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(trimmed)}&page_size=15`,
        {
          headers: {
            Authorization: `key ${keyToUse}`,
          },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{
            set_num: string;
            name: string;
            year: number;
            num_parts: number;
            set_img_url: string | null;
          }>;
        };

        if (Array.isArray(data.results)) {
          const apiMatches: LegoSetResult[] = data.results.map((r) => {
            const cleanNum = normalizeSetNumber(r.set_num);
            return {
              setNumber: cleanNum,
              name: r.name,
              theme: 'LEGO',
              year: r.year,
              pieces: r.num_parts,
              imageUrl: r.set_img_url || getLegoImageUrl(cleanNum),
            };
          });

          // Merge without duplicates
          const seen = new Set<string>();
          const combined: LegoSetResult[] = [];
          for (const item of [...localMatches, ...apiMatches]) {
            if (!seen.has(item.setNumber)) {
              seen.add(item.setNumber);
              combined.push(item);
            }
          }
          return combined;
        }
      }
    } catch {
      // Fallback to local matches if network or auth error
    }
  }

  // If query is an exact number (e.g. 75337) not in popular sets, provide a quick synthesized item
  if (/^\d{4,6}$/.test(trimmed) && !localMatches.some((m) => m.setNumber === trimmed)) {
    return [
      {
        setNumber: trimmed,
        name: `LEGO Set #${trimmed}`,
        theme: 'LEGO',
        imageUrl: getLegoImageUrl(trimmed),
      },
      ...localMatches,
    ];
  }

  return localMatches;
};
