// Entry of auth-callback.html: the sign-in popup lands here after GitHub and hands the code back to the app window.
import { AUTH_CHANNEL, callbackMessage } from "./bsw/anna/authMessage";

const message = callbackMessage(window.location.href);
const channel = new BroadcastChannel(AUTH_CHANNEL);
channel.postMessage(message);
channel.close();
window.opener?.postMessage(message, window.location.origin);

const status = document.getElementById("status");
if (status) status.textContent = message.code ? "Signed in. You can close this window." : `Sign-in failed: ${message.error}`;
// Don't leave the one-time code in this window's history.
window.history.replaceState(null, "", window.location.pathname);
if (message.code) setTimeout(() => window.close(), 300);
