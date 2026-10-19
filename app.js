
const SUPABASE_URL = "https://bwhvfiklrvrodadbxoly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_R5xKqfJPBmp6PEsiRAvZ1w_IIypXVPZ";

let db = null;
let leads = [];
let sourceChart = null;
let statusChart = null;
let monthlyChart = null;
let loadingLeads = false;
let loadingGoogle = false;
let selectedPeriod = 30;
let googleData = null;
let googleTrendChart = null;
let googleDeviceChart = null;
let googleHoursChart = null;

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[c]);

function showLogin(message = "") {
  $("login-view").classList.remove("hidden");
  $("app-view").classList.add("hidden");
  $("login-message").textContent = message;
}

function showApp(user) {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("user-email").textContent = user?.email || "";
}

function setActiveTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-content").forEach(section => {
    section.classList.toggle("hidden", section.id !== tabId);
  });

  const google = tabId === "google-view";

  $("page-title").textContent = google
    ? "Métricas do Google"
    : "Leads do site";

  $("page-description").textContent = google
    ? "Acompanhe os resultados de acesso e navegação do site."
    : "Acompanhe os contatos e os resultados dos canais digitais.";

  if (google && db) loadGoogleMetrics();

  if (!google) {
    [sourceChart, statusChart, monthlyChart].forEach(chart => chart?.resize());
  }
}

function setupTabs() {
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("pt-BR");
}

function date(value) {
  if (!value) return "—";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      });
}

function wa(value) {
  const digits = String(value || "").replace(/\D/g, "");

  return digits
    ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits)
    : "";
}

function updateLeadMetrics() {
  $("total-leads").textContent = leads.length;

  $("site-leads").textContent = leads.filter(
    lead => lead.origem === "site_principal"
  ).length;

  $("bio-leads").textContent = leads.filter(
    lead => lead.origem === "bio_instagram"
  ).length;

  $("scheduled-leads").textContent = leads.filter(
    lead => lead.status === "agendado"
  ).length;
}

