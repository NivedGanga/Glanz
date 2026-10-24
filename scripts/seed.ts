import { db, pool } from "../src/db/index";
import { sql } from "drizzle-orm";
import { run1Flags } from "../src/lib/catalog";

async function main() {
  const [district] = await db.execute(sql`
    INSERT INTO district(name,country_code,timezone,currency,launch_state,center_lat,center_lng,radius_km,is_fake)
    VALUES ('Kochi, Kerala, India','+91','Asia/Kolkata','INR','demo',9.9700,76.2800,30,true)
    RETURNING id`);
  const [plan] = await db.execute(sql`INSERT INTO plan(name,is_fake) VALUES ('free',true)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`);
  const [category] = await db.execute(sql`
    INSERT INTO category(name,attribute_schema,default_buffer_days,is_fake)
    VALUES ('Costumes','{"gender_fit":["any","women","men"],"colour":["red","blue","green","gold"],"era_style":["traditional","modern","period"],"occasion":["stage","photo shoot"],"size_range":["small","medium","large"]}',1,true)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`);
  for (const [key, description] of Object.entries(run1Flags)) {
    await db.execute(sql`INSERT INTO flag(key,enabled,owner,description,removal_target)
      VALUES (${key},false,'owner',${description},'2027-12-31')
      ON CONFLICT(key) DO NOTHING`);
  }
  for (const [term, canonical] of [
    ["vesham","costume"],["uduppu","dress"],["pookkalam","floral"],
    ["fancy dress","costume"],["costumes","costume"],["stage wear","stage"]
  ]) {
    await db.execute(sql`INSERT INTO synonym(field,term,canonical_value,created_by,status,is_fake)
      VALUES ('keyword',${term},${canonical},'demo seed','draft',true)`);
  }
  for (const [name, email, phone, address, lat, lng] of [
    ["Harbour Lantern Costumes","harbour@example.invalid","+919000000101","Imaginary Lane, Fort Kochi",9.9674,76.2420],
    ["Marigold Stage Wardrobe","marigold@example.invalid","+919000000102","Fictional Road, Ernakulam town",9.9816,76.2999],
    ["Paper Moon Rentals","papermoon@example.invalid","+919000000103","Make Believe Street, Edappally",10.0261,76.3080]
  ] as const) {
    const [shop] = await db.execute(sql`INSERT INTO shop(legal_name,email,district_id,phone,plan_id,is_fake)
      VALUES (${name},${email},${district.id},${phone},${plan.id},true) RETURNING id`);
    const [branch] = await db.execute(sql`INSERT INTO branch(shop_id,address,lat,lng,is_fake)
      VALUES (${shop.id},${address},${lat},${lng},true) RETURNING id`);
    await db.execute(sql`INSERT INTO shop_settings(shop_id,notification_daily_cap)
      VALUES (${shop.id},3)`);
    const [design] = await db.execute(sql`INSERT INTO design(shop_id,category_id,name,description,attributes,is_fake)
      VALUES (${shop.id},${category.id},'Stage dress','Original synthetic demo listing',
      '{"gender_fit":"women","colour":"red","era_style":"traditional","occasion":"stage","size_range":"medium"}',true) RETURNING id`);
    for (let n = 0; n < 3; n++) await db.execute(sql`INSERT INTO unit(design_id,branch_id,condition,is_fake)
      VALUES (${design.id},${branch.id},'good',true)`);
    for (const period of ["day","weekend","week","custom"]) {
      await db.execute(sql`INSERT INTO rate_card(design_id,period_type,price_paise,currency)
        VALUES (${design.id},${period},150000,${"INR"})`);
    }
  }
  console.log("Demo seed created; all shops remain unpublished and flags remain off.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
