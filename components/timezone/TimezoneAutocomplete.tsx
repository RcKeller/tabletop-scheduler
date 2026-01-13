"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getBrowserTimezone } from "@/lib/utils/timezone";

interface TimezoneAutocompleteProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
  label?: string;
  compact?: boolean; // Smaller size for navbar
}

// Get ALL IANA timezones - this is critical for inclusivity
function getAllTimezones(): string[] {
  try {
    // This returns ALL ~400+ IANA timezones including duplicates like Europe/Dublin and Europe/London
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Comprehensive fallback for older browsers - include as many as possible
    return [
      // UTC variants
      "UTC", "Etc/UTC", "Etc/GMT", "Etc/GMT+0", "Etc/GMT-0", "Etc/GMT0",
      "Etc/GMT+1", "Etc/GMT+2", "Etc/GMT+3", "Etc/GMT+4", "Etc/GMT+5", "Etc/GMT+6",
      "Etc/GMT+7", "Etc/GMT+8", "Etc/GMT+9", "Etc/GMT+10", "Etc/GMT+11", "Etc/GMT+12",
      "Etc/GMT-1", "Etc/GMT-2", "Etc/GMT-3", "Etc/GMT-4", "Etc/GMT-5", "Etc/GMT-6",
      "Etc/GMT-7", "Etc/GMT-8", "Etc/GMT-9", "Etc/GMT-10", "Etc/GMT-11", "Etc/GMT-12",
      "Etc/GMT-13", "Etc/GMT-14",
      // Americas - ALL cities
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Anchorage", "America/Juneau", "America/Sitka", "America/Yakutat", "America/Nome",
      "America/Adak", "America/Phoenix", "America/Boise", "America/Detroit",
      "America/Indiana/Indianapolis", "America/Indiana/Knox", "America/Indiana/Marengo",
      "America/Indiana/Petersburg", "America/Indiana/Tell_City", "America/Indiana/Vevay",
      "America/Indiana/Vincennes", "America/Indiana/Winamac", "America/Kentucky/Louisville",
      "America/Kentucky/Monticello", "America/North_Dakota/Beulah", "America/North_Dakota/Center",
      "America/North_Dakota/New_Salem", "America/Toronto", "America/Vancouver", "America/Edmonton",
      "America/Winnipeg", "America/Regina", "America/Halifax", "America/St_Johns",
      "America/Mexico_City", "America/Cancun", "America/Merida", "America/Monterrey",
      "America/Matamoros", "America/Tijuana", "America/Hermosillo", "America/Mazatlan",
      "America/Chihuahua", "America/Ojinaga", "America/Bahia_Banderas",
      "America/Guatemala", "America/El_Salvador", "America/Tegucigalpa", "America/Managua",
      "America/Costa_Rica", "America/Panama", "America/Bogota", "America/Lima", "America/Guayaquil",
      "America/Caracas", "America/La_Paz", "America/Santiago", "America/Sao_Paulo",
      "America/Buenos_Aires", "America/Argentina/Buenos_Aires", "America/Argentina/Cordoba",
      "America/Argentina/Salta", "America/Argentina/Jujuy", "America/Argentina/Tucuman",
      "America/Argentina/Catamarca", "America/Argentina/La_Rioja", "America/Argentina/San_Juan",
      "America/Argentina/Mendoza", "America/Argentina/San_Luis", "America/Argentina/Rio_Gallegos",
      "America/Argentina/Ushuaia", "America/Montevideo", "America/Asuncion", "America/Cuiaba",
      "America/Campo_Grande", "America/Belem", "America/Fortaleza", "America/Recife",
      "America/Araguaina", "America/Maceio", "America/Bahia", "America/Manaus", "America/Porto_Velho",
      "America/Boa_Vista", "America/Santarem", "America/Rio_Branco", "America/Eirunepe",
      "America/Havana", "America/Jamaica", "America/Port-au-Prince", "America/Puerto_Rico",
      "America/Santo_Domingo", "America/Martinique", "America/Barbados", "America/Curacao",
      "America/Aruba", "America/Port_of_Spain", "America/Grenada", "America/St_Lucia",
      "America/Dominica", "America/St_Kitts", "America/Antigua", "America/Montserrat",
      "America/Anguilla", "America/St_Vincent", "America/Tortola", "America/St_Thomas",
      "America/Grand_Turk", "America/Nassau", "America/Cayman",
      // Europe - ALL cities (including Ireland separate from UK!)
      "Europe/London", "Europe/Dublin", "Europe/Belfast", "Europe/Lisbon", "Europe/Paris",
      "Europe/Madrid", "Europe/Barcelona", "Europe/Berlin", "Europe/Amsterdam", "Europe/Brussels",
      "Europe/Luxembourg", "Europe/Rome", "Europe/Vatican", "Europe/San_Marino", "Europe/Monaco",
      "Europe/Andorra", "Europe/Gibraltar", "Europe/Zurich", "Europe/Vaduz", "Europe/Vienna",
      "Europe/Prague", "Europe/Bratislava", "Europe/Warsaw", "Europe/Budapest", "Europe/Ljubljana",
      "Europe/Zagreb", "Europe/Sarajevo", "Europe/Belgrade", "Europe/Podgorica", "Europe/Skopje",
      "Europe/Tirane", "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki",
      "Europe/Tallinn", "Europe/Riga", "Europe/Vilnius", "Europe/Minsk", "Europe/Kiev", "Europe/Kyiv",
      "Europe/Chisinau", "Europe/Bucharest", "Europe/Sofia", "Europe/Athens", "Europe/Istanbul",
      "Europe/Moscow", "Europe/Kaliningrad", "Europe/Simferopol", "Europe/Volgograd",
      "Europe/Samara", "Europe/Ulyanovsk", "Europe/Saratov", "Europe/Astrakhan", "Europe/Kirov",
      // Africa
      "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "Africa/Casablanca",
      "Africa/Algiers", "Africa/Tunis", "Africa/Tripoli", "Africa/Accra", "Africa/Abidjan",
      "Africa/Dakar", "Africa/Bamako", "Africa/Conakry", "Africa/Bissau", "Africa/Monrovia",
      "Africa/Freetown", "Africa/Banjul", "Africa/Nouakchott", "Africa/Ouagadougou", "Africa/Niamey",
      "Africa/Ndjamena", "Africa/Khartoum", "Africa/Addis_Ababa", "Africa/Asmara", "Africa/Djibouti",
      "Africa/Mogadishu", "Africa/Kampala", "Africa/Dar_es_Salaam", "Africa/Maputo", "Africa/Lusaka",
      "Africa/Harare", "Africa/Blantyre", "Africa/Lilongwe", "Africa/Windhoek", "Africa/Gaborone",
      "Africa/Maseru", "Africa/Mbabane", "Africa/Luanda", "Africa/Kinshasa", "Africa/Brazzaville",
      "Africa/Bangui", "Africa/Libreville", "Africa/Malabo", "Africa/Douala", "Africa/Porto-Novo",
      "Africa/Lome", "Africa/Sao_Tome", "Africa/El_Aaiun", "Africa/Ceuta",
      // Asia - ALL cities
      "Asia/Tokyo", "Asia/Seoul", "Asia/Pyongyang", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Macau",
      "Asia/Taipei", "Asia/Singapore", "Asia/Manila", "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura",
      "Asia/Pontianak", "Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Hanoi", "Asia/Phnom_Penh",
      "Asia/Vientiane", "Asia/Rangoon", "Asia/Yangon", "Asia/Kuala_Lumpur", "Asia/Kuching",
      "Asia/Brunei", "Asia/Dili", "Asia/Kolkata", "Asia/Mumbai", "Asia/Chennai", "Asia/Calcutta",
      "Asia/Delhi", "Asia/Dhaka", "Asia/Kathmandu", "Asia/Thimphu", "Asia/Colombo",
      "Asia/Karachi", "Asia/Lahore", "Asia/Islamabad", "Asia/Kabul", "Asia/Dushanbe", "Asia/Tashkent",
      "Asia/Samarkand", "Asia/Ashgabat", "Asia/Bishkek", "Asia/Almaty", "Asia/Qyzylorda",
      "Asia/Aqtobe", "Asia/Aqtau", "Asia/Atyrau", "Asia/Oral",
      "Asia/Dubai", "Asia/Muscat", "Asia/Riyadh", "Asia/Qatar", "Asia/Bahrain", "Asia/Kuwait",
      "Asia/Baghdad", "Asia/Tehran", "Asia/Jerusalem", "Asia/Tel_Aviv", "Asia/Amman", "Asia/Beirut",
      "Asia/Damascus", "Asia/Nicosia", "Asia/Famagusta", "Asia/Gaza", "Asia/Hebron",
      "Asia/Yerevan", "Asia/Baku", "Asia/Tbilisi",
      "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk", "Asia/Barnaul", "Asia/Tomsk",
      "Asia/Novokuznetsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk",
      "Asia/Khandyga", "Asia/Vladivostok", "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin",
      "Asia/Srednekolymsk", "Asia/Kamchatka", "Asia/Anadyr",
      "Asia/Ulaanbaatar", "Asia/Hovd", "Asia/Choibalsan",
      // Australia & Pacific
      "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth",
      "Australia/Adelaide", "Australia/Darwin", "Australia/Hobart", "Australia/Canberra",
      "Australia/Lord_Howe", "Australia/Lindeman", "Australia/Broken_Hill", "Australia/Eucla",
      "Pacific/Auckland", "Pacific/Chatham", "Pacific/Fiji", "Pacific/Tongatapu", "Pacific/Apia",
      "Pacific/Fakaofo", "Pacific/Enderbury", "Pacific/Kiritimati", "Pacific/Tarawa",
      "Pacific/Majuro", "Pacific/Kwajalein", "Pacific/Nauru", "Pacific/Funafuti", "Pacific/Wake",
      "Pacific/Efate", "Pacific/Port_Vila", "Pacific/Noumea", "Pacific/Norfolk", "Pacific/Guadalcanal",
      "Pacific/Bougainville", "Pacific/Port_Moresby", "Pacific/Chuuk", "Pacific/Pohnpei",
      "Pacific/Kosrae", "Pacific/Palau", "Pacific/Guam", "Pacific/Saipan",
      "Pacific/Honolulu", "Pacific/Johnston", "Pacific/Midway", "Pacific/Pago_Pago",
      "Pacific/Tahiti", "Pacific/Gambier", "Pacific/Marquesas", "Pacific/Pitcairn",
      "Pacific/Easter", "Pacific/Galapagos", "Pacific/Rarotonga", "Pacific/Niue",
      // Atlantic
      "Atlantic/Reykjavik", "Atlantic/Faroe", "Atlantic/Azores", "Atlantic/Madeira",
      "Atlantic/Canary", "Atlantic/Cape_Verde", "Atlantic/St_Helena", "Atlantic/South_Georgia",
      "Atlantic/Stanley", "Atlantic/Bermuda",
      // Indian Ocean
      "Indian/Mauritius", "Indian/Reunion", "Indian/Mayotte", "Indian/Comoro", "Indian/Antananarivo",
      "Indian/Maldives", "Indian/Chagos", "Indian/Kerguelen", "Indian/Mahe", "Indian/Christmas",
      "Indian/Cocos",
      // Antarctica
      "Antarctica/McMurdo", "Antarctica/South_Pole", "Antarctica/Rothera", "Antarctica/Palmer",
      "Antarctica/Mawson", "Antarctica/Davis", "Antarctica/Casey", "Antarctica/Vostok",
      "Antarctica/DumontDUrville", "Antarctica/Syowa", "Antarctica/Troll", "Antarctica/Macquarie",
      // Arctic
      "Arctic/Longyearbyen",
    ];
  }
}

