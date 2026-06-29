const DEFAULT_BASE_URL = "https://wingcoupang.site";
const BASE_URL = normalizeBaseUrl(process.env.SEO_AUDIT_BASE_URL || process.env.DESIGN_BASE_URL || DEFAULT_BASE_URL);
const SAMPLE_LIMIT = Number(process.env.SEO_AUDIT_LIMIT || 20);
const REQUIRED_PATHS = ["/", "/community", "/community/qna", "/guides", "/llms.txt", "/robots.txt", "/sitemap.xml"];

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function absoluteUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${BASE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(html, regex) {
  const match = String(html || "").match(regex);
  return match ? decodeXml(match[1].trim()) : "";
}

function extractMeta(html, nameOrProperty) {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return extractTag(html, new RegExp(`<meta\\s+(?:name|property)=["']${escaped}["']\\s+content=["']([^"']*)["'][^>]*>`, "i"))
    || extractTag(html, new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:name|property)=["']${escaped}["'][^>]*>`, "i"));
}

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(String(html || "")))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      blocks.push({ __parseError: error.message });
    }
  }
  return blocks;
}

function flattenSchemaTypes(value, types = []) {
  if (!value || typeof value !== "object") return types;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenSchemaTypes(item, types));
    return types;
  }
  if (value["@type"]) {
    if (Array.isArray(value["@type"])) types.push(...value["@type"]);
    else types.push(value["@type"]);
  }
  if (Array.isArray(value["@graph"])) flattenSchemaTypes(value["@graph"], types);
  return types;
}

function findQAPageQuestion(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findQAPageQuestion(item);
      if (found) return found;
    }
    return null;
  }
  const type = value["@type"];
  const isQAPage = type === "QAPage" || (Array.isArray(type) && type.includes("QAPage"));
  if (isQAPage) return value.mainEntity || null;
  if (Array.isArray(value["@graph"])) return findQAPageQuestion(value["@graph"]);
  return null;
}

function hasAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function inspectQAPageAuthorUrls(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    const question = findQAPageQuestion(block);
    if (!question) continue;
    const questionAuthorUrl = question?.author?.url;
    const acceptedAnswer = Array.isArray(question.acceptedAnswer) ? question.acceptedAnswer[0] : question.acceptedAnswer;
    const answerAuthorUrl = acceptedAnswer?.author?.url;
    const hasAnswer = Boolean(acceptedAnswer);
    return {
      hasQAPage: true,
      ok: hasAbsoluteUrl(questionAuthorUrl) && (!hasAnswer || hasAbsoluteUrl(answerAuthorUrl)),
      issue: [
        hasAbsoluteUrl(questionAuthorUrl) ? "" : "QAPage Question author.url missing/relative",
        hasAnswer && !hasAbsoluteUrl(answerAuthorUrl) ? "acceptedAnswer author.url missing/relative" : "",
      ].filter(Boolean).join("; "),
    };
  }
  return { hasQAPage: false, ok: true, issue: "" };
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "sellerdit-seo-index-audit/1.0 (+https://wingcoupang.site)",
      Accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  return { status: response.status, finalUrl: response.url, text: await response.text(), contentType: response.headers.get("content-type") || "" };
}

function parseSitemapUrls(xml) {
  return Array.from(String(xml || "").matchAll(/<loc>([\s\S]*?)<\/loc>/gi)).map((match) => decodeXml(match[1].trim()));
}

function robotsAllowsPath(robotsText, url) {
  const path = new URL(url).pathname;
  const disallows = Array.from(String(robotsText || "").matchAll(/^Disallow:\s*(\S+)/gim)).map((match) => match[1]);
  return !disallows.some((rule) => rule && rule !== "/" && path.startsWith(rule));
}

