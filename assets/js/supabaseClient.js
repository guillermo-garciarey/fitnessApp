// supabaseClient.js
// import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 2) Then your debug log
console.log("[supabase-reset] script loaded");

// 🔐 Supabase project config
const supabaseUrl = "https://jbcrdyjoggrsdiwkipda.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JkeWpvZ2dyc2Rpd2tpcGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzY2ODksImV4cCI6MjA2MjU1MjY4OX0.Pa1rIyOnmM00fJTqRXj-IUHyLFCas1qBiMjBL4FFJFE";

export const supabase = createClient(supabaseUrl, supabaseKey);

// 🔄 Handle email confirmation / magic link
async function handleEmailConfirmation() {
	const params = new URLSearchParams(window.location.search);
	const type = params.get("type");
	const accessToken = params.get("access_token");

	if (type === "signup" && accessToken) {
		const refreshToken = params.get("refresh_token");

		const { error } = await supabase.auth.setSession({
			access_token: accessToken,
			refresh_token: refreshToken,
		});

		if (error) {
			console.error("❌ Email confirmation failed:", error.message);
			showToast?.("Email confirmation failed", "error");
		} else {
			console.log("✅ Email confirmed and session set");
			showToast?.("Email confirmed! 🎉", "success");

			// Clean up the URL
			window.history.replaceState({}, document.title, "/fitnessApp/index.html");

			// Optional: redirect to dashboard
			// window.location.href = "dashboard.html";
		}
	}
}

// 🚀 Initialize auth logic
(async () => {
	await handleEmailConfirmation();

	// Recover session (useful for page reloads)
	const { data, error } = await supabase.auth.getSession();
	if (error) {
		console.error("⚠️ Session error:", error);
	} else if (data?.session) {
		console.log("🔐 Recovered session:", data.session.user);
	}
})();

// 📣 Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
	if (event === "SIGNED_IN") {
		console.log("👋 User signed in!", session.user);
		// Optionally redirect or update UI
	}
});
