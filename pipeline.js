/* ============================================================
   THE TEACHER COACH LLC — PROCUREMENT PIPELINE
   Talks directly to Supabase (RLS restricts all access to
   authenticated users — see sql/rls_policies.sql).
============================================================= */

const STATUS_OPTIONS = ["WATCH", "UPCOMING", "OPEN", "CLOSED", "AWARDED", "EXPIRED", "CANCELLED"];
const PRIORITY_OPTIONS = ["A", "B", "C", "D"];

let state = {
  opportunities: [],   // flattened rows for table + filtering
  raw: {},              // id -> full supabase row (with joins) for the drawer
  organizations: [],
  fundingSources: [],
  services: [],
  sortKey: "close_date",
  sortDir: "asc",
  currentOppId: null,
};

const $ = (id) => document.getElementById(id);
const money = (n) => n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

window.addEventListener("auth-ready", init);

async function init() {
  wireStaticEvents();
  await loadReferenceData();
  await loadOpportunities();
}

/* ------------------------------------------------------------
   REFERENCE DATA (organizations, funding sources, services)
------------------------------------------------------------- */
async function loadReferenceData() {
  const [orgsRes, fundingRes, servicesRes] = await Promise.all([
    supabaseClient.from("organizations").select("id,name,organization_type,county").order("name"),
    supabaseClient.from("funding_sources").select("id,code,name").eq("active", true).order("name"),
    supabaseClient.from("service_offerings").select("id,service_code,service_name").eq("active", true).order("service_name"),
  ]);

  state.organizations = orgsRes.data || [];
  state.fundingSources = fundingRes.data || [];
  state.services = servicesRes.data || [];

  $("statDistrictCount").textContent = state.organizations.length;

  populateOrgSelects();
  populateFundingSelects();
  populateServiceCheckboxes();
  populateStatusPrioritySelects();
}

function populateOrgSelects() {
  const opts = state.organizations.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");
  $("newOppOrg").innerHTML = `<option value="">Select a district…</option>` + opts;
  $("detailIncumbent").innerHTML = `<option value="">None on file</option>` + opts;
  $("detailPrime").innerHTML = `<option value="">None on file</option>` + opts;
}

function populateFundingSelects() {
  const opts = state.fundingSources.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");
  $("filterFunding").innerHTML = `<option value="">All funding sources</option>` + opts;
  $("newOppFunding").innerHTML = `<option value="">Select funding source…</option>` + opts;
  $("detailFunding").innerHTML = `<option value="">Unspecified</option>` + opts;
}

function populateServiceCheckboxes() {
  const build = (containerId) => {
    $(containerId).innerHTML = state.services.map(s => `
      <label>
        <input type="checkbox" class="svc-checkbox" value="${s.id}" data-container="${containerId}" />
        ${escapeHtml(s.service_name)}
      </label>
    `).join("");
  };
  build("newOppServices");
  build("detailServices");
}

function populateStatusPrioritySelects() {
  $("detailStatus").innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${titleCase(s)}</option>`).join("");
  $("detailPriority").innerHTML = PRIORITY_OPTIONS.map(p => `<option value="${p}">Priority ${p}</option>`).join("");
}

/* ------------------------------------------------------------
   LOAD OPPORTUNITIES (with joins)
------------------------------------------------------------- */
async function loadOpportunities() {
  const { data, error } = await supabaseClient
    .from("procurement_opportunities")
    .select(`
      *,
      organizations!procurement_opportunities_organization_fk(id,name),
      funding_sources(id,name),
      incumbent:organizations!procurement_opportunities_incumbent_fk(id,name),
      prime:organizations!procurement_opportunities_prime_fk(id,name),
      opportunity_services(service_id, service_offerings(id,service_name)),
      contracts(id,end_date,status,contract_title,contract_value),
      opportunity_contacts(contact_id, procurement_contacts(id,first_name,last_name,title,email,phone))
    `)
    .order("close_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error(error);
    $("opportunityTableBody").innerHTML = `<tr><td colspan="9" class="pipeline-loading">Couldn't load the pipeline. ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  state.raw = {};
  state.opportunities = (data || []).map(row => {
    state.raw[row.id] = row;
    return {
      id: row.id,
      organization_name: row.organizations?.name || "Unassigned",
      opportunity_name: row.opportunity_name,
      status: row.status,
      priority: row.priority,
      match_score: row.match_score,
      estimated_value: row.estimated_value,
      funding_source: row.funding_sources?.name || "—",
      funding_source_id: row.funding_source_id,
      close_date: row.close_date,
      next_action: row.next_action,
      next_action_date: row.next_action_date,
    };
  });

  renderStats();
  renderTable();
}

