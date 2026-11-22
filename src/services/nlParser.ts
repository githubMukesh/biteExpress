import { canonicalCity } from '../domain/normalize.js';
import { CITY_ALIASES, DISH_TO_CUISINE } from '../domain/reference.js';

export interface IGazetteers {
  cities: Set<string>;
  cuisines: Set<string>;
}

export interface IParsedQuery {
  city?: string;
  cuisines?: string[];
  max_cost_for_two?: number;
  min_rating?: number;
  sort?: 'rating' | 'distance';
  name?: string;
}

const STOPWORDS = new Set([
  'restaurant',
  'restaurants',
  'place',
  'places',
  'food',
  'serves',
  'serving',
  'with',
  'in',
  'for',
  'two',
  'that',
  'the',
  'a',
  'an',
  'me',
  'near',
  'rs',
  'inr',
]);

function longest(values: Iterable<string>): string[] {
  return [...values].filter(Boolean).sort((a, b) => b.length - a.length);
}

// Deterministic rules-first parser: entities from the data gazetteers, intent
// from keyword cues, leftover words become a name hint. Explicit query params
// (merged by the caller) always win over this interpretation.
export function parseQuery(raw: string, gz: IGazetteers): IParsedQuery {
  let text = ` ${raw.toLowerCase().replace(/[^\w\s.₹$]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const result: IParsedQuery = {};

  const cost = text.match(/\b(?:under|below|less than|upto|up to)\s+(?:rs\.?|inr|₹|\$)?\s*(\d+)/);
  if (cost) {
    result.max_cost_for_two = Number(cost[1]);
    text = text.replace(cost[0], ' ');
  }

  if (/\b(best|top|great|highly rated)\b/.test(text)) {
    result.sort = 'rating';
    result.min_rating = 4.0;
  }
  if (/\b(nearest|closest|nearby|near me)\b/.test(text)) {
    result.sort = 'distance';
  }

  for (const city of longest([...gz.cities, ...Object.keys(CITY_ALIASES)])) {
    if (text.includes(` ${city} `)) {
      result.city = canonicalCity(city);
      text = text.replace(` ${city} `, ' ');
      break;
    }
  }

  const cuisines: string[] = [];
  for (const cu of longest(gz.cuisines)) {
    if (text.includes(` ${cu} `)) {
      cuisines.push(cu);
      text = text.replace(` ${cu} `, ' ');
    }
  }
  for (const [dish, mapped] of Object.entries(DISH_TO_CUISINE)) {
    if (text.includes(` ${dish} `)) {
      cuisines.push(...mapped);
      text = text.replace(` ${dish} `, ' ');
    }
  }
  if (cuisines.length) result.cuisines = [...new Set(cuisines)];

  const residual = text
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w && !STOPWORDS.has(w) && !/^(best|top|great|nearest|closest|nearby)$/.test(w))
    .join(' ');
  if (residual) result.name = residual;

  return result;
}
