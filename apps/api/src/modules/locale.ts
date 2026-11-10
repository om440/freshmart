export type SupportedLocale = "en" | "prs";

export function resolveLocale(queryLocale: unknown, acceptLanguage: string | undefined): SupportedLocale {
  const requested = typeof queryLocale === "string" ? queryLocale.toLowerCase().trim() : "";
  if (requested === "en" || requested.startsWith("en-")) {
    return "en";
  }
  if (requested === "prs" || requested.startsWith("prs-")) {
    return "prs";
  }

  const languages = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [range, ...parameters] = part.trim().split(";");
      const q = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
      return {
        language: range.trim().toLowerCase(),
        quality: q ? Number(q.trim().slice(2)) || 0 : 1,
      };
    })
    .filter((item) => item.language && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality);

  for (const { language } of languages) {
    if (language === "prs" || language.startsWith("prs-")) {
      return "prs";
    }
    if (language === "en" || language.startsWith("en-")) {
      return "en";
    }
  }
  return "en";
}