// Cache for performance
const offsetCache = new Map<string, number>();

// Get current UTC offset for a timezone
function getUtcOffset(tz: string): number {
  const cached = offsetCache.get(tz);
  if (cached !== undefined) return cached;

  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
    offsetCache.set(tz, offset);
    return offset;
  } catch {
    offsetCache.set(tz, 0);
    return 0;
  }
}

// Format offset as GMT string
function formatGmtOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "";
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) - hours) * 60);
  if (minutes === 0) {
    return `GMT${sign}${offset}`;
  }
  return `GMT${sign}${Math.floor(offset)}:${minutes.toString().padStart(2, "0")}`;
}

// Format timezone for display with GMT offset and abbreviation
function formatTimezoneWithOffset(tz: string): string {
  const offset = getUtcOffset(tz);
  const gmtStr = formatGmtOffset(offset);
  const abbr = getTimezoneAbbreviation(tz);
  const readable = tz.replace(/_/g, " ").replace(/\//g, " / ");
  if (abbr && abbr !== gmtStr) {
    return `(${gmtStr}) ${readable} [${abbr}]`;
  }
  return `(${gmtStr}) ${readable}`;
}

// Cache for timezone abbreviations
const abbreviationCache = new Map<string, string>();

// Get the current timezone abbreviation (e.g., "PST", "EST") for a timezone
function getTimezoneAbbreviation(tz: string): string {
  const cached = abbreviationCache.get(tz);
  if (cached !== undefined) return cached;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const abbr = parts.find(p => p.type === "timeZoneName")?.value || "";
    abbreviationCache.set(tz, abbr);
    return abbr;
  } catch {
    abbreviationCache.set(tz, "");
    return "";
  }
}

