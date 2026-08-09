/* Override visual editor diterapkan hanya bila nilai tersimpan; CSS/konten awal tetap default. */
(function () {
  const CSS_KEYS = {
    typography: ["fontFamily", "fontSize", "fontWeight", "color", "lineHeight", "textAlign"],
    button: ["background", "color", "borderColor", "borderWidth", "borderStyle", "borderRadius", "padding", "boxShadow"],
    position: ["transform", "position", "zIndex"],
    overlay: ["--visual-overlay-color", "--visual-overlay-opacity"]
  };
  function apply(cfg, doc = document) {
    const values = (((cfg || {}).visualEditor || {}).elements) || {};
    const registry = window.VisualEditorRegistry;
    if (!registry) return;
    Object.entries(values).forEach(([id, value]) => {
      // Target teks auto memakai ID lengkap `text.auto::N`; target lama
      // memakai base ID + indeks. Registry menentukan selector tepercaya.
      const directTarget = registry.get(id, doc);
      const [baseId, rawIndex] = String(id).split("::");
      const target = directTarget || registry.get(baseId, doc);
      const index = directTarget ? null : (rawIndex === undefined ? null : Number(rawIndex));
      if (!target || !value) return;
      const nodes = [...doc.querySelectorAll(target.selector)];
      const selectedNodes = Number.isInteger(index) ? [nodes[index]].filter(Boolean) : nodes;
      selectedNodes.forEach((el) => {
        if (value.text && typeof value.text.value === "string") el.textContent = value.text.value;
        ["typography", "button", "position"].forEach((category) => {
          const setting = value[category];
          if (!setting) return;
          CSS_KEYS[category].forEach((key) => { if (setting[key] !== undefined && setting[key] !== "") el.style[key] = setting[key]; });
        });
        if (value.overlay && target.kind === "image") {
          el.style.setProperty("--visual-overlay-color", value.overlay.color || "");
          if (value.overlay.opacity !== undefined) el.style.setProperty("--visual-overlay-opacity", String(value.overlay.opacity));
          el.classList.add("visual-overlay-custom");
        }
      });
    });
  }
  window.applyVisualEditorOverrides = apply;
})();
