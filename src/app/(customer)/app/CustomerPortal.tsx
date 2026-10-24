"use client";
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";
type District = { id: string; name: string; country_code: string; currency: string };
type SearchResult = { id: string; name: string; shop: string; phone: string;
  pricePaise: number; currency: string; availability: string };
type SuggestedShop = { id: string; legal_name: string; phone: string };
function formatPaise(paise: number) {
  const digits = String(paise).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
export default function CustomerPortal() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [eventStart, setEventStart] = useState("");
  const [returnEnd, setReturnEnd] = useState("");
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [occasion, setOccasion] = useState("stage");
  const [sizeRange, setSizeRange] = useState("");
  const [referencePhoto, setReferencePhoto] = useState<File | null>(null);
  const [synthetic, setSynthetic] = useState(false);
  const [nearby, setNearby] = useState<number | null>(null);
  const [consentToAi, setConsentToAi] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [requestId, setRequestId] = useState("");
  const [suggested, setSuggested] = useState<SuggestedShop[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/districts").then(r => r.json()).then(data =>
    setDistricts(data.districts ?? [])).catch(() => setMessage("Could not load districts")); }, []);
  useEffect(() => {
    if (!districtId || !categoryId || !eventStart || !returnEnd) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ districtId, categoryId, eventStart, returnEnd, sizeRange });
      fetch(`/api/requests/count?${params}`, { signal: controller.signal })
        .then(r => r.json()).then(data => { if (typeof data.shops === "number") setNearby(data.shops); })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [districtId, categoryId, eventStart, returnEnd, sizeRange, description]);
  async function json(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function signIn() {
    try {
      const data = await json("/api/auth/otp", { districtId, phone,
        name: name || undefined,
        consentVersion: "1", ...(code ? { code } : {}) });
      if (data.id) setSignedIn(true);
      else setMessage("Code requested. Check the development console or your SMS.");
    } catch (error) { setMessage(String(error)); }
  }
  async function search() {
    try {
      const params = new URLSearchParams({ districtId, eventStart, returnEnd, keyword });
      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data.results);
    } catch (error) { setMessage(String(error)); }
  }
  async function createRequest() {
    try {
      const created = await json("/api/requests", { districtId, categoryId,
        eventStart, returnEnd, description, groupSize, answers: { occasion, size_range: sizeRange },
        consentToAi, consentVersion: "1", contactConsentVersion: "1" });
      setRequestId(created.id);
      if (referencePhoto) {
        const form = new FormData();
        form.set("photo", referencePhoto);
        if (synthetic) form.set("synthetic", "true");
        const uploaded = await fetch(`/api/requests/${created.id}/photos`, { method: "POST", body: form });
        if (!uploaded.ok) throw new Error((await uploaded.json()).error);
      }
      const response = await fetch(`/api/requests/${created.id}/recommendations`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuggested(data.shops);
      if (!data.shops.length) setMessage(t.noMatches);
    } catch (error) { setMessage(String(error)); }
  }
  async function send() {
    try {
      await json(`/api/requests/${requestId}/select`, { shopIds: selected });
      setMessage("Request sent to the shops you selected.");
    } catch (error) { setMessage(String(error)); }
  }
  return <section><p className="eyebrow">{t.customerPortal}</p><h1>{t.title}</h1>
    <label>{t.district}<select value={districtId} onChange={e => setDistrictId(e.target.value)}>
      <option value="">Select a district</option>{districts.map(d =>
        <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>{t.phone}<input type="tel" value={phone} placeholder={districts.find(d => d.id === districtId)?.country_code}
      onChange={e => setPhone(e.target.value)} /></label>
    <label>{t.name}<input value={name} onChange={e => setName(e.target.value)} /></label>
    <label>{t.code}<input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} /></label>
    <button onClick={signIn}>{code ? t.signIn : t.requestCode}</button>
    <div className="card"><label>{t.eventDate}<input type="datetime-local" value={eventStart}
      onChange={e => setEventStart(e.target.value)} /></label>
      <label>{t.returnDate}<input type="datetime-local" value={returnEnd}
        onChange={e => setReturnEnd(e.target.value)} /></label>
      <label>{t.keyword}<input value={keyword} onChange={e => setKeyword(e.target.value)} /></label>
      <button onClick={search}>{t.search}</button></div>
    <h2>{t.results}</h2>{results.map(item => <article className="card" key={item.id}>
      <h3>{item.name}</h3><p>{item.shop} · {item.phone}</p>
      <p>{item.availability} · {item.pricePaise === null ? "" : formatPaise(item.pricePaise)} {item.currency}</p></article>)}
    {signedIn && <div className="card"><h2>{t.createRequest}</h2>
      <label>{t.category}<input value={categoryId} onChange={e => setCategoryId(e.target.value)} /></label>
      <label>Occasion<select value={occasion} onChange={e => setOccasion(e.target.value)}>
        <option value="stage">Stage performance</option><option value="photo shoot">Photo shoot</option>
      </select></label>
      <label>{t.groupSize}<input type="number" min="1" value={groupSize}
        onChange={e => setGroupSize(Number(e.target.value))} /></label>
      <label>Size or measurements<input value={sizeRange} onChange={e => setSizeRange(e.target.value)} /></label>
      <label>{t.description}<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label>Reference photo<input type="file" accept="image/*"
        onChange={e => setReferencePhoto(e.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" checked={synthetic}
        onChange={e => setSynthetic(e.target.checked)} />Synthetic staging photo</label>
      {nearby !== null && <p role="status">{nearby} nearby shops appear to have suitable items.</p>}
      <label><input type="checkbox" checked={consentToAi}
        onChange={e => setConsentToAi(e.target.checked)} />{t.consent}</label>
      <p>{t.disclosure}</p><button onClick={createRequest}>{t.createRequest}</button></div>}
    {requestId && <div className="card"><h2>{t.chooseShops}</h2>{suggested.map(shop =>
      <label key={shop.id}><input type="checkbox" checked={selected.includes(shop.id)}
        onChange={e => setSelected(e.target.checked ? [...selected, shop.id] :
          selected.filter(id => id !== shop.id))} />{shop.legal_name} · {shop.phone}</label>)}
      <button disabled={!selected.length} onClick={send}>{t.sendRequest}</button></div>}
    <p role="status">{message}</p></section>;
}
