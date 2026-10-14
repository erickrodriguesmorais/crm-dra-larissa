
const SUPABASE_URL = "https://bwhvfiklrvrodadbxoly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_R5xKqfJPBmp6PEsiRAvZ1w_IIypXVPZ";

let db = null;
let leads = [];
let sourceChart = null;
let statusChart = null;
let monthlyChart = null;
let loading = false;

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

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

function date(value) {
  if (!value) return "—";

  const parsed = new Date(value);

  return isNaN(parsed)
    ? "—"
    : parsed.toLocaleString("pt-BR", {
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

function metrics() {
  $("total-leads").textContent = leads.length;

  $("site-leads").textContent =
    leads.filter(lead => lead.origem === "site_principal").length;

  $("bio-leads").textContent =
    leads.filter(lead => lead.origem === "bio_instagram").length;

  $("scheduled-leads").textContent =
    leads.filter(lead => lead.status === "agendado").length;
}

function updateCharts() {
  const sourceCanvas = $("source-chart");
  const statusCanvas = $("status-chart");
  const monthlyCanvas = $("monthly-chart");

  
  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }

  if (monthlyCanvas) {
    const today = new Date();
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(
        today.getFullYear(),
        today.getMonth() - i,
        1
      );

      months.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth(),
        label: monthDate.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit"
        })
      });
    }

    const monthlyData = months.map(item =>
      leads.filter(lead => {
        if (!lead.criado_em) return false;

        const createdAt = new Date(lead.criado_em);

        return (
          !isNaN(createdAt.getTime()) &&
          createdAt.getFullYear() === item.year &&
          createdAt.getMonth() === item.month
        );
      }).length
    );

    monthlyChart = new window.Chart(monthlyCanvas, {
      type: "line",
      data: {
        labels: months.map(item => item.label),
        datasets: [{
          label: "Leads recebidos",
          data: monthlyData,
          borderColor: "#805846",
          backgroundColor: "rgba(128, 88, 70, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
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
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.raw} lead(s)`;
              }
            }
          }
        }
      }
    });
  }


  

  if (!sourceCanvas || !statusCanvas) {
    console.error("Os elementos canvas dos gráficos não foram encontrados.");
    $("data-message").textContent =
      "Os espaços dos gráficos não foram encontrados no HTML.";
    return;
  }

  if (typeof window.Chart === "undefined") {
    console.error("Chart.js não foi carregado.");
    $("data-message").textContent =
      "Os leads foram carregados, mas os gráficos não abriram. Verifique a conexão com a biblioteca de gráficos.";
    return;
  }

  if (sourceChart) {
    sourceChart.destroy();
    sourceChart = null;
  }

  if (statusChart) {
    statusChart.destroy();
    statusChart = null;
  }

  const sourceData = [
    leads.filter(lead => lead.origem === "site_principal").length,
    leads.filter(lead => lead.origem === "bio_instagram").length,
    leads.filter(lead =>
      lead.origem !== "site_principal" &&
      lead.origem !== "bio_instagram"
    ).length
  ];

  sourceChart = new window.Chart(sourceCanvas, {
    type: "doughnut",
    data: {
      labels: ["Site principal", "Bio do Instagram", "Outras origens"],
      datasets: [{
        data: sourceData,
        backgroundColor: ["#805846", "#8aaf9b", "#d9b779"],
        borderColor: "#fffdfa",
        borderWidth: 3,
        hoverOffset: 7
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
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${context.raw} lead(s)`;
            }
          }
        }
      }
    }
  });

  const statusKeys = [
    "novo",
    "contatado",
    "agendado",
    "concluido",
    "perdido"
  ];

  const statusLabels = [
    "Novo",
    "Contatado",
    "Agendado",
    "Concluído",
    "Perdido"
  ];

  const statusData = statusKeys.map(status =>
    leads.filter(lead => lead.status === status).length
  );

  statusChart = new window.Chart(statusCanvas, {
    type: "bar",
    data: {
      labels: statusLabels,
      datasets: [{
        label: "Quantidade de leads",
        data: statusData,
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
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.raw} lead(s)`;
            }
          }
        }
      }
    }
  });
}

function render() {
  const query = $("search-input").value.trim().toLowerCase();
  const selectedStatus = $("status-filter").value;
  const selectedOrigin = $("origin-filter")?.value || "";

  const rows = leads.filter(lead => {
    const matchesSearch =
      `${lead.nome || ""} ${lead.whatsapp || ""}`
        .toLowerCase()
        .includes(query);

    const matchesStatus =
      !selectedStatus || lead.status === selectedStatus;

    const matchesOrigin =
      !selectedOrigin || lead.origem === selectedOrigin;

    return matchesSearch && matchesStatus && matchesOrigin;
  });

  $("leads-table").innerHTML = rows.length
    ? rows.map(lead => {
        const statusOptions = [
          ["novo", "Novo"],
          ["contatado", "Contatado"],
          ["agendado", "Agendado"],
          ["concluido", "Concluído"],
          ["perdido", "Perdido"]
        ];

        const options = statusOptions.map(([value, label]) =>
          `<option value="${value}" ${
            lead.status === value ? "selected" : ""
          }>${label}</option>`
        ).join("");

        const whatsappLink = wa(lead.whatsapp);

        let originLabel = esc(lead.origem);

        if (lead.origem === "site_principal") {
          originLabel = "Site principal";
        } else if (lead.origem === "bio_instagram") {
          originLabel = "Bio Instagram";
        }

        return `
          <tr>
            <td>${esc(lead.nome)}</td>
            <td>
              ${
                whatsappLink
                  ? `<a class="whatsapp-link"
                       href="${whatsappLink}"
                       target="_blank"
                       rel="noopener">${esc(lead.whatsapp)}</a>`
                  : esc(lead.whatsapp)
              }
            </td>
            <td>${originLabel}</td>
            <td>
              <select class="status-select"
                data-status-id="${Number(lead.id)}">
                ${options}
              </select>
            </td>
            <td>${date(lead.criado_em)}</td>
            <td>
              <button class="action-button"
                data-save-id="${Number(lead.id)}"
                type="button">Salvar</button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="6" class="empty">Nenhum lead encontrado.</td></tr>`;
}

async function load() {
  if (!db || loading) return;

  loading = true;
  $("data-message").textContent = "Carregando leads...";

  try {
    const { data, error } = await db
      .from("leads")
      .select("id,nome,whatsapp,origem,status,criado_em")
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao carregar leads:", error);
      $("data-message").textContent =
        "Não foi possível carregar os leads. Confira as permissões do Supabase.";
      return;
    }

    leads = data || [];

    metrics();
    render();
    updateCharts();

    if (typeof window.Chart !== "undefined") {
      $("data-message").textContent =
        `Dados atualizados: ${leads.length} lead(s).`;
    }
  } catch (error) {
    console.error("Erro inesperado ao carregar dados:", error);
    $("data-message").textContent =
      "Ocorreu um erro ao carregar os dados. Atualize a página e tente novamente.";
  } finally {
    loading = false;
  }
}

async function init() {
  if (!window.supabase) {
    showLogin("Não foi possível carregar a biblioteca do Supabase.");
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
      await load();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error("Erro ao verificar sessão:", error);
    showLogin("Não foi possível verificar a sessão. Tente entrar novamente.");
  }

  db.auth.onAuthStateChange((event, session) => {
    if (session) {
      showApp(session.user);
      if (event !== "INITIAL_SESSION") {
        load();
      }
    } else {
      showLogin();
      leads = [];

      if (sourceChart) {
        sourceChart.destroy();
        sourceChart = null;
      }

      if (statusChart) {
        statusChart.destroy();
        statusChart = null;
      }
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
      console.error("Erro ao sair:", error);
      alert("Não foi possível encerrar a sessão.");
    }
  });

  $("refresh-button").addEventListener("click", load);
  $("search-input").addEventListener("input", render);
  $("status-filter").addEventListener("change", render);
  $("origin-filter").addEventListener("change", render);

  $("leads-table").addEventListener("click", async event => {
    const button = event.target.closest("[data-save-id]");
    if (!button) return;

    const id = Number(button.dataset.saveId);
    const select = document.querySelector(`[data-status-id="${id}"]`);

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

    await load();
  });
}

document.addEventListener("DOMContentLoaded", init);
