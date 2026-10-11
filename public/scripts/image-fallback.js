(function () {
  // Graceful image fallback.
  //
  // Several article covers and inline screenshots are referenced in
  // Markdown before the actual .jpg files have been added to /public.
  // Rather than showing the browser's broken-image icon (and a gap in
  // the layout), every <img> that fails to load is swapped for an
  // on-brand placeholder that still shows the image's alt text, so the
  // page reads correctly and the missing asset is obvious to the author.
  //
  // Images can fail before this script runs, so we handle both a live
  // `error` event (capture phase, because error does not bubble) and a
  // one-time scan of images that already failed by load time.

  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<path d="m21 15-5-5L5 21"/></svg>';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function replace(img) {
    if (!img || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";

    var alt = (img.getAttribute("alt") || "").trim();
    var wrap = document.createElement("div");
    wrap.className = "img-fallback";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", alt ? "Image unavailable: " + alt : "Image unavailable");
    wrap.innerHTML =
      ICON +
      (alt ? '<span class="img-fallback__label">' + escapeHtml(alt) + "</span>" : "") +
      '<span class="img-fallback__hint">Image coming soon</span>';

    // Preserve the aspect ratio reserved by the original element so the
    // layout does not jump when the placeholder takes over.
    var ratio = img.getAttribute("width") && img.getAttribute("height")
      ? img.getAttribute("width") + " / " + img.getAttribute("height")
      : null;
    if (ratio) wrap.style.aspectRatio = ratio;

    if (img.parentNode) img.parentNode.replaceChild(wrap, img);
  }

  window.addEventListener(
    "error",
    function (event) {
      var target = event.target;
      if (target && target.tagName === "IMG") replace(target);
    },
    true
  );

  function scan() {
    var imgs = document.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      // complete + naturalWidth 0 === the request finished and failed.
      if (img.complete && img.naturalWidth === 0) replace(img);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  window.addEventListener("load", scan);
})();
