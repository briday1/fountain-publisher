// Policy pages follow the editor preference without loading account or document data.
(() => {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => {
    let theme = "system";
    try {
      const stored = JSON.parse(
        localStorage.getItem("fp2.preferences") || "{}",
      );
      if (
        [
          "light",
          "dark",
          "solarized-light",
          "solarized-dark",
          "sepia",
        ].includes(stored?.theme)
      )
        theme = stored.theme;
    } catch {
      // Browser storage may be unavailable. Use the system preference.
    }
    document.documentElement.dataset.theme =
      theme === "system" ? (system.matches ? "dark" : "light") : theme;
  };
  applyTheme();
  system.addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key === "fp2.preferences" || event.key === null) applyTheme();
  });
})();
