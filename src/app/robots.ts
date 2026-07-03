import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/partners", "/partners/apply"],
        disallow: [
          "/api/",
          "/portal",
          "/onboarding",
          "/partner-program",
          "/members",
          "/reports",
          "/settings",
          "/audit-log",
          "/integrations",
          "/campaigns",
          "/automations",
          "/subscriptions",
        ],
      },
    ],
    sitemap: "https://affiliates.chiefaiofficer.com/sitemap.xml",
    host: "https://affiliates.chiefaiofficer.com",
  };
}