// Get the long timezone name (e.g., "Pacific Standard Time")
function getTimezoneLongName(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

// Extract searchable terms from a timezone ID
function getSearchTerms(tz: string): string[] {
  const terms: string[] = [];

  // Add the full timezone ID
  terms.push(tz.toLowerCase());

  // Add each part of the path (e.g., "America", "Los_Angeles")
  const parts = tz.split("/");
  for (const part of parts) {
    terms.push(part.toLowerCase());
    // Also add without underscores
    terms.push(part.replace(/_/g, " ").toLowerCase());
    // Add individual words
    for (const word of part.split("_")) {
      if (word.length > 2) {
        terms.push(word.toLowerCase());
      }
    }
  }

  // Add the abbreviation (PST, EST, etc.)
  const abbr = getTimezoneAbbreviation(tz);
  if (abbr) {
    terms.push(abbr.toLowerCase());
  }

  // Add the long name
  const longName = getTimezoneLongName(tz);
  if (longName) {
    terms.push(longName.toLowerCase());
    // Add individual words from long name
    for (const word of longName.split(" ")) {
      if (word.length > 2) {
        terms.push(word.toLowerCase());
      }
    }
  }

  return [...new Set(terms)]; // Remove duplicates
}

// Build search index for all timezones
let searchIndex: Map<string, Set<string>> | null = null;
function getSearchIndex(): Map<string, Set<string>> {
  if (searchIndex) return searchIndex;

  searchIndex = new Map();
  const allTz = getAllTimezones();

  for (const tz of allTz) {
    const terms = getSearchTerms(tz);
    for (const term of terms) {
      // Add all prefixes for partial matching
      for (let i = 1; i <= term.length; i++) {
        const prefix = term.slice(0, i);
        const existing = searchIndex.get(prefix) || new Set();
        existing.add(tz);
        searchIndex.set(prefix, existing);
      }
    }
  }

  return searchIndex;
}

// Pre-compute and sort all timezones by GMT offset
let sortedTimezones: string[] | null = null;
function getSortedTimezones(): string[] {
  if (sortedTimezones) return sortedTimezones;

  const all = getAllTimezones();
  sortedTimezones = all.sort((a, b) => {
    const offsetA = getUtcOffset(a);
    const offsetB = getUtcOffset(b);
    if (offsetA !== offsetB) return offsetA - offsetB;
    return a.localeCompare(b);
  });
  return sortedTimezones;
}

// Compact display format (just abbreviation and offset)
function formatTimezoneCompact(tz: string): string {
  const offset = getUtcOffset(tz);
  const abbr = getTimezoneAbbreviation(tz);
  const sign = offset >= 0 ? "+" : "";
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) - hours) * 60);
  const offsetStr = minutes === 0 ? `${sign}${offset}` : `${sign}${Math.floor(offset)}:${minutes.toString().padStart(2, "0")}`;

  if (abbr && !abbr.includes("GMT")) {
    return `${abbr} (${offsetStr})`;
  }
  return `GMT${offsetStr}`;
}

