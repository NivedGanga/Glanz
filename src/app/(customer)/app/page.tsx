import { t } from "../../../lib/i18n";
export default function CustomerPage() {
  return <section><p className="eyebrow">DISCOVER</p><h1>{t.title}</h1>
    <p>Choose a district and dates to see costumes available for pickup.</p>
    <form action="/api/search"><label>District ID<input name="districtId" required /></label>
      <label>{t.eventDate}<input type="datetime-local" name="eventStart" required /></label>
      <label>{t.returnDate}<input type="datetime-local" name="returnEnd" required /></label>
      <button type="submit">{t.search}</button></form></section>;
}
