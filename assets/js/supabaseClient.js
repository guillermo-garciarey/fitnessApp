// supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://jbcrdyjoggrsdiwkipda.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JkeWpvZ2dyc2Rpd2tpcGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzY2ODksImV4cCI6MjA2MjU1MjY4OX0.Pa1rIyOnmM00fJTqRXj-IUHyLFCas1qBiMjBL4FFJFE";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ Auto-handle magic link or email confirmation redirect
supabase.auth.getSession().then(({ data, error }) => {
	if (error) {
		console.error("Session error:", error);
	} else if (data?.session) {
		console.log("Recovered session:", data.session.user);
	}
});

// ✅ Listen for auth state change events (optional)
supabase.auth.onAuthStateChange((event, session) => {
	if (event === "SIGNED_IN") {
		console.log("User signed in!", session.user);
		// Optional redirect or UI update here
	}
});