function updateCharts() {
  if (typeof window.Chart === "undefined") {
    $("data-message").textContent =
      "Leads carregados, mas a biblioteca dos gráficos não foi carregada.";
    return;
  }

  const sc = $("source-chart");
  const stc = $("status-chart");
  const mc = $("monthly-chart");

  if (!sc || !stc || !mc) return;

  sourceChart?.destroy();
  statusChart?.destroy();
  monthlyChart?.destroy();

  sourceChart = new Chart(sc, {
    type: "doughnut",
    data: {
      labels: [
        "Site principal",
        "Bio do Instagram",
        "Outras origens"
      ],
      datasets: [{
        data: [
          leads.filter(x => x.origem === "site_principal").length,
          leads.filter(x => x.origem === "bio_instagram").length,
          leads.filter(
            x => !["site_principal", "bio_instagram"].includes(x.origem)
          ).length
        ],
        backgroundColor: ["#805846", "#8aaf9b", "#d9b779"],
        borderColor: "#fffdfa",
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 18,
            usePointStyle: true
          }
        }
      }
    }
  });

  const keys = ["novo", "contatado", "agendado", "concluido", "perdido"];

  statusChart = new Chart(stc, {
    type: "bar",
    data: {
      labels: ["Novo", "Contatado", "Agendado", "Concluído", "Perdido"],
      datasets: [{
        label: "Quantidade de leads",
        data: keys.map(status =>
          leads.filter(lead => lead.status === status).length
        ),
        backgroundColor: [
          "#8aaf9b",
          "#d9b779",
          "#805846",
          "#6f8f72",
          "#c17c74"
        ],
        borderRadius: 6,
        maxBarThickness: 42
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            stepSize: 1
          }
        },
        y: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit"
      })
    });
  }

  monthlyChart = new Chart(mc, {
    type: "line",
    data: {
      labels: months.map(month => month.label),
      datasets: [{
        label: "Leads recebidos",
        data: months.map(month =>
          leads.filter(lead => {
            const d = lead.criado_em ? new Date(lead.criado_em) : null;

            return d &&
              !Number.isNaN(d.getTime()) &&
              d.getFullYear() === month.year &&
              d.getMonth() === month.month;
          }).length
        ),
        borderColor: "#805846",
        backgroundColor: "rgba(128,88,70,.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            stepSize: 1
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function renderLeads() {
  const q = $("search-input").value.trim().toLowerCase();
  const status = $("status-filter").value;
  const origin = $("origin-filter").value;

  const rows = leads.filter(lead =>
    `${lead.nome || ""} ${lead.whatsapp || ""}`.toLowerCase().includes(q) &&
    (!status || lead.status === status) &&
    (!origin || lead.origem === origin)
  );

  $("leads-table").innerHTML = rows.length
    ? rows.map(lead => {
        const options = [
          ["novo", "Novo"],
          ["contatado", "Contatado"],
          ["agendado", "Agendado"],
          ["concluido", "Concluído"],
          ["perdido", "Perdido"]
        ].map(([value, label]) =>
          `<option value="${value}" ${lead.status === value ? "selected" : ""}>${label}</option>`
        ).join("");

        const link = wa(lead.whatsapp);

        const originLabel = lead.origem === "site_principal"
          ? "Site principal"
          : lead.origem === "bio_instagram"
            ? "Bio Instagram"
            : esc(lead.origem);

        return `<tr>
          <td>${esc(lead.nome)}</td>
          <td>${link
            ? `<a class="whatsapp-link" href="${link}" target="_blank" rel="noopener">${esc(lead.whatsapp)}</a>`
            : esc(lead.whatsapp)}</td>
          <td>${originLabel}</td>
          <td><select class="status-select" data-status-id="${Number(lead.id)}">${options}</select></td>
          <td>${date(lead.criado_em)}</td>
          <td><button class="action-button" data-save-id="${Number(lead.id)}" type="button">Salvar</button></td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="6" class="empty">Nenhum lead encontrado.</td></tr>';
}

async function loadLeads() {
  if (!db || loadingLeads) return;

  loadingLeads = true;
  $("data-message").textContent = "Carregando leads...";

  try {
    const { data, error } = await db
      .from("leads")
      .select("id,nome,whatsapp,origem,status,criado_em")
      .order("criado_em", { ascending: false });

    if (error) throw error;

    leads = data || [];

    updateLeadMetrics();
    renderLeads();
    updateCharts();

    if (googleData) renderFunnel();

    $("data-message").textContent =
      `Dados atualizados: ${leads.length} lead(s).`;
  } catch (e) {
    console.error("Erro ao carregar leads:", e);

    $("data-message").textContent =
      "Não foi possível carregar os leads. Confira as permissões do Supabase.";
  } finally {
    loadingLeads = false;
  }
}

function leadsInPeriod(days) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);

  return leads.filter(lead => {
    const d = new Date(lead.criado_em);

    return !Number.isNaN(d.getTime()) && d >= start && d <= end;
  });
}

function renderGoogleTrend(data) {
  const canvas = $("google-trend-chart");

  if (!canvas || !window.Chart) return;

  googleTrendChart?.destroy();

  const series = data.daily || [];

  googleTrendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: series.map(item => item.dateLabel),
      datasets: [
        {
          label: "Usuários",
          data: series.map(item => item.users),
          borderColor: "#8aaf9b",
          backgroundColor: "rgba(138,175,155,.12)",
          tension: 0.3,
          pointRadius: series.length > 40 ? 0 : 2
        },
        {
          label: "Visualizações",
          data: series.map(item => item.pageViews),
          borderColor: "#cfae98",
          backgroundColor: "rgba(207,174,152,.08)",
          tension: 0.3,
          pointRadius: series.length > 40 ? 0 : 2
        },
        {
          label: "Cliques agendamento",
          data: series.map(item => item.bookingClicks),
          borderColor: "#df8eae",
          backgroundColor: "rgba(223,142,174,.08)",
          tension: 0.3,
          pointRadius: series.length > 40 ? 0 : 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 9,
            padding: 12
          }
        },
        tooltip: {
          callbacks: {
            label: ctx =>
              `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        },
        x: {
          ticks: {
            maxTicksLimit: 7,
            maxRotation: 0
          }
        }
      }
    }
  });
}

function renderTopPages(pages) {
  const el = $("google-top-pages");

  if (!el) return;

  if (!pages?.length) {
    el.innerHTML =
      '<p class="muted">O GA4 não retornou dados de páginas para este período.</p>';
    return;
  }

  const max = Math.max(...pages.map(item => Number(item.views) || 0), 1);

  el.innerHTML = pages.slice(0, 5).map((page, index) =>
    `<div class="ranked-row">
      <span class="rank-number">${index + 1}</span>
      <span class="rank-name" title="${esc(page.title || page.path)}">
        ${esc(page.title || page.path || "Página sem título")}
        <small>${esc(page.path || "")}</small>
      </span>
      <strong>${formatNumber(page.views)}</strong>
      <span class="rank-track"><i style="width:${Math.max(2, Number(page.views || 0) / max * 100)}%"></i></span>
    </div>`
  ).join("");
}

function renderTrafficSources(sources) {
  const el = $("google-traffic-sources");

  if (!el) return;

  if (!sources?.length) {
    el.innerHTML =
      '<p class="muted">O GA4 não retornou origens para este período.</p>';
    return;
  }

  const total = sources.reduce(
    (sum, item) => sum + Number(item.users || 0),
    0
  ) || 1;

  const icons = {
    "Organic Search": "G",
    "Organic Social": "◎",
    "Direct": "↗",
    "Referral": "↗",
    "Paid Search": "$",
    "Email": "✉"
  };

  el.innerHTML = sources.slice(0, 5).map(source => {
    const name = source.name || "Outros";
    const pct = Number(source.users || 0) / total * 100;

    return `<div class="source-row">
      <span class="source-mark">${esc(icons[name] || "•")}</span>
      <span class="source-name">${esc(name)}</span>
      <strong>${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
      <span class="source-track"><i style="width:${Math.max(2, pct)}%"></i></span>
    </div>`;
  }).join("");
}

function renderDevices(devices) {
  const el = $("google-devices");

  if (!el) return;

  const labels = {
    mobile: "Celular",
    desktop: "Computador",
    tablet: "Tablet"
  };

  const colors = ["#8aaf9b", "#cfae98", "#df8eae"];

  if (!devices?.length) {
    el.innerHTML =
      '<p class="muted">O GA4 não retornou dados de dispositivos para este período.</p>';
    return;
  }

  const total = devices.reduce(
    (sum, item) => sum + Number(item.users || 0),
    0
  );

  $("google-device-total").textContent = formatNumber(total);

  googleDeviceChart?.destroy();

  googleDeviceChart = new Chart($("google-device-chart"), {
    type: "doughnut",
    data: {
      labels: devices.map(item => labels[item.name] || item.name),
      datasets: [{
        data: devices.map(item => item.users),
        backgroundColor: devices.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx =>
              `${ctx.label}: ${formatNumber(ctx.parsed)} usuários`
          }
        }
      }
    }
  });

  el.innerHTML = devices.map((device, index) => {
    const pct = total
      ? Number(device.users || 0) / total * 100
      : 0;

    return `<div class="device-row">
      <span class="device-dot" style="background:${colors[index % colors.length]}"></span>
      <span>${esc(labels[device.name] || device.name)}</span>
      <strong>${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
    </div>`;
  }).join("");
}

function renderHours(hours) {
  const canvas = $("google-hours-chart");

  if (!canvas || !window.Chart) return;

  googleHoursChart?.destroy();

  const values = Array.from({ length: 24 }, (_, hour) => {
    const found = (hours || []).find(item => Number(item.hour) === hour);
    return found ? Number(found.sessions || 0) : 0;
  });

  googleHoursChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, (_, hour) => `${hour}h`),
      datasets: [{
        data: values,
        backgroundColor: values.map(() => "#8aaf9b"),
        borderRadius: 2,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx => `Sessões: ${formatNumber(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          display: false,
          beginAtZero: true
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            autoSkip: false,
            callback: (value, index) => index % 3 === 0 ? `${index}h` : "",
            maxRotation: 0
          }
        }
      }
    }
  });
}

function renderFunnel() {
  if (!googleData) return;

  const users = Number(googleData.users || 0);
  const clicks = Number(googleData.bookingClicks || 0);
  const periodLeads = leadsInPeriod(selectedPeriod).length;

  $("funnel-users").textContent = formatNumber(users);
  $("funnel-clicks").textContent = formatNumber(clicks);
  $("funnel-leads").textContent = formatNumber(periodLeads);

  const clickRate = users ? clicks / users * 100 : 0;
  const leadRate = users ? periodLeads / users * 100 : 0;

  $("funnel-clicks-rate-short").textContent = users
    ? `${clickRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : "—";

  $("funnel-leads-rate-short").textContent = users
    ? `${leadRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : "—";

  $("google-insight").textContent = users === 0
    ? "Ainda não há usuários registrados nesse período."
    : "Compare as páginas mais visitadas e os canais de origem com os cliques para agendamento e os leads registrados no CRM.";
}

async function loadGoogleMetrics() {
  if (!db || loadingGoogle) return;

  loadingGoogle = true;

  const button = $("refresh-google-button");

  if (button) button.disabled = true;

  $("google-data-message").textContent =
    "Consultando o Google Analytics...";

  try {
    const { data, error } = await db.functions.invoke(
      "google-analytics-metrics",
      {
        method: "GET",
        headers: {
          "x-report-days": String(selectedPeriod)
        }
      }
    );

    if (error) {
      let message = error.message || "Não foi possível chamar a função.";

      try {
        const response = error.context;

        if (response && typeof response.json === "function") {
          const body = await response.json();
          if (body?.error) message = body.error;
        }
      } catch (_) {}

      throw new Error(message);
    }

    if (!data || data.error) {
      throw new Error(data?.error || "A função não retornou dados.");
    }

    googleData = data;

    $("google-users").textContent = formatNumber(data.users);
    $("google-pageviews").textContent = formatNumber(data.pageViews);

    $("google-booking-clicks").textContent =
      data.bookingClicks == null ? "—" : formatNumber(data.bookingClicks);

    $("google-booking-note").textContent = data.bookingEventName
      ? `Evento GA4: ${data.bookingEventName}`
      : "Evento de agendamento não configurado.";

    const periodLabel = selectedPeriod === 90
      ? "3 meses"
      : `${selectedPeriod} dias`;

    $("google-users-note").textContent = periodLabel;
    $("google-pageviews-note").textContent = periodLabel;

    $("google-data-message").textContent =
      `Métricas atualizadas · ${data.period?.startDate || "início do período"} até ${data.period?.endDate || "ontem"}.`;

    renderGoogleTrend(data);
    renderFunnel();
    renderTopPages(data.topPages || []);
    renderTrafficSources(data.trafficSources || []);
    renderDevices(data.devices || []);
    renderHours(data.hours || []);
  } catch (e) {
    console.error("Erro ao carregar Google Analytics:", e);

    $("google-data-message").textContent =
      `Erro ao carregar métricas: ${e.message || "consulte os logs da função no Supabase"}`;
  } finally {
    loadingGoogle = false;
    if (button) button.disabled = false;
  }
}

/*
 * CORREÇÃO DOS PERÍODOS:
 * reconhece botões por data-period, data-days ou pelo texto visível;
 * destaca o período selecionado e solicita os dados novamente.
 */
function setupPeriodButtons() {
  const buttons = [
    ...document.querySelectorAll(
      "[data-period], [data-days], .google-period button, .google-period-short button"
    )
  ];

  function getDays(button) {
    const raw = button.dataset.period || button.dataset.days || "";

    if (["7", "30", "90"].includes(String(raw))) {
      return Number(raw);
    }

    const label = (button.textContent || "").trim().toLowerCase();

    if (label.includes("7")) return 7;
    if (label.includes("30")) return 30;
    if (label.includes("3") || label.includes("mes")) return 90;

    return null;
  }

  function updateSelectedPeriod() {
    buttons.forEach(button => {
      const isSelected = getDays(button) === selectedPeriod;

      button.setAttribute("aria-pressed", String(isSelected));
      button.classList.toggle("active", isSelected);
      button.classList.toggle("selected", isSelected);

      button.style.backgroundColor = isSelected ? "#805846" : "";
      button.style.color = isSelected ? "#ffffff" : "";
      button.style.borderColor = isSelected ? "#805846" : "";
    });
  }

  buttons.forEach(button => {
    if (button.dataset.periodListenerAttached === "true") return;

    button.dataset.periodListenerAttached = "true";

    button.addEventListener("click", async event => {
      event.preventDefault();

      const days = getDays(button);

      if (![7, 30, 90].includes(days)) return;

      selectedPeriod = days;

      updateSelectedPeriod();

      const periodSelect = $("google-period-select");

      if (periodSelect) {
        periodSelect.value = String(days);
      }

      renderFunnel();

      await loadGoogleMetrics();
    });
  });

  const periodSelect = $("google-period-select");

  if (periodSelect && periodSelect.dataset.periodListenerAttached !== "true") {
    periodSelect.dataset.periodListenerAttached = "true";

    periodSelect.addEventListener("change", async () => {
      const days = Number(periodSelect.value);

      if (![7, 30, 90].includes(days)) return;

      selectedPeriod = days;

      updateSelectedPeriod();

      renderFunnel();

      await loadGoogleMetrics();
    });
  }

  updateSelectedPeriod();
}

async function init() {
  if (!window.supabase) {
    showLogin("A biblioteca do Supabase não carregou. Confira a conexão.");
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  try {
    const {
      data: { session },
      error
    } = await db.auth.getSession();

    if (error) throw error;

    if (session) {
      showApp(session.user);
      await loadLeads();
    } else {
      showLogin();
    }
  } catch (e) {
    console.error("Erro ao verificar sessão:", e);

    showLogin(
      "Não foi possível verificar a sessão. Tente entrar novamente."
    );
  }

  db.auth.onAuthStateChange((event, session) => {
    if (session) {
      showApp(session.user);

      if (event !== "INITIAL_SESSION") loadLeads();
    } else {
      showLogin();
      leads = [];

      sourceChart?.destroy();
      sourceChart = null;

      statusChart?.destroy();
      statusChart = null;

      monthlyChart?.destroy();
      monthlyChart = null;

      googleTrendChart?.destroy();
      googleTrendChart = null;

      googleDeviceChart?.destroy();
      googleDeviceChart = null;

      googleHoursChart?.destroy();
      googleHoursChart = null;

      googleData = null;
    }
  });

  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();

    $("login-message").textContent = "Verificando...";

    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) {
      console.error("Erro no login:", error);

      $("login-message").textContent =
        "Não foi possível entrar. Confira o e-mail e a senha.";
    }
  });

  $("logout-button").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      alert("Não foi possível encerrar a sessão.");
    }
  });

  $("refresh-button").addEventListener("click", loadLeads);
  $("refresh-google-button").addEventListener("click", loadGoogleMetrics);

  $("search-input").addEventListener("input", renderLeads);
  $("status-filter").addEventListener("change", renderLeads);
  $("origin-filter").addEventListener("change", renderLeads);

  $("leads-table").addEventListener("click", async event => {
    const button = event.target.closest("[data-save-id]");

    if (!button) return;

    const id = Number(button.dataset.saveId);

    const select = document.querySelector(
      `[data-status-id="${id}"]`
    );

    if (!select) return;

    button.disabled = true;
    button.textContent = "Salvando...";

    const { error } = await db
      .from("leads")
      .update({ status: select.value })
      .eq("id", id);

    if (error) {
      console.error("Erro ao salvar status:", error);

      alert("Falha ao salvar. Verifique as permissões do Supabase.");

      button.disabled = false;
      button.textContent = "Salvar";
      return;
    }

    await loadLeads();
  });

  setupPeriodButtons();
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  init();
});
