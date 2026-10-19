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
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
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
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach(s => s.classList.toggle("hidden", s.id !== tabId));
  const google = tabId === "google-view";
  $("page-title").textContent = google ? "Métricas do Google" : "Leads do site";
  $("page-description").textContent = google
    ? "Acompanhe os resultados de acesso e navegação do site."
    : "Acompanhe os contatos e os resultados dos canais digitais.";
  if (google && db) loadGoogleMetrics();
  if (!google) [sourceChart, statusChart, monthlyChart].forEach(chart => chart?.resize());
}
function setupTabs() {
  document.querySelectorAll(".nav-tab").forEach(b => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));
}
function formatNumber(v) { return Number(v ?? 0).toLocaleString("pt-BR"); }
function date(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function wa(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits) : "";
}
function updateLeadMetrics() {
  $("total-leads").textContent = leads.length;
  $("site-leads").textContent = leads.filter(x => x.origem === "site_principal").length;
  $("bio-leads").textContent = leads.filter(x => x.origem === "bio_instagram").length;
  $("scheduled-leads").textContent = leads.filter(x => x.status === "agendado").length;
}
function updateCharts() {
  if (typeof window.Chart === "undefined") {
    $("data-message").textContent = "Leads carregados, mas a biblioteca dos gráficos não foi carregada.";
    return;
  }
  const sc = $("source-chart"), stc = $("status-chart"), mc = $("monthly-chart");
  if (!sc || !stc || !mc) return;
  sourceChart?.destroy(); statusChart?.destroy(); monthlyChart?.destroy();
  sourceChart = new Chart(sc, {
    type: "doughnut",
    data: { labels: ["Site principal", "Bio do Instagram", "Outras origens"], datasets: [{
      data: [leads.filter(x => x.origem === "site_principal").length, leads.filter(x => x.origem === "bio_instagram").length,
        leads.filter(x => !["site_principal", "bio_instagram"].includes(x.origem)).length],
      backgroundColor: ["#805846", "#8aaf9b", "#d9b779"], borderColor: "#fffdfa", borderWidth: 3
    }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { padding: 18, usePointStyle: true } } } }
  });
  const keys = ["novo", "contatado", "agendado", "concluido", "perdido"];
  statusChart = new Chart(stc, {
    type: "bar",
    data: { labels: ["Novo", "Contatado", "Agendado", "Concluído", "Perdido"], datasets: [{
      label: "Quantidade de leads", data: keys.map(s => leads.filter(x => x.status === s).length),
      backgroundColor: ["#8aaf9b", "#d9b779", "#805846", "#6f8f72", "#c17c74"], borderRadius: 6, maxBarThickness: 42
    }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 } }, y: { grid: { display: false } } },
      plugins: { legend: { display: false } } }
  });
  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) });
  }
  monthlyChart = new Chart(mc, {
    type: "line",
    data: { labels: months.map(m => m.label), datasets: [{
      label: "Leads recebidos",
      data: months.map(m => leads.filter(l => { const d = l.criado_em ? new Date(l.criado_em) : null; return d && !Number.isNaN(d.getTime()) && d.getFullYear() === m.year && d.getMonth() === m.month; }).length),
      borderColor: "#805846", backgroundColor: "rgba(128,88,70,.15)", fill: true, tension: .3, pointRadius: 4
    }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 } } }, plugins: { legend: { display: false } } }
  });
}
function renderLeads() {
  const q = $("search-input").value.trim().toLowerCase(), status = $("status-filter").value, origin = $("origin-filter").value;
  const rows = leads.filter(l => `${l.nome || ""} ${l.whatsapp || ""}`.toLowerCase().includes(q) &&
    (!status || l.status === status) && (!origin || l.origem === origin));
  $("leads-table").innerHTML = rows.length ? rows.map(l => {
    const options = [["novo","Novo"],["contatado","Contatado"],["agendado","Agendado"],["concluido","Concluído"],["perdido","Perdido"]]
      .map(([v, label]) => `<option value="${v}" ${l.status === v ? "selected" : ""}>${label}</option>`).join("");
    const link = wa(l.whatsapp);
    const originLabel = l.origem === "site_principal" ? "Site principal" : l.origem === "bio_instagram" ? "Bio Instagram" : esc(l.origem);
    return `<tr><td>${esc(l.nome)}</td><td>${link ? `<a class="whatsapp-link" href="${link}" target="_blank" rel="noopener">${esc(l.whatsapp)}</a>` : esc(l.whatsapp)}</td>
      <td>${originLabel}</td><td><select class="status-select" data-status-id="${Number(l.id)}">${options}</select></td><td>${date(l.criado_em)}</td>
      <td><button class="action-button" data-save-id="${Number(l.id)}" type="button">Salvar</button></td></tr>`;
  }).join("") : '<tr><td colspan="6" class="empty">Nenhum lead encontrado.</td></tr>';
}
async function loadLeads() {
  if (!db || loadingLeads) return;
  loadingLeads = true; $("data-message").textContent = "Carregando leads...";
  try {
    const { data, error } = await db.from("leads").select("id,nome,whatsapp,origem,status,criado_em").order("criado_em", { ascending: false });
    if (error) throw error;
    leads = data || []; updateLeadMetrics(); renderLeads(); updateCharts(); if (googleData) renderFunnel();
    $("data-message").textContent = `Dados atualizados: ${leads.length} lead(s).`;
  } catch (e) {
    console.error("Erro ao carregar leads:", e);
    $("data-message").textContent = "Não foi possível carregar os leads. Confira as permissões do Supabase.";
  } finally { loadingLeads = false; }
}
function leadsInPeriod(days) {
  const end = new Date(); end.setHours(0,0,0,0);
  const start = new Date(end); start.setDate(start.getDate() - days);
  return leads.filter(l => { const d = new Date(l.criado_em); return !Number.isNaN(d.getTime()) && d >= start && d <= end; });
}
function renderGoogleTrend(data) {
  const canvas=$("google-trend-chart"); if(!canvas||!window.Chart)return;
  googleTrendChart?.destroy();
  const series=data.daily||[];
  googleTrendChart=new Chart(canvas,{type:"line",data:{labels:series.map(x=>x.dateLabel),datasets:[
    {label:"Usuários",data:series.map(x=>x.users),borderColor:"#8aaf9b",backgroundColor:"rgba(138,175,155,.12)",tension:.3,pointRadius:series.length>40?0:2},
    {label:"Visualizações",data:series.map(x=>x.pageViews),borderColor:"#cfae98",backgroundColor:"rgba(207,174,152,.08)",tension:.3,pointRadius:series.length>40?0:2},
    {label:"Cliques agendamento",data:series.map(x=>x.bookingClicks),borderColor:"#df8eae",backgroundColor:"rgba(223,142,174,.08)",tension:.3,pointRadius:series.length>40?0:2}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:9,padding:12}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`}}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{maxTicksLimit:7,maxRotation:0}}}}});
}
function renderTopPages(pages) {
  const el=$("google-top-pages"); if(!el)return;
  if(!pages?.length){el.innerHTML='<p class="muted">O GA4 não retornou dados de páginas para este período.</p>';return;}
  const max=Math.max(...pages.map(x=>Number(x.views)||0),1);
  el.innerHTML=pages.slice(0,5).map((p,i)=>`<div class="ranked-row"><span class="rank-number">${i+1}</span><span class="rank-name" title="${esc(p.title||p.path)}">${esc(p.title||p.path||"Página sem título")}<small>${esc(p.path||"")}</small></span><strong>${formatNumber(p.views)}</strong><span class="rank-track"><i style="width:${Math.max(2,Number(p.views||0)/max*100)}%"></i></span></div>`).join("");
}
function renderTrafficSources(sources) {
  const el=$("google-traffic-sources"); if(!el)return;
  if(!sources?.length){el.innerHTML='<p class="muted">O GA4 não retornou origens para este período.</p>';return;}
  const total=sources.reduce((s,x)=>s+Number(x.users||0),0)||1;
  const icons={"Organic Search":"G","Organic Social":"◎","Direct":"↗","Referral":"↗","Paid Search":"$","Email":"✉"};
  el.innerHTML=sources.slice(0,5).map(s=>{const name=s.name||"Outros",pct=Number(s.users||0)/total*100;return `<div class="source-row"><span class="source-mark">${esc(icons[name]||"•")}</span><span class="source-name">${esc(name)}</span><strong>${pct.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</strong><span class="source-track"><i style="width:${Math.max(2,pct)}%"></i></span></div>`;}).join("");
}
function renderDevices(devices) {
  const el=$("google-devices"); if(!el)return;
  const labels={"mobile":"Celular","desktop":"Computador","tablet":"Tablet"}, colors=["#8aaf9b","#cfae98","#df8eae"];
  if(!devices?.length){el.innerHTML='<p class="muted">O GA4 não retornou dados de dispositivos para este período.</p>';return;}
  const total=devices.reduce((s,x)=>s+Number(x.users||0),0);
  $("google-device-total").textContent=formatNumber(total); googleDeviceChart?.destroy();
  googleDeviceChart=new Chart($("google-device-chart"),{type:"doughnut",data:{labels:devices.map(d=>labels[d.name]||d.name),datasets:[{data:devices.map(d=>d.users),backgroundColor:devices.map((_,i)=>colors[i%colors.length]),borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${formatNumber(ctx.parsed)} usuários`}}}}});
  el.innerHTML=devices.map((d,i)=>{const pct=total?Number(d.users||0)/total*100:0;return `<div class="device-row"><span class="device-dot" style="background:${colors[i%colors.length]}"></span><span>${esc(labels[d.name]||d.name)}</span><strong>${pct.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</strong></div>`;}).join("");
}
function renderHours(hours) {
  const canvas=$("google-hours-chart"); if(!canvas||!window.Chart)return;
  googleHoursChart?.destroy();
  const values=Array.from({length:24},(_,h)=>{const found=(hours||[]).find(x=>Number(x.hour)===h);return found?Number(found.sessions||0):0;});
  googleHoursChart=new Chart(canvas,{type:"bar",data:{labels:Array.from({length:24},(_,h)=>`${h}h`),datasets:[{data:values,backgroundColor:values.map(() => "#8aaf9b"),borderRadius:2,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`Sessões: ${formatNumber(ctx.parsed.y)}`}}},scales:{y:{display:false,beginAtZero:true},x:{grid:{display:false},ticks:{autoSkip:false,callback:(value,index)=>index%3===0?`${index}h`:"",maxRotation:0}}}}});
}
function renderFunnel() {
  if(!googleData)return;
  const users=Number(googleData.users||0),clicks=Number(googleData.bookingClicks||0),periodLeads=leadsInPeriod(selectedPeriod).length;
  $("funnel-users").textContent=formatNumber(users); $("funnel-clicks").textContent=formatNumber(clicks); $("funnel-leads").textContent=formatNumber(periodLeads);
  const clickRate=users?clicks/users*100:0,leadRate=users?periodLeads/users*100:0;
  $("funnel-clicks-rate-short").textContent=users?`${clickRate.toLocaleString("pt-BR",{maximumFractionDigits:1})}%`:"—";
  $("funnel-leads-rate-short").textContent=users?`${leadRate.toLocaleString("pt-BR",{maximumFractionDigits:1})}%`:"—";
  $("google-insight").textContent=users===0?"Ainda não há usuários registrados nesse período.":"Compare as páginas mais visitadas e os canais de origem com os cliques para agendamento e os leads registrados no CRM.";
}
async function loadGoogleMetrics() {
  if (!db || loadingGoogle) return;
  loadingGoogle = true; const button = $("refresh-google-button"); if (button) button.disabled = true;
  $("google-data-message").textContent = "Consultando o Google Analytics...";
  try {
    const { data, error } = await db.functions.invoke("google-analytics-metrics", { method:"GET", headers:{"x-report-days":String(selectedPeriod)} });
    if (error) { let message=error.message||"Não foi possível chamar a função."; try { const r=error.context; if(r&&typeof r.json==="function"){const body=await r.json();if(body?.error)message=body.error;} } catch(_){} throw new Error(message); }
    if (!data || data.error) throw new Error(data?.error||"A função não retornou dados.");
    googleData=data;
    $("google-users").textContent=formatNumber(data.users); $("google-pageviews").textContent=formatNumber(data.pageViews);
    $("google-booking-clicks").textContent=data.bookingClicks==null?"—":formatNumber(data.bookingClicks);
    $("google-booking-note").textContent=data.bookingEventName?`Evento GA4: ${data.bookingEventName}`:"Evento de agendamento não configurado.";
    const periodLabel=selectedPeriod===90?"3 meses":`${selectedPeriod} dias`;
    $("google-users-note").textContent=periodLabel; $("google-pageviews-note").textContent=periodLabel;
    $("google-data-message").textContent=`Métricas atualizadas · ${data.period?.startDate||"início do período"} até ${data.period?.endDate||"ontem"}.`;
    renderGoogleTrend(data); renderFunnel(); renderTopPages(data.topPages||[]); renderTrafficSources(data.trafficSources||[]); renderDevices(data.devices||[]); renderHours(data.hours||[]);
  } catch(e) { console.error("Erro ao carregar Google Analytics:",e); $("google-data-message").textContent=`Erro ao carregar métricas: ${e.message||"consulte os logs da função no Supabase"}`; }
  finally { loadingGoogle=false; if(button)button.disabled=false; }
}
async function init() {
  if (!window.supabase) { showLogin("A biblioteca do Supabase não carregou. Confira a conexão."); return; }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  try {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (session) { showApp(session.user); await loadLeads(); } else showLogin();
  } catch (e) {
    console.error("Erro ao verificar sessão:", e);
    showLogin("Não foi possível verificar a sessão. Tente entrar novamente.");
  }
  db.auth.onAuthStateChange((event, session) => {
    if (session) { showApp(session.user); if (event !== "INITIAL_SESSION") loadLeads(); }
    else {
      showLogin(); leads = [];
      sourceChart?.destroy(); sourceChart = null; statusChart?.destroy(); statusChart = null; monthlyChart?.destroy(); monthlyChart = null; googleTrendChart?.destroy(); googleTrendChart = null; googleData = null;
    }
  });
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault(); $("login-message").textContent = "Verificando...";
    const { error } = await db.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) { console.error("Erro no login:", error); $("login-message").textContent = "Não foi possível entrar. Confira o e-mail e a senha."; }
  });
  $("logout-button").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();
    if (error) alert("Não foi possível encerrar a sessão.");
  });
  $("refresh-button").addEventListener("click", loadLeads);
