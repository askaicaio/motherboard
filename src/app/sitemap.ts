import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: "https://affiliates.chiefaiofficer.com/",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://affiliates.chiefaiofficer.com/partners/apply",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://roadmap.chiefaiofficer.com/",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
