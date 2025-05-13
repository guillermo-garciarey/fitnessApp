// utils.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase setup
export const supabase = createClient(
	"https://jbcrdyjoggrsdiwkipda.supabase.co",
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JkeWpvZ2dyc2Rpd2tpcGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzY2ODksImV4cCI6MjA2MjU1MjY4OX0.Pa1rIyOnmM00fJTqRXj-IUHyLFCas1qBiMjBL4FFJFE"
);

// Capitalize helper
export function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Get current session
export async function getSession() {
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error) {
		console.error("Session error:", error.message);
	}
	return session;
}

// Get profile for a given user ID
export async function getUserProfile(userId) {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, name, surname, role")
		.eq("id", userId)
		.single();

	if (error) {
		console.error("Profile fetch error:", error.message);
	}

	return data;
}

// Get all available classes with optional filters (type, date)
export async function getAvailableClasses(filters = {}) {
	let query = supabase.from("classes").select("*").gt("available_spots", 0); // keep available spot logic

	if (filters.type) {
		query = query.eq("name", filters.type);
	}

	if (filters.month !== undefined) {
		const now = new Date();
		const year = now.getFullYear();
		const month = filters.month;
		const startDate = new Date(year, month, 1).toISOString().split("T")[0];
		const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

		query = query.gte("date", startDate).lte("date", endDate);
	}

	const { data, error } = await query;

	if (error) {
		console.error("Class fetch error:", error.message);
		return [];
	}

	return data;
}

// Placeholder for booking function
export async function createUserBooking(userId, classId) {
	alert(`Booking user ${userId} for class ${classId} (function not built yet)`);
	// You'll replace this with real logic later
}

// Convert Date to Text
export function formatPrettyDate(dateStr) {
	const date = new Date(dateStr);

	const day = date.getDate();
	const weekday = date.toLocaleString("default", { weekday: "short" }); // Mon, Tue, etc.
	const month = date.toLocaleString("default", { month: "long" });

	const getOrdinal = (n) => {
		if (n > 3 && n < 21) return "th";
		switch (n % 10) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	};

	return `${weekday}, ${month} ${day}${getOrdinal(day)}`;
}
