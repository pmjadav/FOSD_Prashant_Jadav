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
            type: "svg",
            no_branding: true,
            attr: {
                width: "200",
                height: "80",
                title: "Total page views recorded by GoatCounter",
                alt: "Total page views recorded by GoatCounter"
            }
        });
        const counterImage = visitorCounter.querySelector("img");
        if (counterImage) {
            counterImage.addEventListener("load", () => {
                visitorCounterStatus.textContent = "";
            }, { once: true });
            counterImage.addEventListener("error", () => {
                visitorCounterStatus.textContent = "The GoatCounter counter could not be reached. Check your connection and confirm public visitor counts are enabled in GoatCounter.";
            }, { once: true });
        }
    } catch (error) {
        console.error("Unable to display the GoatCounter visitor count:", error);
        visitorCounterStatus.textContent = "The total page-view counter could not be displayed. Check your connection and the GoatCounter public visitor-count setting.";
    }
    return true;
}

function waitForVisitorCounter(attempt = 0) {
    if (renderVisitorCounter()) {
        return;
    }
    if (attempt >= 50) {
        visitorCounter.textContent = "—";
        visitorCounterStatus.textContent = "The GoatCounter counter could not be loaded. Check your connection and confirm public visitor counts are enabled.";
        return;
    }
    window.setTimeout(() => waitForVisitorCounter(attempt + 1), 100);
}

waitForVisitorCounter();

if (visitorCounterScript) {
    visitorCounterScript.addEventListener("error", () => {
        visitorCounter.textContent = "—";
        visitorCounterStatus.textContent = "The GoatCounter counter could not be loaded. Please check your connection and try again later.";
    }, { once: true });
}
