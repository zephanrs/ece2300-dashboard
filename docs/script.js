const sectionColors = {
  "Monday Morning": "#60a5fa",
  "Monday Evening": "#34d399",
  "Tuesday": "#fbbf24",
  "Wednesday": "#f87171"
};

async function loadData() {
  try {
    const res = await fetch("./report.json");
    const data = await res.json();
    renderLegend();
    renderCharts(data);
    renderLastUpdated(data._last_updated);
  } catch (e) {
    console.error("Error loading data:", e);
    document.getElementById("charts").innerHTML =
      "<p class='text-center text-red-500'>Failed to load report.json</p>";
  }
}

function renderLegend() {
  const legend = document.getElementById("legend");
  for (const [section, color] of Object.entries(sectionColors)) {
    const item = document.createElement("div");
    item.className = "flex items-center gap-2";
    item.innerHTML = `<div class="w-4 h-4 rounded" style="background:${color}"></div> ${section}`;
    legend.appendChild(item);
  }
}

function renderCharts(data) {
  const container = document.getElementById("charts");
  container.innerHTML = "";

  Object.entries(data)
    .filter(([key]) => key !== "_last_updated")
    .forEach(([action, tests]) => {
      const header = document.createElement("h2");
      header.className =
        "text-2xl font-semibold mb-6 text-slate-700 border-b pb-2 border-gray-300";
      header.textContent = action;
      container.appendChild(header);

      Object.entries(tests).forEach(([testName, sections]) => {
        const card = document.createElement("div");
        card.className =
          "bg-white rounded-2xl shadow p-3 hover:shadow-lg transition-shadow duration-200";
        const canvas = document.createElement("canvas");
        canvas.height = 120; // slightly taller for larger title
        card.appendChild(canvas);
        container.appendChild(card);

        const labels = ["Pass", "Fail"];
        const datasets = Object.keys(sectionColors).map((section) => ({
          label: section,
          data: [
            sections[section]?.pass ?? 0,
            sections[section]?.fail ?? 0
          ],
          backgroundColor: sectionColors[section]
        }));

        const cleanTitle = testName.replace(/-test$/, "");

        new Chart(canvas, {
          type: "bar",
          data: { labels, datasets },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              // ✅ Larger centered title
              title: {
                display: true,
                text: cleanTitle,
                color: "#334155",
                font: {
                  size: 20, // increased from 16 → 20
                  weight: "700"
                },
                padding: {
                  top: 0,
                  bottom: 14 // extra breathing room before chart
                }
              },
              legend: { display: false },
              tooltip: {
                backgroundColor: "rgba(30,41,59,0.9)",
                titleFont: { weight: "bold" },
                callbacks: {
                  title: () => cleanTitle,
                  label: (ctx) => {
                    const label = ctx.dataset.label;
                    const status = ctx.label;
                    const val = ctx.formattedValue;
                    return `${label} – ${status}: ${val}`;
                  }
                }
              }
            },
            scales: {
              x: {
                stacked: true,
                title: {
                  display: true,
                  text: "Number of Students",
                  color: "#64748b"
                },
                grid: { color: "#e2e8f0" }
              },
              y: {
                stacked: true,
                offset: true,
                ticks: {
                  color: "#475569",
                  autoSkip: false
                },
                grid: { display: false }
              }
            }
          }
        });
      });
    });
}

function renderLastUpdated(timestamp) {
  const footer = document.getElementById("last-updated");
  if (timestamp) {
    const date = new Date(timestamp);
    footer.textContent = `Last updated: ${date.toLocaleString()}`;
  } else {
    footer.textContent = "Last updated: unknown";
  }
}

loadData();