export function TimezoneAutocomplete({
  value,
  onChange,
  className = "",
  label,
  compact = false,
}: TimezoneAutocompleteProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get all timezones sorted by GMT offset
  const allTimezones = useMemo(() => getSortedTimezones(), []);

  // Get search index (built once, cached)
  const index = useMemo(() => getSearchIndex(), []);

  // Filter timezones based on search using the index
  const filteredTimezones = useMemo(() => {
    if (!search.trim()) {
      // Show ALL timezones when no search, sorted by GMT
      return allTimezones;
    }

    const searchLower = search.toLowerCase().trim();

    // Use the search index for fast prefix matching
    const matches = index.get(searchLower);
    if (matches && matches.size > 0) {
      // Sort matches by GMT offset
      return Array.from(matches).sort((a, b) => {
        const offsetA = getUtcOffset(a);
        const offsetB = getUtcOffset(b);
        if (offsetA !== offsetB) return offsetA - offsetB;
        return a.localeCompare(b);
      });
    }

    // Fallback to includes search for partial matches not in index
    return allTimezones.filter((tz) => {
      const tzLower = tz.toLowerCase();
      const abbr = getTimezoneAbbreviation(tz).toLowerCase();
      const offset = getUtcOffset(tz);
      const gmtStr = formatGmtOffset(offset).toLowerCase();

      return (
        tzLower.includes(searchLower) ||
        abbr.includes(searchLower) ||
        gmtStr.includes(searchLower)
      );
    });
  }, [search, allTimezones, index]);

  useEffect(() => {
    setMounted(true);
    if (!value) {
      onChange(getBrowserTimezone());
    }
  }, [value, onChange]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTimezones]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredTimezones.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredTimezones[highlightedIndex]) {
          onChange(filteredTimezones[highlightedIndex]);
          setIsOpen(false);
          setSearch("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        break;
    }
  }, [isOpen, filteredTimezones, highlightedIndex, onChange]);

  const handleSelect = useCallback((tz: string) => {
    onChange(tz);
    setIsOpen(false);
    setSearch("");
  }, [onChange]);

  if (!mounted) {
    return (
      <div className={className}>
        {label && (
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <div className={`${compact ? "h-8" : "h-10"} animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800`} />
      </div>
    );
  }

  const currentOffset = getUtcOffset(value);
  const displayValue = isOpen ? search : (compact ? formatTimezoneCompact(value) : formatTimezoneWithOffset(value));

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={compact ? "Timezone..." : "Search by city or GMT offset..."}
          className={`block w-full rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 ${
            compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
          }`}
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setSearch("");
              inputRef.current?.focus();
            }
          }}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          >
            {filteredTimezones.length === 0 ? (
              <li className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                No timezones found for &quot;{search}&quot;
              </li>
            ) : (
              <>
                <li className="sticky top-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                  {filteredTimezones.length} timezone{filteredTimezones.length !== 1 ? "s" : ""} {search ? "matching" : "available"}
                </li>
                {filteredTimezones.map((tz, index) => (
                  <li
                    key={tz}
                    onClick={() => handleSelect(tz)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`cursor-pointer px-3 py-2 ${
                      index === highlightedIndex
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-zinc-900 dark:text-zinc-100"
                    } ${tz === value ? "font-medium" : ""}`}
                  >
                    {formatTimezoneWithOffset(tz)}
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
