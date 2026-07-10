import { useState, useRef } from "react";

export default function AddressAutocomplete({ placeholder, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const debounce = useRef(null);

  const search = (q) => {
    setQuery(q);
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); setShow(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`
        );
        const data = await res.json();
        setResults(data.features || []);
        setShow(true);
      } catch { }
      finally { setLoading(false); }
    }, 350);
  };

  const getLabel = (f) => {
    const p = f.properties;
    const parts = [p.name, p.street, p.city, p.state, p.country].filter(Boolean);
    return parts.join(", ");
  };

  const getShortLabel = (f) => {
    const p = f.properties;
    return [p.name, p.city || p.town || p.village].filter(Boolean).join(", ");
  };

  const select = (f) => {
    const label = getLabel(f);
    const [lng, lat] = f.geometry.coordinates;
    setQuery(getShortLabel(f) || label);
    setShow(false);
    setResults([]);
    onSelect({ address: label, lat, lng });
  };

  return (
    <div className="relative">
      <input
        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
        placeholder={placeholder}
        value={query}
        onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        onFocus={() => results.length > 0 && setShow(true)}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-3.5 text-xs text-slate-400 animate-pulse">Searching…</span>
      )}
      {show && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((f, i) => (
            <div key={i} onMouseDown={() => select(f)}
              className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 flex gap-3 items-start">
              <span className="text-slate-400 mt-0.5 flex-shrink-0">📍</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {f.properties.name || f.properties.street || "Unnamed place"}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {[f.properties.city || f.properties.town, f.properties.state, f.properties.country].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}