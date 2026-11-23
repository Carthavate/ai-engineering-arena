// Entry of anna-callback.html, served by the website: the Anna app's sign-in popup lands here after GitHub and
// hands the one-time code back to the app window on anna.partners.
import { ANNA_ORIGIN, callbackMessage } from "./bsw/anna/authMessage";

const message = callbackMessage(window.location.href);
// Don't leave the one-time code in this window's history.
window.history.replaceState(null, "", window.location.pathname);

const status = document.getElementById("status");
const show = (text: string) => { if (status) status.textContent = text; };

if (!window.opener) {
  show("This page finishes signing in to the Arena app in Anna. Go back to the app and click Sign in again.");
} else {
  window.opener.postMessage(message, ANNA_ORIGIN);
  if (message.code) {
    show("Signed in. You can close this window.");
    setTimeout(() => window.close(), 300);
  } else {
    show(`Sign-in failed: ${message.error}`);
  }
}
