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

function escapeHtml(value){
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
