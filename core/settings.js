
/** @fileoverview Controls settings menu and persisted toggles. */

/**
 * Initializes settings interactions.
 * @param {{
 *   statusText: function(boolean): string,
 *   hideSuggestions: function(): void,
 *   openLogoModal: (function(): void)|null,
 *   getSuggestEnabled: function(): boolean,
 *   setSuggestEnabled: function(boolean): void
 * }} context Shared callbacks and accessors from `core/index.js`.
 */
window.initSettingsModule = function (context) {
    const statusText = context.statusText;
    const hideSuggestions = context.hideSuggestions;
    const openLogoModal = context.openLogoModal;
    const getSuggestEnabled = context.getSuggestEnabled;
    const setSuggestEnabled = context.setSuggestEnabled;

    const settingsButton = document.getElementById("settings-button");
    const settingsMenu = document.getElementById("settings-menu");
    const themeToggle = document.getElementById("theme-toggle");
    const themeStatus = document.getElementById("theme-status");
    const suggestToggle = document.getElementById("suggest-toggle");
    const suggestStatus = document.getElementById("suggest-status");
    const customLogoOpen = document.getElementById("custom-logo-open");

    if (
        !settingsButton ||
        !settingsMenu ||
        !themeToggle ||
        !themeStatus ||
        !suggestToggle ||
        !suggestStatus ||
        !customLogoOpen ||
        typeof statusText !== "function" ||
        typeof hideSuggestions !== "function" ||
        typeof getSuggestEnabled !== "function" ||
        typeof setSuggestEnabled !== "function"
    ) {
        return;
    }

    const isDarkInit = localStorage.getItem("theme") === "dark";
    if (isDarkInit) {
        document.body.classList.add("dark-mode");
    }

    /**
     * Shows or hides settings menu popover.
     * @param {boolean} visible Whether menu should be visible.
     */
    function setSettingsMenuVisible(visible) {
        settingsMenu.style.display = visible ? "block" : "none";
    }

    themeStatus.textContent = statusText(isDarkInit);

    suggestStatus.textContent = statusText(getSuggestEnabled());

    settingsButton.addEventListener("click", function (event) {
        event.stopPropagation();
        const isOpen = settingsMenu.style.display === "block";
        setSettingsMenuVisible(!isOpen);
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest("#settings-wrapper")) {
            setSettingsMenuVisible(false);
        }
    });

    themeToggle.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");
        themeStatus.textContent = statusText(isDark);
        // Persist semantic values for stability across future option changes.
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });

    suggestToggle.addEventListener("click", function () {
        const nextValue = !getSuggestEnabled();
        setSuggestEnabled(nextValue);
        suggestStatus.textContent = statusText(nextValue);
        localStorage.setItem("suggest", nextValue ? "on" : "off");
        // Keep UI and behavior consistent immediately after disabling.
        if (!nextValue) {
            hideSuggestions();
        }
    });

    customLogoOpen.addEventListener("click", function () {
        setSettingsMenuVisible(false);
        if (typeof openLogoModal === "function") {
            openLogoModal();
        }
    });
};
