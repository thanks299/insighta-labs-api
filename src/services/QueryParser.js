/**
 * Rule-based natural language query parser.
 * No AI / LLMs used. Pure regex + keyword matching.
 */

const COUNTRY_MAP = {
  afghanistan: 'AF', albania: 'AL', algeria: 'DZ', angola: 'AO',
  argentina: 'AR', armenia: 'AM', australia: 'AU', austria: 'AT',
  azerbaijan: 'AZ', bahrain: 'BH', bangladesh: 'BD', belarus: 'BY',
  belgium: 'BE', benin: 'BJ', bolivia: 'BO', botswana: 'BW',
  brazil: 'BR', bulgaria: 'BG', 'burkina faso': 'BF', 'burkinafaso': 'BF',
  burundi: 'BI', cambodia: 'KH', cameroon: 'CM', canada: 'CA',
  'cape verde': 'CV', capeverde: 'CV', chad: 'TD', chile: 'CL',
  china: 'CN', colombia: 'CO', comoros: 'KM', congo: 'CG',
  'costa rica': 'CR', costarica: 'CR', croatia: 'HR', cuba: 'CU',
  cyprus: 'CY', denmark: 'DK', djibouti: 'DJ', ecuador: 'EC',
  egypt: 'EG', eritrea: 'ER', estonia: 'EE', ethiopia: 'ET',
  finland: 'FI', france: 'FR', gabon: 'GA', gambia: 'GM',
  georgia: 'GE', germany: 'DE', ghana: 'GH', greece: 'GR',
  guatemala: 'GT', guinea: 'GN', guyana: 'GY', haiti: 'HT',
  honduras: 'HN', hungary: 'HU', iceland: 'IS', india: 'IN',
  indonesia: 'ID', iran: 'IR', iraq: 'IQ', ireland: 'IE',
  israel: 'IL', italy: 'IT', 'ivory coast': 'CI', ivorycoast: 'CI',
  jamaica: 'JM', japan: 'JP', jordan: 'JO', kazakhstan: 'KZ',
  kenya: 'KE', kuwait: 'KW', laos: 'LA', latvia: 'LV',
  lebanon: 'LB', lesotho: 'LS', liberia: 'LR', libya: 'LY',
  lithuania: 'LT', luxembourg: 'LU', madagascar: 'MG', malawi: 'MW',
  malaysia: 'MY', mali: 'ML', malta: 'MT', mauritania: 'MR',
  mauritius: 'MU', mexico: 'MX', moldova: 'MD', mongolia: 'MN',
  montenegro: 'ME', morocco: 'MA', mozambique: 'MZ', myanmar: 'MM',
  namibia: 'NA', nepal: 'NP', netherlands: 'NL', 'new zealand': 'NZ',
  newzealand: 'NZ', nicaragua: 'NI', niger: 'NE', nigeria: 'NG',
  norway: 'NO', oman: 'OM', pakistan: 'PK', panama: 'PA',
  paraguay: 'PY', peru: 'PE', philippines: 'PH', poland: 'PL',
  portugal: 'PT', qatar: 'QA', romania: 'RO', russia: 'RU',
  rwanda: 'RW', 'saudi arabia': 'SA', saudiarabia: 'SA', senegal: 'SN',
  'sierra leone': 'SL', sierraleone: 'SL', singapore: 'SG',
  slovakia: 'SK', slovenia: 'SI', somalia: 'SO', 'south africa': 'ZA',
  southafrica: 'ZA', 'south korea': 'KR', southkorea: 'KR',
  'south sudan': 'SS', southsudan: 'SS', spain: 'ES', 'sri lanka': 'LK',
  srilanka: 'LK', sudan: 'SD', sweden: 'SE', switzerland: 'CH',
  syria: 'SY', taiwan: 'TW', tajikistan: 'TJ', tanzania: 'TZ',
  thailand: 'TH', togo: 'TG', tunisia: 'TN', turkey: 'TR',
  turkmenistan: 'TM', uganda: 'UG', ukraine: 'UA',
  uae: 'AE', 'united arab emirates': 'AE', unitedarabemirates: 'AE',
  uk: 'GB', 'united kingdom': 'GB', unitedkingdom: 'GB',
  usa: 'US', 'united states': 'US', unitedstates: 'US',
  uruguay: 'UY', uzbekistan: 'UZ', venezuela: 'VE', vietnam: 'VN',
  yemen: 'YE', zambia: 'ZM', zimbabwe: 'ZW',
  // common aliases
  'dr congo': 'CD', drc: 'CD', 'democratic republic of congo': 'CD',
  'republic of congo': 'CG', 'cote d\'ivoire': 'CI',
};

