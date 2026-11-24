// Entry of anna-callback.html, served by the website: the Anna app's sign-in popup lands here after GitHub and
// hands the one-time code back to the app window on anna.partners.
//
// Every Anna app shares the anna.partners origin, so another app could start its own sign-in that ends here and
// receive the code like the Arena would. Handing it over therefore takes a click, so a flow started behind the
// player's back can't finish silently (ADR-0012).
import { ANNA_ORIGIN, callbackMessage } from "./bsw/anna/authMessage";

const message = callbackMessage(window.location.href);
// Don't leave the one-time code in this window's history.
window.history.replaceState(null, "", window.location.pathname);

const status = document.getElementById("status");
const finish = document.getElementById("finish");
const show = (text: string) => { if (status) status.textContent = text; };

if (!window.opener) {
  show("This page finishes signing in to the Arena app in Anna. Go back to the app and click Sign in again.");
} else if (!message.code) {
  window.opener.postMessage(message, ANNA_ORIGIN);
  show(`Sign-in failed: ${message.error}`);
} else if (finish) {
  show("Only continue if you just clicked Sign in in the AI Engineering Arena app in Anna.");
  finish.hidden = false;
  finish.addEventListener("click", () => {
    window.opener?.postMessage(message, ANNA_ORIGIN);
    finish.hidden = true;
    show("Signed in. You can close this window.");
    setTimeout(() => window.close(), 300);
  }, { once: true });
}