$("refresh-google-button").addEventListener("click", loadGoogleMetrics);
setupPeriodButtons();
 
function setupPeriodButtons() {
  const buttons = [...document.querySelectorAll("[data-period]")];

  function updateSelectedPeriod() {
    buttons.forEach(button => {
      const isSelected =
        Number(button.dataset.period) === selectedPeriod;

      button.setAttribute("aria-pressed", String(isSelected));
      button.classList.toggle("active", isSelected);
    });
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const days = Number(button.dataset.period);

      if (![7, 30, 90].includes(days)) return;

      selectedPeriod = days;
      updateSelectedPeriod();

      if (googleData) {
        renderGoogleTrend(googleData);
      }

      loadGoogleMetrics();
    });
  });

  updateSelectedPeriod();
}

  $("search-input").addEventListener("input", renderLeads);
  $("status-filter").addEventListener("change", renderLeads);
  $("origin-filter").addEventListener("change", renderLeads);
  $("leads-table").addEventListener("click", async event => {
    const button = event.target.closest("[data-save-id]");
    if (!button) return;
    const id = Number(button.dataset.saveId), select = document.querySelector(`[data-status-id="${id}"]`);
    if (!select) return;
    button.disabled = true; button.textContent = "Salvando...";
    const { error } = await db.from("leads").update({ status: select.value }).eq("id", id);
    if (error) { console.error("Erro ao salvar status:", error); alert("Falha ao salvar. Verifique as permissões do Supabase."); button.disabled = false; button.textContent = "Salvar"; return; }
    await loadLeads();
  });
}
document.addEventListener("DOMContentLoaded", () => { setupTabs(); init(); });
