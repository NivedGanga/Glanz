import { db } from "../../../db";
import { sql } from "drizzle-orm";
import { digest } from "../../../lib/tokens";
import { flags } from "../../../lib/flags";
import { notFound } from "next/navigation";
export default async function Catalog({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!await flags.enabled("shop.catalog_link") || token.length < 32) notFound();
  const rows = await db.execute(sql`SELECT s.legal_name,s.phone,d.name,r.price_paise,r.currency
    FROM shop s JOIN design d ON d.shop_id=s.id LEFT JOIN rate_card r ON r.design_id=d.id
    WHERE s.catalog_token_hash=${digest(token)}`);
  if (!rows.length) notFound();
  return <section><h1>{String(rows[0].legal_name)}</h1><p>{String(rows[0].phone)}</p>
    {rows.map((row, i) => <article className="card" key={i}><h2>{String(row.name)}</h2>
      <p>{String(row.price_paise ?? "")} {String(row.currency ?? "")}</p></article>)}</section>;
}
