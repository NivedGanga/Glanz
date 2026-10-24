import { t } from "../../lib/i18n";
export default function AdminPage() {
  return <section><p className="eyebrow">MODERATION</p><h1>{t.report}</h1>
    <p>Review reports using the authenticated admin API. No report is auto-dismissed.</p></section>;
}
