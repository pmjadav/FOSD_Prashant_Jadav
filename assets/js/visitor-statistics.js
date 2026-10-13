const totalViewsUrl = "https://pmjadav.goatcounter.com/counter/TOTAL.json";
const totalViewsElement = document.getElementById("visitor-total-count");
const statisticsStatus = document.getElementById("visitor-stat-status");

async function loadTotalPageViews() {
    try {
        const response = await fetch(totalViewsUrl, {
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                totalViewsElement.textContent = "—";
                statisticsStatus.textContent = "Enable “Allow adding visitor counts on your website” in GoatCounter site settings to display this total.";
                return;
            }
            throw new Error(`GoatCounter returned HTTP ${response.status}.`);
        }

        const result = await response.json();
        if (!result || typeof result.count !== "string" || !/^\d[\d,]*$/.test(result.count)) {
            throw new Error("GoatCounter returned an invalid page-view count.");
        }

        totalViewsElement.textContent = result.count;
        statisticsStatus.textContent = "";
    } catch (error) {
        console.error("Unable to load GoatCounter page-view total:", error);
        totalViewsElement.textContent = "—";
        statisticsStatus.textContent = "The page-view total is unavailable. Check that visitor counts are enabled in GoatCounter site settings, then try again later.";
    }
}

loadTotalPageViews();
