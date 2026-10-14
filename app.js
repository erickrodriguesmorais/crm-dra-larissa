
const SUPABASE_URL = "https://bwhvfiklrvrodadbxoly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_R5xKqfJPBmp6PEsiRAvZ1w_IIypXVPZ";

let db = null;
let leads = [];
let sourceChart = null;
let statusChart = null;

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
  if (!window.Chart) {
    $("data-message").textContent =
      "Os dados foram carregados, mas a biblioteca dos gráficos não abriu.";
    return;
  }

  const sourceCanvas = $("source-chart");
  const statusCanvas = $("status-chart");

  if (!sourceCanvas || !statusCanvas) return;

  const sourceData = [
    leads.filter(lead => lead.origem === "site_principal").length,
    leads.filter(lead => lead.origem === "bio_instagram").length,
    leads.filter(lead =>
      lead.origem !== "site_principal" &&
      lead.origem !== "bio_instagram"
    ).length
  ];

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

  if (sourceChart) sourceChart.destroy();
  if (statusChart) statusChart.destroy();

  sourceChart = new Chart(sourceCanvas, {
    type: "doughnut",
    data: {
      labels: [
        "Site principal",
        "Bio do Instagram",
        "Outras origens"
      ],
      datasets: [{
        data: sourceData,
        backgroundColor: ["#284b63", "#8aaf9b", "#d9b779"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
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

  statusChart = new Chart(statusCanvas, {
    type: "bar",
    data: {
      labels: statusLabels,
      datasets: [{
        label: "Quantidade de leads",
        data: statusData,
        backgroundColor: [
          "#8aaf9b",
          "#d9b779",
          "#284b63",
          "#6f8f72",
          "#c17c74"
        ],
        borderRadius: 6,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0
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
  const originElement = $("origin-filter");
  const selectedOrigin = originElement ? originElement.value : "";

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
        const statuses = [
          "novo",
          "contatado",
          "agendado",
          "concluido",
          "perdido"
        ];

        const statusLabels = {
          novo: "Novo",
          contatado: "Contatado",
          agendado: "Agendado",
          concluido: "Concluído",
          perdido: "Perdido"
        };

        const options = statuses.map(status =>
          `<option value="${status}" ${
            lead.status === status ? "selected" : ""
          }>${statusLabels[status]}</option>`
        ).join("");

        const whatsappLink = wa(lead.whatsapp);

        const originLabel =
          lead.origem === "bio_instagram"
            ? "Bio Instagram"
            : lead.origem === "site_principal"
              ? "Site principal"
              : esc(lead.origem);

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
                data-save-id="${Number(lead.id)}">Salvar</button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="6" class="empty">
         Nenhum lead encontrado.
       </td></tr>`;
}

async function load() {
  $("data-message").textContent = "Carregando leads...";

  const { data, error } = await db
    .from("leads")
    .select("id,nome,whatsapp,origem,status,criado_em")
    .order("criado_em", { ascending: false });

  if (error) {
    $("data-message").textContent =
      "Não foi possível carregar os leads. Confira a conexão e as políticas de acesso do Supabase.";
    console.error("Erro ao carregar leads:", error);
    return;
  }

  leads = data || [];

  metrics();
  updateCharts();
  render();

  $("data-message").textContent =
    `Dados atualizados: ${leads.length} lead(s).`;
}

async function init() {
  if (!window.supabase) {
    showLogin("Não foi possível carregar a biblioteca do Supabase.");
    return;
  }

  if (!window.Chart) {
    console.warn("Chart.js ainda não está disponível.");
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const {
    data: { session },
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError) {
    showLogin("Não foi possível verificar sua sessão. Tente novamente.");
    console.error(sessionError);
    return;
  }

  if (session) {
    showApp(session.user);
    await load();
  } else {
    showLogin();
  }

  db.auth.onAuthStateChange((event, sessionAtual) => {
    if (sessionAtual) {
      showApp(sessionAtual.user);
      load();
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
      $("login-message").textContent =
        "Não foi possível entrar. Confira o e-mail e a senha.";
      console.error("Erro no login:", error);
    }
  });

  $("logout-button").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      console.error("Erro ao sair:", error);
      alert("Não foi possível encerrar a sessão. Tente novamente.");
    }
  });

  $("refresh-button").addEventListener("click", load);
  $("search-input").addEventListener("input", render);
  $("status-filter").addEventListener("change", render);

  if ($("origin-filter")) {
    $("origin-filter").addEventListener("change", render);
  }

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
      alert("Falha ao salvar o status. Confira as permissões do Supabase.");
      console.error("Erro ao atualizar status:", error);
      button.disabled = false;
      button.textContent = "Salvar";
      return;
    }

    await load();
  });
}

document.addEventListener("DOMContentLoaded", init);
