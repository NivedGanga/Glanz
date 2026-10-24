import { t } from "../../../lib/i18n";
export default function ShopPage() {
  return <section><p className="eyebrow">SHOP PORTAL</p><h1>{t.shop}</h1>
    <p>Sign in by email to manage your costume catalog.</p>
    <form action="/api/auth/magic" method="post"><label>{t.email}<input type="email" name="email" required /></label>
    <button type="submit">Send sign-in link</button></form></section>;
}
