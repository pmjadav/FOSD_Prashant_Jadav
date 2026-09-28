const scriptUrl = document.currentScript ? document.currentScript.src : window.location.href;
const siteRoot = new URL("../../", scriptUrl);

async function loadComponent(containerId, componentPath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(new URL(componentPath, siteRoot));
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const template = document.createElement("template");
        template.innerHTML = await response.text();

        template.content.querySelectorAll("[data-site-href]").forEach(link => {
            link.href = new URL(link.dataset.siteHref, siteRoot).href;
        });
        template.content.querySelectorAll("[data-site-src]").forEach(image => {
            image.src = new URL(image.dataset.siteSrc, siteRoot).href;
        });

        container.replaceChildren(template.content);
    } catch (error) {
        console.error(`Unable to load ${componentPath}:`, error);
    }
}

function setActiveNavigation() {
    const currentPath = window.location.pathname;
    const rootPath = siteRoot.pathname;
    const relativePath = currentPath.startsWith(rootPath)
        ? currentPath.slice(rootPath.length)
        : currentPath.replace(/^\/+/, "");
    const pagePath = relativePath || "index.html";
    const questionBankPages = new Set([
        "question-bank.html",
        "conceptual.html",
        "numerical.html",
        "gate-pyqs.html",
        "hot-questions.html"
    ]);

    document.querySelectorAll("#navLinks a").forEach(link => {
        link.classList.remove("active");
        link.removeAttribute("aria-current");

        const isActive = link.dataset.navPage === pagePath
            || (link.dataset.navGroup === "units" && pagePath.startsWith("units/"))
            || (link.dataset.navGroup === "practicals" && pagePath.startsWith("practicals/"))
            || (link.dataset.navGroup === "question-bank" && questionBankPages.has(pagePath));

        if (isActive) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });
}

function initializeSiteFeatures() {
    const nav = document.getElementById("navLinks");
    const menu = document.getElementById("menuToggle");
    if (menu && nav) {
        menu.addEventListener("click", () => nav.classList.toggle("open"));
    }

    const theme = document.getElementById("themeToggle");
    if (theme) {
        if (localStorage.getItem("fosd-dark") === "true") {
            document.body.classList.add("dark");
        }
        theme.addEventListener("click", () => {
            document.body.classList.toggle("dark");
            localStorage.setItem("fosd-dark", document.body.classList.contains("dark"));
        });
    }

    const search = document.getElementById("siteSearch");
    if (search) {
        search.addEventListener("input", () => {
            const query = search.value.toLowerCase().trim();
            document.querySelectorAll("[data-search]").forEach(element => {
                element.style.display = !query || element.dataset.search.toLowerCase().includes(query) ? "" : "none";
            });
        });
    }

    document.querySelectorAll(".pdf-placeholder").forEach(link => {
        link.addEventListener("click", event => {
            if (link.dataset.status === "soon") {
                event.preventDefault();
                alert(`PDF placeholder\n\nUpload the corresponding PDF to:\n${link.dataset.file}\n\nThe link is already prepared for GitHub Pages.`);
            }
        });
    });
}

async function initializeSite() {
    await Promise.all([
        loadComponent("site-navbar", "components/navbar.html"),
        loadComponent("site-footer", "components/footer.html")
    ]);
    setActiveNavigation();
    initializeSiteFeatures();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSite, { once: true });
} else {
    initializeSite();
}
