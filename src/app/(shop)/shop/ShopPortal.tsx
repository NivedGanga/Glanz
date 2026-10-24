"use client";
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";
type District = { id: string; name: string; country_code: string };
type Design = { id: string; name: string; status: string; tags: { id: string; field: string; value: string }[] };
type InboxRequest = { id: string; event_start: string; name: string; phone: string; description: string; status: string };
export default function ShopPortal() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shopId, setShopId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [designName, setDesignName] = useState("");
  const [pricePaise, setPricePaise] = useState("");
  const [synthetic, setSynthetic] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [inbox, setInbox] = useState<InboxRequest[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/districts").then(r => r.json()).then(d => setDistricts(d.districts ?? []));
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories ?? []));
    const url = new URLSearchParams(location.search);
    setToken(url.get("token") ?? ""); setEmail(url.get("email") ?? "");
  }, []);
  async function api(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function load(id: string) {
    const profile = await (await fetch("/api/shops/mine")).json();
    setBranchId(profile.shop?.branch_id ?? "");
    setDesigns(profile.designs ?? []);
    const response = await fetch(`/api/shops/${id}/inbox`);
    if (response.ok) setInbox((await response.json()).requests ?? []);
  }
  async function signIn() {
    try {
      const result = await api("/api/auth/magic", "POST", { email, token: token || undefined,
        districtId: districtId || undefined, legalName: legalName || undefined,
        phone: phone || undefined, address: address || undefined, consentVersion: "1" });
      if (result.shopId) { setShopId(result.shopId); await load(result.shopId); }
      else setMessage("Check your development console or email for the sign-in link.");
    } catch (error) { setMessage(String(error)); }
  }
  async function createDesign() {
    try {
      await api(`/api/shops/${shopId}/designs`, "POST", { categoryId, name: designName, attributes: {} });
      await load(shopId);
    } catch (error) { setMessage(String(error)); }
  }
  async function upload(id: string, file?: File) {
    if (!file) return;
    const form = new FormData();
    form.set("designId", id); form.set("photo", file);
    if (synthetic) form.set("synthetic", "true");
    const response = await fetch(`/api/shops/${shopId}/photos`, { method: "POST", body: form });
    setMessage(response.ok ? t.pending : (await response.json()).error);
    await load(shopId);
  }
  async function review(tagId: string, action: "confirm" | "reject") {
    try { await api(`/api/shops/${shopId}/tags`, "PATCH", { tagId, action }); await load(shopId); }
    catch (error) { setMessage(String(error)); }
  }
  async function addUnit(designId: string) {
    try {
      await api(`/api/shops/${shopId}/units`, "POST", { designId, branchId, condition: "good" });
      setMessage("Unit added");
    } catch (error) { setMessage(String(error)); }
  }
  async function setRate(designId: string) {
    try {
      await api(`/api/shops/${shopId}/rates`, "PUT", { designId, periodType: "day",
        pricePaise: Number(pricePaise) });
      setMessage("Rate updated");
    } catch (error) { setMessage(String(error)); }
  }
  async function publish(designId: string) {
    try {
      await api(`/api/shops/${shopId}/status`, "PATCH", { status: "published", designId });
      await api(`/api/shops/${shopId}/status`, "PATCH", { status: "published" });
      await load(shopId);
    } catch (error) { setMessage(String(error)); }
  }
  async function respond(requestId: string, action: "interested" | "declined") {
    const reason = action === "declined" ? window.prompt("Reason for declining") : undefined;
    if (action === "declined" && !reason) return;
    try {
      await api(`/api/shops/${shopId}/inbox`, "PATCH", { requestId, action, reason });
      await load(shopId);
    } catch (error) { setMessage(String(error)); }
  }
  return <section><p className="eyebrow">{t.shopPortal}</p><h1>{t.shop}</h1>
    {!shopId && <div className="card">
      <label>{t.district}<select value={districtId} onChange={e => setDistrictId(e.target.value)}>
        <option value="">Select district</option>{districts.map(d =>
          <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>{t.email}<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>{t.legalName}<input value={legalName} onChange={e => setLegalName(e.target.value)} /></label>
      <label>{t.phone}<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <label>{t.address}<input value={address} onChange={e => setAddress(e.target.value)} /></label>
      <label>Magic link token<input value={token} onChange={e => setToken(e.target.value)} /></label>
      <button onClick={signIn}>{token ? t.signIn : "Send sign-in link"}</button>
    </div>}
    {shopId && <><div className="card"><h2>{t.newDesign}</h2>
      <label>{t.category}<select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
        <option value="">Select category</option>{categories.map(c =>
          <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>{t.name}<input value={designName} onChange={e => setDesignName(e.target.value)} /></label>
      <button onClick={createDesign}>{t.submit}</button></div>
      <h2>{t.inventory}</h2><label><input type="checkbox" checked={synthetic}
        onChange={e => setSynthetic(e.target.checked)} />Synthetic staging photo</label>
      {designs.map(d => <article className="card" key={d.id}><h3>{d.name}</h3>
        <p>{d.status} · {branchId}</p><label>{t.photo}<input type="file" accept="image/*"
          onChange={e => upload(d.id, e.target.files?.[0])} /></label>
        <button onClick={() => addUnit(d.id)}>Add unit</button>
        <label>{t.price}<input type="number" min="0" step="1" value={pricePaise}
          onChange={e => setPricePaise(e.target.value)} /></label>
        <button onClick={() => setRate(d.id)}>Set daily rate</button>
        <button onClick={() => publish(d.id)}>{t.published}</button>
        {d.tags.map(tag => <p key={tag.id}>{tag.field}: {tag.value}
          <button onClick={() => review(tag.id, "confirm")}>{t.confirm}</button>
          <button onClick={() => review(tag.id, "reject")}>{t.reject}</button></p>)}</article>)}
      <h2>{t.requestInbox}</h2>{inbox.map(item => <article className="card" key={item.id}>
        <h3>{item.name}</h3><p>{item.phone} · {item.event_start}</p><p>{item.description}</p>
        <button onClick={() => respond(item.id, "interested")}>{t.interest}</button>
        <button onClick={() => respond(item.id, "declined")}>{t.decline}</button></article>)}</>}
    <p role="status">{message}</p></section>;
}
