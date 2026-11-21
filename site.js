const REVIEWS_URL = "https://upiadmvxzphegivqszvp.supabase.co/rest/v1/reviews?select=rating,body,account_name&order=created_at.desc&limit=6";
const SUPABASE_ANON_KEY = "sb_publishable_iS9do7OPQuY-zEeAFfSrWQ_zA_IAObI";

const SHOTS = {
  chat: ["A chat with Jyson planning a 250 euro weekend in Riga.", "Ask anything. Answers are formatted, and you can copy, rename, export or delete a chat."],
  activity: ["The activity list open over a chat, showing recent commands and a photo from the phone.", "Commands you gave by voice, typing or phone, with what happened. Run one again with one click."],
  files: ["The Files page with photos and documents received from the phone.", "Files from your phone land here, not on your Desktop. Search, filter and open them."],
  notes: ["The Notes page with a pinned note, open notes and a finished one.", "Notes you or Jyson saved. Pin, tick off, copy or delete them."],
};
document.querySelectorAll(".tour-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tour-tab").forEach((t) => {
    t.classList.toggle("active", t === tab);
    t.setAttribute("aria-selected", String(t === tab));
  });
  const [alt, cap] = SHOTS[tab.dataset.shot];
  const img = document.getElementById("tourImg");
  img.src = `img/app-${tab.dataset.shot}.png`;
  document.getElementById("tourLink").href = img.src;
  img.alt = alt;
  document.getElementById("tourCap").textContent = cap;
}));

fetch(REVIEWS_URL, { headers: { apikey: SUPABASE_ANON_KEY } })
  .then((r) => r.ok ? r.json() : [])
  .then((reviews) => {
    const grid = document.getElementById("reviewsGrid");
    if (!reviews?.length) {
      grid.innerHTML = '<p class="reviews-empty">No reviews yet. Signed-in users can leave one from the Account page.</p>';
      return;
    }
    grid.innerHTML = reviews.map((r) => {
      const stars = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
      return `
      <article class="review-card">
        <div class="review-stars" aria-label="${stars} of 5 stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div>
        <div class="review-body">${escapeHtml(r.body)}</div>
        <div class="review-author">${escapeHtml(r.account_name)}</div>
      </article>`;
    }).join("");
  })
  .catch(() => {
    document.getElementById("reviewsGrid").innerHTML = '<p class="reviews-empty">Reviews are unavailable right now.</p>';
  });