// Build a sorted list of multi-word country names (longest first) for greedy matching
const SORTED_COUNTRY_NAMES = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);

class QueryParser {
  parse(query) {
    if (!query || query.trim().length === 0) return null;

    const q = query.toLowerCase().trim();
    const filters = {};

    // ── Gender ──────────────────────────────────────────────────────────────
    // Order matters: check female BEFORE male to avoid false match
    if (/\b(female|females|woman|women|girl|girls)\b/.test(q)) {
      filters.gender = 'female';
    } else if (/\b(male|males|man|men|boy|boys)\b/.test(q)) {
      filters.gender = 'male';
    }
    // "male and female" or "both" → no gender filter
    if (/\b(male and female|female and male|both genders?|all genders?|people)\b/.test(q)) {
      delete filters.gender;
    }

    // ── Age group / range ───────────────────────────────────────────────────
    // "young" is a special keyword mapping to min_age=16, max_age=24
    if (/\byoung\b/.test(q)) {
      filters.min_age = 16;
      filters.max_age = 24;
    } else if (/\bchild(ren)?\b/.test(q)) {
      filters.age_group = 'child';
    } else if (/\bteen(ager)?s?\b/.test(q)) {
      filters.age_group = 'teenager';
    } else if (/\badult(s)?\b/.test(q)) {
      filters.age_group = 'adult';
    } else if (/\b(senior|seniors|elderly|old people|older people)\b/.test(q)) {
      filters.age_group = 'senior';
    }

    // "above / over / older than X"
    const aboveMatch = q.match(/\b(?:above|over|older than|greater than|more than)\s+(\d+)/);
    if (aboveMatch) {
      filters.min_age = parseInt(aboveMatch[1]);
      // If age_group was already set, keep both — they combine with AND in the model
    }

    // "below / under / younger than X"
    const belowMatch = q.match(/\b(?:below|under|younger than|less than)\s+(\d+)/);
    if (belowMatch) {
      filters.max_age = parseInt(belowMatch[1]);
    }

    // "between X and Y" or "X to Y"
    const rangeMatch = q.match(/\b(?:between\s+)?(\d+)\s+(?:to|-|and)\s+(\d+)\b/);
    if (rangeMatch && !aboveMatch && !belowMatch) {
      filters.min_age = parseInt(rangeMatch[1]);
      filters.max_age = parseInt(rangeMatch[2]);
    }

    // ── Country ─────────────────────────────────────────────────────────────
    // Try to find "from <country>" pattern first
    const fromMatch = q.match(/\bfrom\s+(.+?)(?:\s+(?:who|with|and|above|below|over|under)|$)/);
    if (fromMatch) {
      const countryRaw = fromMatch[1].trim();
      const countryId = this._lookupCountry(countryRaw);
      if (countryId) filters.country_id = countryId;
    }

    // ── Nothing was parsed ───────────────────────────────────────────────────
    if (Object.keys(filters).length === 0) return null;

    return filters;
  }

  _lookupCountry(raw) {
    const normalized = raw.toLowerCase().trim();

    // Direct lookup
    if (COUNTRY_MAP[normalized]) return COUNTRY_MAP[normalized];

    // Greedy match — try longest country names first
    for (const name of SORTED_COUNTRY_NAMES) {
      if (normalized.startsWith(name)) return COUNTRY_MAP[name];
    }

    // Partial word match as fallback
    for (const name of SORTED_COUNTRY_NAMES) {
      if (normalized.includes(name)) return COUNTRY_MAP[name];
    }

    return null;
  }
}

module.exports = new QueryParser();
