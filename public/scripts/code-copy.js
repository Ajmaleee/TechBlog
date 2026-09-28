(function () {
  function init() {
    document.querySelectorAll("pre").forEach(function (pre) {
      if (pre.dataset.enhanced) return;
      pre.dataset.enhanced = "true";

      var codeEl = pre.querySelector("code");
      var wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Language label, derived from Shiki's data-language attribute.
      var lang = pre.getAttribute("data-language") || (codeEl && codeEl.className.match(/language-(\w+)/) || [])[1];
      if (lang) {
        var label = document.createElement("span");
        label.className = "code-lang";
        label.textContent = lang;
        wrapper.appendChild(label);
      }

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-code-btn";
      btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy code to clipboard");
      btn.addEventListener("click", function () {
        var text = codeEl ? codeEl.innerText : pre.innerText;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = "Copied!";
          setTimeout(function () {
            btn.textContent = "Copy";
          }, 1800);
        });
      });
      wrapper.appendChild(btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
