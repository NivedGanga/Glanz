import Link from "next/link";
import { t } from "../lib/i18n";
export default function Home() {
  return <section><p className="eyebrow">COSTUME RENTALS</p><h1>{t.title}</h1>
    <p>Discover local wardrobes, or bring yours to the stage.</p>
    <nav><Link href="/app">{t.customer}</Link><Link href="/shop">{t.shop}</Link></nav></section>;
}
