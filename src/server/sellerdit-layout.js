const DEFAULT_LAYOUT_CLASS = "community-workspace community-reddit-layout sellerdit-with-left-rail";
const DEFAULT_CONTENT_TAG = "section";
const DEFAULT_CONTENT_CLASS = "community-feed-panel";

function escapeAttribute(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function joinClassNames(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
}

function attrs(value) {
  return value ? ` ${String(value).trim()}` : "";
}

/**
 * Shared Sellerdit page layout.
 *
 * This owns the order of the global header, body layout, left rail,
 * main content container, right rail, and footer-like side content.
 * Pages should pass only their content and optional rail markup.
 */
export function renderSellerditAppShell({
  activeKey = "community",
  currentUser = null,
  mainClass = "",
  layoutClass = DEFAULT_LAYOUT_CLASS,
  layoutAttrs = "",
  leftRail = null,
  contentTag = DEFAULT_CONTENT_TAG,
  contentClass = DEFAULT_CONTENT_CLASS,
  contentAttrs = "",
  content = "",
  rightRail = "",
  renderHeader,
  renderDefaultLeftRail,
} = {}) {
  if (typeof renderHeader !== "function") {
    throw new TypeError("renderSellerditAppShell requires renderHeader");
  }
  if (leftRail === null && typeof renderDefaultLeftRail !== "function") {
    throw new TypeError("renderSellerditAppShell requires renderDefaultLeftRail when leftRail is null");
  }

  const mainClassName = joinClassNames("community-shell", "sellerdit-layout-shell", mainClass);
  const layoutClassName = joinClassNames("sellerdit-layout-grid", layoutClass);
  const contentClassName = joinClassNames("sellerdit-layout-content", contentClass);
  const leftRailMarkup = leftRail === null ? renderDefaultLeftRail(activeKey, currentUser) : leftRail;

  return `<main class="${escapeAttribute(mainClassName)}">
      ${renderHeader(activeKey, currentUser)}
      <section class="${escapeAttribute(layoutClassName)}"${attrs(layoutAttrs)}>
        ${leftRailMarkup}
        <${contentTag} class="${escapeAttribute(contentClassName)}"${attrs(contentAttrs)}>
          ${content}
        </${contentTag}>
        ${rightRail}
      </section>
    </main>`;
}

/**
 * Shared header-only Sellerdit shell for pages without community rails.
 * It still guarantees the global header is rendered once in the same place.
 */
export function renderSellerditHeaderShell({
  activeKey = "community",
  currentUser = null,
  mainClass = "",
  content = "",
  renderHeader,
} = {}) {
  if (typeof renderHeader !== "function") {
    throw new TypeError("renderSellerditHeaderShell requires renderHeader");
  }
  const mainClassName = joinClassNames("community-shell", "sellerdit-layout-shell", "sellerdit-layout-shell-header-only", mainClass);
  return `<main class="${escapeAttribute(mainClassName)}">
      ${renderHeader(activeKey, currentUser)}
      ${content}
    </main>`;
}

export const SELLERDIT_LAYOUT_TOKENS = Object.freeze({
  desktopLeftRailWidth: "270px",
  desktopFeedWidth: "728px",
  desktopRightRailWidth: "338px",
  desktopColumnGap: "12px",
  desktopLeftOffset: "288px",
  topbarHeight: "56px",
});
