// /cancel#<token> — cancel or reschedule a booked call. The token stays in the URL fragment,
// so it never reaches server logs; it is sent to /api/cancel in a POST body.
const $ = (s) => document.querySelector(s);

if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  throw new Error("framed");
}

const token = decodeURIComponent(location.hash.slice(1));
const show = (name) => document.querySelectorAll("[data-state]").forEach((el) => { el.hidden = el.dataset.state !== name; });
const fail = (msg) => { $("[data-error]").textContent = msg; show("error"); };

const call = async (action, extra = {}) => {
  const res = await fetch("/api/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action, ...extra }),
  });
  let body = {};
  try { body = await res.json(); } catch (_) { /* not JSON */ }
  if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please reply to your confirmation email.");
  return body;
};

const when = (iso, mins) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
  return `${day} at ${time}, ${mins} minutes`;
};

async function start() {
  if (!token) return fail("The link is missing its code. Use the link in your confirmation email, or reply to that email.");
  try {
    const { booking } = await call("lookup");
    $("[data-when]").textContent = `Hi ${booking.firstName}, your call is on ${when(booking.start, booking.durationMin)}.`;
    show("found");
  } catch (err) {
    fail(err.message);
  }
}

const act = (rebooking) => async () => {
  const buttons = document.querySelectorAll("[data-state='found'] button");
  buttons.forEach((b) => { b.disabled = true; });
  $("[data-status]").textContent = rebooking ? "Freeing this time…" : "Cancelling…";
  try {
    await call("cancel", { rebooking });
    history.replaceState(null, "", location.pathname); // the code is spent; drop it from the address bar
    if (rebooking) location.href = "/#contact";
    else show("done");
  } catch (err) {
    $("[data-status]").textContent = err.message;
    $("[data-status]").className = "form-status form-status--err";
    buttons.forEach((b) => { b.disabled = false; });
  }
};

$("[data-cancel]").addEventListener("click", act(false));
$("[data-reschedule]").addEventListener("click", act(true));
start();
