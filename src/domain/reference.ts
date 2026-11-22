// Reviewed lookups extracted from the supplied Country-Code.xlsx and an audit of
// zomato.csv. Small and stable, so committed as code rather than read at runtime.

export interface ICountryRef {
  country: string;
  currencyCode: string | null;
  currencyAnomaly?: boolean;
}

// Each country uses exactly one currency label in this dataset, so the ISO code is keyed by country. 
export const COUNTRY_BY_CODE: Record<number, ICountryRef> = {
  1: { country: 'India', currencyCode: 'INR' },
  14: { country: 'Australia', currencyCode: 'AUD' },
  30: { country: 'Brazil', currencyCode: 'BRL' },
  37: { country: 'Canada', currencyCode: 'CAD' },
  94: { country: 'Indonesia', currencyCode: 'IDR' },
  148: { country: 'New Zealand', currencyCode: 'NZD' },
  162: { country: 'Philippines', currencyCode: null, currencyAnomaly: true },
  166: { country: 'Qatar', currencyCode: 'QAR' },
  184: { country: 'Singapore', currencyCode: 'SGD' },
  189: { country: 'South Africa', currencyCode: 'ZAR' },
  191: { country: 'Sri Lanka', currencyCode: 'LKR' },
  208: { country: 'Turkey', currencyCode: 'TRY' },
  214: { country: 'UAE', currencyCode: 'AED' },
  215: { country: 'United Kingdom', currencyCode: 'GBP' },
  216: { country: 'United States', currencyCode: 'USD' },
};

/* Alternate/modern spellings -> the spelling used in this dataset, compared after
normalization. Lets a query for "gurugram" match the dataset's "Gurgaon". */
export const CITY_ALIASES: Record<string, string> = {
  gurugram: 'gurgaon',
  bengaluru: 'bangalore',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
};

// Minimum-vote prior for the Bayesian weighted rating (near the dataset's median
// vote count of ~60).
export const RATING_PRIOR_MIN_VOTES = 50;

// Global mean rating used when scoring a single POSTed restaurant. The seed
// derives the real mean from the data (~3.44); this is the API-time default.
export const DEFAULT_GLOBAL_RATING_MEAN = 3.44;