/* ------------------------------------------------------------
   STATS
------------------------------------------------------------- */
function renderStats() {
  const opps = state.opportunities;
  const openLike = opps.filter(o => ["OPEN", "UPCOMING"].includes(o.status));
  const openValue = openLike.reduce((sum, o) => sum + (Number(o.estimated_value) || 0), 0);
  const closingSoon = openLike.filter(o => o.close_date && o.close_date >= todayISO() && o.close_date <= daysFromNow(30));
  const followupsDue = opps.filter(o => o.next_action_date && o.next_action_date <= todayISO());

  $("statOpenValue").textContent = money(openValue);
  $("statOpenCount").textContent = openLike.length;
  $("statClosingSoon").textContent = closingSoon.length;
  $("statFollowupsDue").textContent = followupsDue.length;
}

/* ------------------------------------------------------------
   TABLE RENDER + FILTER + SORT
------------------------------------------------------------- */
function getFilteredSorted() {
  const search = $("searchInput").value.trim().toLowerCase();
  const status = $("filterStatus").value;
  const priority = $("filterPriority").value;
  const funding = $("filterFunding").value;
  const followupOnly = $("filterFollowupsDue").checked;

  let rows = state.opportunities.filter(o => {
    if (search && !(`${o.organization_name} ${o.opportunity_name}`.toLowerCase().includes(search))) return false;
    if (status && o.status !== status) return false;
    if (priority && o.priority !== priority) return false;
    if (funding && o.funding_source_id !== funding) return false;
    if (followupOnly && !(o.next_action_date && o.next_action_date <= todayISO())) return false;
    return true;
  });

  const { sortKey, sortDir } = state;
  rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (av == null) av = "";
    if (bv == null) bv = "";
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderTable() {
  const rows = getFilteredSorted();
  const tbody = $("opportunityTableBody");
  const emptyState = $("emptyState");

  if (!rows.length) {
    tbody.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  tbody.innerHTML = rows.map(o => {
    const dueFollowup = o.next_action_date && o.next_action_date <= todayISO();
    return `
      <tr data-id="${o.id}">
        <td>${escapeHtml(o.organization_name)}</td>
        <td>${escapeHtml(o.opportunity_name)}</td>
        <td><span class="badge badge-${o.status.toLowerCase()}">${titleCase(o.status)}</span></td>
        <td><span class="priority-pill pri-${o.priority}">${o.priority}</span></td>
        <td>${matchBar(o.match_score)}</td>
        <td>${money(o.estimated_value)}</td>
        <td>${escapeHtml(o.funding_source)}</td>
        <td>${fmtDate(o.close_date)}</td>
        <td class="${dueFollowup ? "followup-due" : ""}">${o.next_action ? escapeHtml(o.next_action) : "—"}${o.next_action_date ? " · " + fmtDate(o.next_action_date) : ""}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => openDetail(tr.dataset.id));
  });
}

function matchBar(score) {
  if (score == null) return `<span class="drawer-readout" style="padding:0;background:none;color:#999;">—</span>`;
  return `
    <div class="match-bar-wrap">
      <div class="match-bar-track"><div class="match-bar-fill" style="width:${score}%"></div></div>
      <span class="match-bar-num">${score}</span>
    </div>
  `;
}

/* ------------------------------------------------------------
   DETAIL DRAWER
------------------------------------------------------------- */
async function openDetail(id) {
  const row = state.raw[id];
  if (!row) return;
  state.currentOppId = id;

  $("detailOrgName").textContent = row.organizations?.name || "Unassigned district";
  $("detailOppName").textContent = row.opportunity_name;
  $("detailStatus").value = row.status;
  $("detailPriority").value = row.priority;
  $("detailMatchScore").value = row.match_score ?? "";
  $("detailDescription").value = row.description || "";
  $("detailFunding").value = row.funding_source_id || "";
  $("detailCategory").value = row.category || "";
  $("detailValue").value = row.estimated_value ?? "";
  $("detailSolicitation").value = row.solicitation_number || "";
  $("detailOpenDate").value = row.open_date || "";
  $("detailCloseDate").value = row.close_date || "";
  $("detailProcurementUrl").value = row.procurement_url || row.source_url || "";
  $("detailIncumbent").value = row.incumbent_vendor_id || "";
  $("detailPrime").value = row.prime_vendor_id || "";
  $("detailNextAction").value = row.next_action || "";
  $("detailNextActionDate").value = row.next_action_date || "";
  $("detailNotes").value = row.notes || "";

  const selectedServiceIds = new Set((row.opportunity_services || []).map(s => s.service_id));
  document.querySelectorAll('#detailServices .svc-checkbox').forEach(cb => {
    cb.checked = selectedServiceIds.has(cb.value);
  });

  const contract = (row.contracts || [])[0];
  $("detailContract").innerHTML = contract
    ? `<strong>${escapeHtml(contract.contract_title)}</strong><br>Status: ${titleCase(contract.status)} · Expires ${fmtDate(contract.end_date)}${contract.contract_value ? " · " + money(contract.contract_value) : ""}`
    : "No contract on file for this opportunity.";

  renderContacts(row);
  await loadFollowups(id);

  $("detailOverlay").hidden = false;
  $("detailPanel").hidden = false;
}

function renderContacts(row) {
  const contacts = (row.opportunity_contacts || []).map(c => c.procurement_contacts).filter(Boolean);
  $("detailContacts").innerHTML = contacts.length
    ? contacts.map(c => `
        <div style="margin-bottom:0.5rem;">
          <strong>${escapeHtml(`${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unnamed contact")}</strong>
          ${c.title ? " · " + escapeHtml(c.title) : ""}<br>
          ${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : ""} ${c.phone ? " · " + escapeHtml(c.phone) : ""}
        </div>
      `).join("")
    : `<div style="color:var(--pl-text-muted);">No contact on file yet.</div>`;
}

async function loadFollowups(oppId) {
  const { data, error } = await supabaseClient
    .from("followups")
    .select("*")
    .eq("opportunity_id", oppId)
    .order("action_date", { ascending: false });

  const log = $("followupLog");
  if (error || !data || !data.length) {
    log.innerHTML = `<div style="color:var(--pl-text-muted);font-size:0.82rem;">No follow-ups logged yet.</div>`;
    return;
  }
  log.innerHTML = data.map(f => `
    <div class="followup-entry">
      ${escapeHtml(f.result || titleCase(f.action_type))}
      <div class="followup-entry-meta">${titleCase(f.action_type)} · ${fmtDate(f.action_date)}</div>
    </div>
  `).join("");
}

function closeDetail() {
  $("detailOverlay").hidden = true;
  $("detailPanel").hidden = true;
  state.currentOppId = null;
}

async function saveDetail() {
  const id = state.currentOppId;
  if (!id) return;

  const btn = $("saveDetailBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const update = {
    status: $("detailStatus").value,
    priority: $("detailPriority").value,
    match_score: numOrNull($("detailMatchScore").value),
    description: $("detailDescription").value || null,
    funding_source_id: $("detailFunding").value || null,
    category: $("detailCategory").value || null,
    estimated_value: numOrNull($("detailValue").value),
    solicitation_number: $("detailSolicitation").value || null,
    open_date: $("detailOpenDate").value || null,
    close_date: $("detailCloseDate").value || null,
    procurement_url: $("detailProcurementUrl").value || null,
    incumbent_vendor_id: $("detailIncumbent").value || null,
    prime_vendor_id: $("detailPrime").value || null,
    next_action: $("detailNextAction").value || null,
    next_action_date: $("detailNextActionDate").value || null,
    notes: $("detailNotes").value || null,
  };

  const { error: updateError } = await supabaseClient.from("procurement_opportunities").update(update).eq("id", id);

  // Sync recommended service package
  const checked = Array.from(document.querySelectorAll('#detailServices .svc-checkbox:checked')).map(cb => cb.value);
  const existing = (state.raw[id].opportunity_services || []).map(s => s.service_id);
  const toAdd = checked.filter(s => !existing.includes(s));
  const toRemove = existing.filter(s => !checked.includes(s));

  if (toAdd.length) {
    await supabaseClient.from("opportunity_services").insert(toAdd.map(service_id => ({ opportunity_id: id, service_id })));
  }
  if (toRemove.length) {
    await supabaseClient.from("opportunity_services").delete().eq("opportunity_id", id).in("service_id", toRemove);
  }

  btn.disabled = false;
  btn.textContent = "Save Changes";

  if (updateError) {
    alert("Couldn't save changes: " + updateError.message);
    return;
  }

  closeDetail();
  await loadOpportunities();
}

async function deleteOpportunity() {
  const id = state.currentOppId;
  if (!id) return;
  if (!confirm("Delete this opportunity? This can't be undone.")) return;

  const { error } = await supabaseClient.from("procurement_opportunities").delete().eq("id", id);
  if (error) { alert("Couldn't delete: " + error.message); return; }

  closeDetail();
  await loadOpportunities();
}

async function addFollowup() {
  const id = state.currentOppId;
  if (!id) return;

  const action_type = $("followupActionType").value;
  const result = $("followupResult").value.trim();
  if (!result) { $("followupResult").focus(); return; }

  const { error } = await supabaseClient.from("followups").insert({
    opportunity_id: id,
    action_type,
    result,
    action_date: todayISO(),
  });

  if (error) { alert("Couldn't log follow-up: " + error.message); return; }

  $("followupResult").value = "";
  await loadFollowups(id);
}

/* ------------------------------------------------------------
   ADD CONTACT
------------------------------------------------------------- */
function openNewContact() {
  $("newContactForm").reset();
  $("newContactOverlay").hidden = false;
  $("newContactModal").hidden = false;
}
function closeNewContact() {
  $("newContactOverlay").hidden = true;
  $("newContactModal").hidden = true;
}
async function submitNewContact(e) {
  e.preventDefault();
  const oppId = state.currentOppId;
  const row = state.raw[oppId];
  if (!oppId || !row) return;

  const { data: contact, error: contactErr } = await supabaseClient.from("procurement_contacts").insert({
    organization_id: row.organization_id,
    first_name: $("contactFirstName").value || null,
    last_name: $("contactLastName").value || null,
    title: $("contactTitle").value || null,
    email: $("contactEmail").value || null,
    phone: $("contactPhone").value || null,
  }).select().single();

  if (contactErr) { alert("Couldn't add contact: " + contactErr.message); return; }

  const { error: linkErr } = await supabaseClient.from("opportunity_contacts").insert({
    opportunity_id: oppId,
    contact_id: contact.id,
    primary_contact: !(row.opportunity_contacts || []).length,
  });
  if (linkErr) { alert("Couldn't link contact: " + linkErr.message); return; }

  closeNewContact();
  await loadOpportunities();
  await openDetail(oppId); // refresh drawer with new contact
}

/* ------------------------------------------------------------
   NEW OPPORTUNITY
------------------------------------------------------------- */
function openNewOpportunity() {
  $("newOppForm").reset();
  $("newOrgFields").hidden = true;
  $("newOppError").hidden = true;
  $("newOppOverlay").hidden = false;
  $("newOppModal").hidden = false;
}
function closeNewOpportunity() {
  $("newOppOverlay").hidden = true;
  $("newOppModal").hidden = true;
}

async function submitNewOpportunity(e) {
  e.preventDefault();
  const errorEl = $("newOppError");
  errorEl.hidden = true;

  const submitBtn = $("newOppSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating…";

  try {
    let orgId = $("newOppOrg").value;
    const usingNewOrg = !$("newOrgFields").hidden;

    if (usingNewOrg) {
      const name = $("newOrgName").value.trim();
      if (!name) throw new Error("Enter a district name.");
      const { data: newOrg, error: orgErr } = await supabaseClient.from("organizations").insert({
        name,
        county: $("newOrgCounty").value || null,
        organization_type: "LEA",
        state: "TN",
      }).select().single();
      if (orgErr) throw new Error(orgErr.message);
      orgId = newOrg.id;
    }

    if (!orgId) throw new Error("Select or create a district.");

    const oppName = $("newOppName").value.trim();
    if (!oppName) throw new Error("Enter an opportunity name.");

    const { data: newOpp, error: oppErr } = await supabaseClient.from("procurement_opportunities").insert({
      organization_id: orgId,
      funding_source_id: $("newOppFunding").value || null,
      opportunity_name: oppName,
      description: $("newOppDescription").value || null,
      status: $("newOppStatus").value,
      priority: $("newOppPriority").value,
      match_score: numOrNull($("newOppMatchScore").value),
      estimated_value: numOrNull($("newOppValue").value),
      close_date: $("newOppCloseDate").value || null,
      procurement_url: $("newOppUrl").value || null,
      next_action: $("newOppNextAction").value || null,
      next_action_date: $("newOppNextActionDate").value || null,
    }).select().single();

    if (oppErr) throw new Error(oppErr.message);

    const checked = Array.from(document.querySelectorAll('#newOppServices .svc-checkbox:checked')).map(cb => cb.value);
    if (checked.length) {
      await supabaseClient.from("opportunity_services").insert(checked.map(service_id => ({ opportunity_id: newOpp.id, service_id })));
    }

    closeNewOpportunity();
    if (usingNewOrg) await loadReferenceData();
    await loadOpportunities();

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Opportunity";
  }
}

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------- */
function numOrNull(v) { return v === "" || v == null ? null : Number(v); }
function titleCase(s) { return (s || "").toLowerCase().replace(/(^|_)(\w)/g, (m, p1, p2) => (p1 === "_" ? " " : "") + p2.toUpperCase()); }
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ------------------------------------------------------------
   EVENT WIRING
------------------------------------------------------------- */
function wireStaticEvents() {
  $("searchInput").addEventListener("input", renderTable);
  $("filterStatus").addEventListener("change", renderTable);
  $("filterPriority").addEventListener("change", renderTable);
  $("filterFunding").addEventListener("change", renderTable);
  $("filterFollowupsDue").addEventListener("change", renderTable);

  document.querySelectorAll('#opportunityTable thead th[data-sort]').forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      renderTable();
    });
  });

  $("closeDetailBtn").addEventListener("click", closeDetail);
  $("detailOverlay").addEventListener("click", closeDetail);
  $("saveDetailBtn").addEventListener("click", saveDetail);
  $("deleteOppBtn").addEventListener("click", deleteOpportunity);
  $("addFollowupBtn").addEventListener("click", addFollowup);

  $("addContactBtn").addEventListener("click", openNewContact);
  $("closeNewContactBtn").addEventListener("click", closeNewContact);
  $("newContactOverlay").addEventListener("click", closeNewContact);
  $("newContactForm").addEventListener("submit", submitNewContact);

  $("newOpportunityBtn").addEventListener("click", openNewOpportunity);
  $("closeNewOppBtn").addEventListener("click", closeNewOpportunity);
  $("newOppOverlay").addEventListener("click", closeNewOpportunity);
  $("newOppForm").addEventListener("submit", submitNewOpportunity);
  $("newOrgToggleBtn").addEventListener("click", () => {
    $("newOrgFields").hidden = !$("newOrgFields").hidden;
    if (!$("newOrgFields").hidden) $("newOppOrg").value = "";
  });
}