function pickAuditUrls(sitemapUrls) {
  const required = REQUIRED_PATHS.map(absoluteUrl);
  const community = sitemapUrls.filter((url) => /\/community\//.test(url)).slice(0, 10);
  const guides = sitemapUrls.filter((url) => /\/guides\//.test(url)).slice(0, 3);
  const others = sitemapUrls.filter((url) => !required.includes(url) && !community.includes(url) && !guides.includes(url)).slice(0, 5);
  return Array.from(new Set([...required, ...community, ...guides, ...others])).slice(0, SAMPLE_LIMIT + REQUIRED_PATHS.length);
}

function summarizePage(url, fetched, sitemapSet, robotsText) {
  const html = fetched.text;
  const jsonLdBlocks = fetched.contentType.includes("html") ? extractJsonLd(html) : [];
  const jsonLdValid = jsonLdBlocks.every((block) => !block.__parseError);
  const schemaTypes = Array.from(new Set(flattenSchemaTypes(jsonLdBlocks))).join("|");
  const qa = inspectQAPageAuthorUrls(jsonLdBlocks);
  const canonical = extractTag(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["'][^>]*>/i)
    || extractTag(html, /<link\s+href=["']([^"']*)["']\s+rel=["']canonical["'][^>]*>/i);
  const robots = extractMeta(html, "robots");
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ");
  const description = extractMeta(html, "description");
  const issues = [];
  if (fetched.status !== 200) issues.push(`status ${fetched.status}`);
  if (fetched.contentType.includes("html")) {
    if (!canonical) issues.push("canonical missing");
    if (canonical && canonical !== url.replace(/\/$/, "")) {
      const normalizedUrl = url.replace(/\/$/, "");
      const normalizedCanonical = canonical.replace(/\/$/, "");
      if (normalizedCanonical !== normalizedUrl) issues.push("canonical mismatch");
    }
    if (!robots || !/index\s*,\s*follow/i.test(robots)) issues.push("robots not index,follow");
    if (!title) issues.push("title missing");
    if (!description) issues.push("description missing");
    if (!jsonLdBlocks.length) issues.push("json-ld missing");
    if (!jsonLdValid) issues.push("json-ld parse error");
    if (!qa.ok) issues.push(qa.issue);
  }
  if (!robotsAllowsPath(robotsText, url)) issues.push("blocked by robots.txt");
  return {
    url,
    status: fetched.status,
    canonical,
    robots,
    title,
    descriptionLength: description.length,
    jsonLdValid: jsonLdBlocks.length ? jsonLdValid : fetched.contentType.includes("html") ? false : true,
    schemaTypes,
    qapageAuthorUrlExists: qa.hasQAPage ? qa.ok : "n/a",
    inSitemap: sitemapSet.has(url),
    issue: issues.join("; "),
  };
}

function printTable(rows) {
  const columns = ["url", "status", "canonical", "robots", "title", "descriptionLength", "jsonLdValid", "schemaTypes", "qapageAuthorUrlExists", "inSitemap", "issue"];
  console.log(columns.join("\t"));
  rows.forEach((row) => {
    console.log(columns.map((column) => String(row[column] ?? "").replace(/[\t\n\r]+/g, " ")).join("\t"));
  });
}

const sitemapUrl = absoluteUrl("/sitemap.xml");
const robotsUrl = absoluteUrl("/robots.txt");
const [sitemap, robots] = await Promise.all([fetchText(sitemapUrl), fetchText(robotsUrl)]);
const sitemapUrls = parseSitemapUrls(sitemap.text);
const sitemapSet = new Set(sitemapUrls);
const auditUrls = pickAuditUrls(sitemapUrls);
const rows = [];
for (const url of auditUrls) {
  rows.push(summarizePage(url, await fetchText(url), sitemapSet, robots.text));
}
printTable(rows);

const blockingIssues = rows.filter((row) => row.issue && !["/llms.txt", "/robots.txt", "/sitemap.xml"].some((path) => row.url.endsWith(path)));
const sitemapOk = sitemap.status === 200 && sitemapUrls.length > 0 && sitemapUrls.every((url) => url.startsWith(BASE_URL));
const robotsOk = robots.status === 200 && /Sitemap:\s*https?:\/\//i.test(robots.text);
console.log(JSON.stringify({ baseUrl: BASE_URL, checked: rows.length, sitemapStatus: sitemap.status, sitemapUrlCount: sitemapUrls.length, sitemapOk, robotsStatus: robots.status, robotsOk, blockingIssueCount: blockingIssues.length }, null, 2));
if (!sitemapOk || !robotsOk || blockingIssues.length) {
  process.exitCode = 1;
}
