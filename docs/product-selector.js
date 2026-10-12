(() => {
  const SELECTOR_CLASS = "product-selector";
  const MOBILE_TARGET = "#mobile-nav-content";

  function closeSelector(selector) {
    const trigger = selector.querySelector("[aria-haspopup='menu']");
    const menu = selector.querySelector("[role='menu']");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  function openSelector(selector) {
    const trigger = selector.querySelector("[aria-haspopup='menu']");
    const menu = selector.querySelector("[role='menu']");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  }

  function createSelector(variant) {
    const selector = document.createElement("div");
    const menuId = `product-selector-menu-${variant}`;
    selector.className = `${SELECTOR_CLASS} page-context-dropdown ${SELECTOR_CLASS}--${variant}`;

    const label = document.createElement("a");
    label.className = "page-context-dropdown__label";
    label.href = "/docs/phoenix";
    label.textContent = "Arize Phoenix";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "page-context-dropdown__chevron";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);
    trigger.setAttribute("aria-haspopup", "menu");

    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevron.setAttribute("viewBox", "0 0 24 24");
    chevron.setAttribute("fill", "none");
    chevron.setAttribute("stroke", "currentColor");
    chevron.setAttribute("stroke-width", "2");
    chevron.setAttribute("stroke-linecap", "round");
    chevron.setAttribute("stroke-linejoin", "round");
    const chevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chevronPath.setAttribute("d", "m6 9 6 6 6-6");
    chevron.append(chevronPath);
    trigger.append(chevron);

    const menu = document.createElement("div");
    menu.className = "page-context-dropdown__menu";
    menu.hidden = true;
    menu.id = menuId;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Choose documentation");

    [
      ["Arize Phoenix", "/docs/phoenix"],
      ["Arize AX", "https://arize.com/docs/ax"],
    ].forEach(([text, href]) => {
      const link = document.createElement("a");
      link.className = "page-context-dropdown__item";
      link.href = href;
      link.textContent = text;
      link.setAttribute("role", "menuitem");
      if (text === "Arize Phoenix") link.dataset.selected = "true";
      menu.append(link);
    });

    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(`.${SELECTOR_CLASS}`).forEach(closeSelector);
      if (!isOpen) openSelector(selector);
    });

    selector.addEventListener("keydown", (event) => {
      const items = [...menu.querySelectorAll("[role='menuitem']")];
      const itemIndex = items.indexOf(document.activeElement);

      if (event.key === "Escape") {
        closeSelector(selector);
        trigger.focus();
      } else if (document.activeElement === trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openSelector(selector);
        items[event.key === "ArrowDown" ? 0 : items.length - 1].focus();
      } else if (itemIndex !== -1 && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const nextIndex =
          event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (itemIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[nextIndex].focus();
      }
    });

    selector.append(label, trigger, menu);
    return selector;
  }

  function mountAfter(anchor, variant) {
    if (!anchor || document.querySelector(`.${SELECTOR_CLASS}--${variant}`)) return;
    anchor.after(createSelector(variant));
  }

  function mountIn(target, variant) {
    if (!target || target.querySelector(`.${SELECTOR_CLASS}--${variant}`)) return;
    target.prepend(createSelector(variant));
  }

  function initialize() {
    const logo = document.querySelector("#navbar .nav-logo");
    mountAfter(logo?.closest("a") ?? logo, "desktop");
    mountIn(document.querySelector(MOBILE_TARGET), "mobile");
  }

  document.addEventListener("click", (event) => {
    document.querySelectorAll(`.${SELECTOR_CLASS}`).forEach((selector) => {
      if (!selector.contains(event.target)) closeSelector(selector);
    });
  });

  initialize();
  new MutationObserver(initialize).observe(document.body, { childList: true, subtree: true });
})();
