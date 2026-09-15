import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,reorder_level,selling_price");

  console.log("DATA:");
  console.log(data);

  console.log("ERROR:");
  console.log(error);
}

main().catch((error) => {
  console.error("CHECK ERROR:");
  console.error(error);
  process.exit(1);
});
