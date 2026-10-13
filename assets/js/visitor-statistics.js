const visitorCounter = document.getElementById("visitor-total-count");
const visitorCounterStatus = document.getElementById("visitor-stat-status");
const visitorCounterScript = document.querySelector(
    'script[data-goatcounter="https://pmjadav.goatcounter.com/count"]'
);

function renderVisitorCounter() {
    if (!window.goatcounter || typeof window.goatcounter.visit_count !== "function") {
        return false;
    }

    visitorCounter.replaceChildren();
    try {
        window.goatcounter.visit_count({
            append: "#visitor-total-count",
            path: "TOTAL",
            type: "html",
            no_branding: true,
            attr: {
                width: "220",
                height: "60",
                title: "Total page views recorded by GoatCounter"
            },
            style: `div {
                border: 0;
                background: transparent;
                color: ${document.body.classList.contains("dark") ? "#f3f6fc" : "#12213a"};
                font-family: system-ui, sans-serif;
                font-size: 1.25rem;
                font-weight: 800;
            }`
        });
    } catch (error) {
        console.error("Unable to display the GoatCounter visitor count:", error);
        visitorCounterStatus.textContent = "The total page-view counter could not be displayed. Please check the GoatCounter visitor-count setting.";
    }
    return true;
}

function waitForVisitorCounter(attempt = 0) {
    if (renderVisitorCounter()) {
        return;
    }
    if (attempt >= 50) {
        visitorCounter.textContent = "—";
        visitorCounterStatus.textContent = "The GoatCounter counter could not be loaded. Please check your connection and the visitor-count setting.";
        return;
    }
    window.setTimeout(() => waitForVisitorCounter(attempt + 1), 100);
}

waitForVisitorCounter();

const visitorThemeObserver = new MutationObserver(() => {
    if (visitorCounter.querySelector("iframe")) {
        renderVisitorCounter();
    }
});
visitorThemeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
});

if (visitorCounterScript) {
    visitorCounterScript.addEventListener("error", () => {
        visitorCounter.textContent = "—";
        visitorCounterStatus.textContent = "The GoatCounter counter could not be loaded. Please check your connection and try again later.";
    }, { once: true });
}