// ---- plans and the membership, from the owner's admin panel (app_config 'prices' is public; public.offer_status gives
// only counts). If they can't be read the page keeps the numbers written in it.
const SUPABASE = "https://upiadmvxzphegivqszvp.supabase.co";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ""; };
const money = (v) => (typeof v === "number" && v > 0) ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : null;
// Why the plans are hidden (admin panel: Prices and trials > Reason while hidden); "hidden" leaves out the section.
const HOLD = {
  launch: ["Plans open soon.", "The prices go up here at launch. Until then: Jyson on Free, or every feature with a free trial."],
  prices: ["New prices are being set.", "Check back in a few days. Free and the free trial work as usual."],
  maintenance: ["Payments are under maintenance.", "Nothing can be bought for a little while. Free and the free trial work as usual."],
};
Promise.all([
  fetch(`${SUPABASE}/rest/v1/app_config?select=value&key=eq.prices`, { headers: { apikey: SUPABASE_ANON_KEY } }).then((r) => r.ok ? r.json() : []),
  fetch(`${SUPABASE}/rest/v1/rpc/offer_status`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: "{}" })
    .then((r) => r.ok ? r.json() : {}).catch(() => ({})),
]).then(([rows, offer]) => {
  const p = (rows && rows[0] && rows[0].value) || null;
  if (!p) return;
  document.querySelectorAll("[data-currency]").forEach((e) => { e.textContent = String(p.currency || "EUR").slice(0, 3); });
  document.querySelectorAll("[data-price]").forEach((e) => {
    const v = money(p[e.dataset.price]);
    if (v) e.textContent = v; else e.closest(".plan")?.remove();
  });
  const life = (offer && offer.lifetime) || {};
  const terms = [];
  if (p.lifetime_limit > 0) terms.push(`the first ${p.lifetime_limit} people`);
  if (p.lifetime_until) terms.push(`until ${longDate(p.lifetime_until)}`);
  const plan = document.getElementById("lifetimePlan");
  if (plan) {
    document.getElementById("lifetimeTerms").textContent = terms.length ? `For ${terms.join(", ")}.` : "Pay once, keep it.";
    if (typeof life.left === "number" && life.limit > 0) {
      document.getElementById("lifetimeBar").style.width = `${Math.min(100, 100 * life.taken / life.limit)}%`;
      document.getElementById("lifetimeLeft").textContent = life.open ? `${life.left} of ${life.limit} left` : "This offer has ended.";
    } else if (life.open === false) {
      document.getElementById("lifetimeLeft").textContent = "This offer has ended.";
    }
    plan.classList.toggle("plan-soldout", life.open === false);
  }

  // the plans themselves, or why they are not here yet
  const show = p.show_plans === true;
  const hold = HOLD[p.plans_reason] || (p.plans_reason === "hidden" ? null : HOLD.launch);
  document.getElementById("plansGrid").hidden = !show;
  document.getElementById("plansHold").hidden = show || !hold;
  if (!show && hold) {
    document.getElementById("plansHoldTitle").textContent = hold[0];
    document.getElementById("plansHoldText").textContent = hold[1];
  }
  if (!show && !hold) {
    document.getElementById("pricing")?.remove();
    document.querySelector('a[href="#pricing"]')?.remove();
  }

  // Free, the trial and the release membership, as the admin panel has them now
  const today = new Date().toISOString().slice(0, 10);
  const release = p.release_until && p.release_until >= today ? p.release_until : "";
  const days = Number(p.trial_on_signup && p.early_access ? p.trial_days_early_access : p.trial_days) || 0;
  const trialOpen = p.trial_open !== false && days > 0;
  const gap = Number(p.trial_gap_days) || 0;
  const fact = document.getElementById("membershipFact");
  const line = document.getElementById("trialLine");
  if (release) {
    if (fact) fact.innerHTML = `<strong>Free release membership.</strong> Every account made before ${longDate(release)} gets all features free until that day. No card, nothing to pay, and it ends by itself.`;
    if (line) line.textContent = "";
  } else if (trialOpen && p.trial_on_signup) {
    if (fact) fact.innerHTML = `<strong>Free trial.</strong> Every new account gets every feature for ${days} days. No card, nothing to pay, and it ends by itself.`;
    if (line) line.textContent = `${days}-day free trial for every new account. No card needed.`;
  } else if (trialOpen) {
    if (fact) fact.innerHTML = `<strong>Free trial.</strong> Every feature for ${days} days, started from your account page when you want. No card, nothing to pay, and it ends by itself.`;
    if (line) line.textContent = `Start on Free, or take a free ${days}-day trial from your account page - every feature, no card, and it ends by itself.`
      + (gap ? ` One trial per account every ${gap} days.` : "");
  } else {
    if (fact) fact.innerHTML = "<strong>Free to start.</strong> Jyson works on Free, no card needed.";
    if (line) line.textContent = "";
  }
  const note = document.getElementById("pricingNote");
  if (note) note.textContent = show && p.checkout_open ? "Every plan has every feature. Pay on your account page; cancel any time."
    : show ? "These are the planned prices. Paid plans aren't on sale yet while we finish the paperwork - until then the free trial gives you every paid feature."
    : trialOpen ? "Paid plans aren't on sale yet - we're finishing the paperwork to sell them. Until prices are announced, the free trial gives you everything the paid version has: every feature, no card, and it ends by itself."
    : "Paid plans aren't on sale yet - we're finishing the paperwork to sell them. Until then Jyson works on Free.";
}).catch(() => { /* the written texts stay */ });

// The Discord server window, only after a click (it is Discord's page and sets Discord's cookies).
document.getElementById("discordLoad")?.addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.src = "https://discord.com/widget?id=1569725304253972499&theme=dark";
  frame.title = "Jyson's Discord server";
  frame.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts");
  frame.setAttribute("loading", "lazy");
  const box = document.getElementById("discordBox");
  box.replaceChildren(frame);
});

// On a phone the download is a Windows installer it cannot run: the button sends this page on instead
// (the share sheet: e-mail, a chat, or "send to PC"), or copies the link where there is no share sheet.
document.querySelectorAll("[data-send-to-pc]").forEach((button) => button.addEventListener("click", async () => {
  const url = location.origin + "/";
  try {
    if (navigator.share) {
      await navigator.share({ title: "Jyson for Windows", text: "Download Jyson on my PC", url });
      return;
    }
    await navigator.clipboard.writeText(url);
    button.textContent = "Link copied - open it on your PC";
  } catch {
    /* closed the share sheet: nothing to do */
  }
}));

function escapeHtml(value){
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
