import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Costume rentals", short_name: "Costumes", start_url: "/app",
    display: "standalone", background_color: "#f6f2e7", theme_color: "#18362d" };
}
