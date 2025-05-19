import { supabase } from "./supabaseClient.js";

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

// Get User Profile by ID
export async function getUserProfile(userId) {
	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", userId)
		.single();

	if (error) {
		console.error("Error fetching profile:", error.message);
		return null;
	}

	return data;
}

// Get All Classes
export async function getAvailableClasses() {
	const { data, error } = await supabase.from("classes").select("*");

	if (error) {
		console.error("Error fetching classes:", error.message);
		return [];
	}

	return data;
}

// Get Bookings for a User
export async function getUserBookings(userId) {
	const { data, error } = await supabase
		.from("bookings")
		.select("class_id")
		.eq("user_id", userId);

	if (error) {
		console.error("Error fetching bookings:", error.message);
		return [];
	}

	return data.map((b) => b.class_id);
}

// Get All Users (admin use)
export async function getAllUsers() {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, name, surname, role");

	if (error) {
		console.error("Error fetching all users:", error.message);
		return [];
	}

	return data;
}

// Get All Bookings (admin use)
export async function getAllBookings() {
	const { data, error } = await supabase.from("bookings").select("*");

	if (error) {
		console.error("Error fetching all bookings:", error.message);
		return [];
	}

	return data;
}

// Group classes by date (e.g., '2024-05-10')
export function groupClassesByDate(classes) {
	const grouped = {};
	classes.forEach((cls) => {
		const dateKey = formatDate(new Date(cls.date));
		if (!grouped[dateKey]) grouped[dateKey] = [];
		grouped[dateKey].push(cls);
	});
	return grouped;
}

// Check if a class is booked by the user
export function isClassBooked(classId, userBookings) {
	return userBookings.includes(classId);
}

// Get unique class types from all classes (useful for filters)
export function getUniqueClassTypes(classes) {
	const types = new Set();
	classes.forEach((cls) => {
		if (cls.type) types.add(cls.type);
	});
	return Array.from(types);
}

// Format Date

export function formatDate(date) {
	const d = new Date(date); // ensures it's a Date object
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// Toast

export function showToast(message, type = "success") {
	const toastContainer = document.getElementById("toast-container");

	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;

	toastContainer.appendChild(toast);

	// Remove after animation completes (e.g., 3s)
	setTimeout(() => {
		toast.remove();
	}, 3000);
}

// Confirmation Modal

export function confirmAction(message) {
	return new Promise((resolve) => {
		const modal = document.getElementById("confirm-modal");
		const msg = document.getElementById("confirm-message");
		const yes = document.getElementById("confirm-yes");
		const no = document.getElementById("confirm-no");

		msg.textContent = message;
		modal.classList.remove("hidden");

		const cleanup = () => {
			modal.classList.add("hidden");
			yes.removeEventListener("click", onYes);
			no.removeEventListener("click", onNo);
		};

		const onYes = () => {
			cleanup();
			resolve(true);
		};

		const onNo = () => {
			cleanup();
			resolve(false);
		};

		yes.addEventListener("click", onYes);
		no.addEventListener("click", onNo);
	});
}

// Generate Schedule Trigger (Admin only)

document
	.getElementById("generate-schedule")
	.addEventListener("click", async () => {
		const label = document.getElementById("month-label").textContent.trim(); // e.g. "June 2025"
		const [monthName, yearStr] = label.split(" ");
		const year = parseInt(yearStr);
		const monthIndex = new Date(`${monthName} 1, 2000`).getMonth(); // ✅ 0-based

		if (!year || isNaN(monthIndex)) {
			showToast?.("Invalid month label.", "error");
			return;
		}

		// Step 1: Check for existing classes
		const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
		const monthEnd = formatDate(new Date(year, monthIndex + 1, 0)); // ✅ end of the month

		const { data: existing, error: checkError } = await supabase
			.from("classes")
			.select("id")
			.gte("date", monthStart)
			.lte("date", monthEnd)
			.limit(1);

		if (checkError) {
			console.error("❌ Error checking existing classes:", checkError.message);
			showToast?.("Failed to check existing classes.", "error");
			return;
		}

		if (existing.length > 0) {
			showToast?.(
				"Month already contains classes. Please clear them first.",
				"warning"
			);
			return;
		}

		const confirmed = await confirmAction(
			`This will generate a full class schedule for ${monthName} ${year}.\n\nAre you sure you want to continue?`
		);

		if (!confirmed) return;

		await generateScheduleForMonth(year, monthIndex); // ✅ uses 0-based month
	});

// Generate Schedule Function

async function generateScheduleForMonth(year, monthIndex) {
	const { data: templates, error: templateError } = await supabase
		.from("class_schedule_template")
		.select("*");

	if (templateError) {
		console.error("❌ Template fetch failed:", templateError.message);
		showToast?.("Failed to load schedule templates.", "error");
		return;
	}

	const daysInMonth = new Date(year, monthIndex + 1, 0).getDate(); // ✅ get # days in correct month
	const newClasses = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateObj = new Date(Date.UTC(year, monthIndex, day));
		console.log("📆 Date:", dateObj.toISOString(), "→", formatDate(dateObj));

		const dayIndex = dateObj.getDay(); // 0–6 (Sun–Sat)

		const matchingTemplates = templates.filter(
			(t) => Number(t.day_of_week) === dayIndex
		);

		for (const template of matchingTemplates) {
			const newClass = {
				name: template.name,
				date: formatDate(dateObj),
				time: template.time,
				capacity: template.capacity,
				description: template.description || null,
				// trainer: template.trainer || null, // optional
			};

			newClasses.push(newClass);
		}
	}

	console.log(`🧾 Preparing to insert ${newClasses.length} classes`);

	if (newClasses.length === 0) {
		showToast?.("No matching templates for this month.", "info");
		return;
	}

	const { error: insertError } = await supabase
		.from("classes")
		.insert(newClasses);

	if (insertError) {
		console.error("❌ Insert failed:", insertError.message);
		console.log("🧾 Payload:", newClasses);
		showToast?.("Failed to generate schedule.", "error");
	} else {
		showToast?.("Schedule generated successfully!", "success");
		console.log("✅ Insert complete!");
	}
}

// Helper function to adjust user credits (for admin use)

export async function adjustUserCredits(userId, delta) {
	const { data: profile, error: fetchError } = await supabase
		.from("profiles")
		.select("credits")
		.eq("id", userId)
		.single();

	if (fetchError || !profile) {
		console.error("❌ Could not fetch credits:", fetchError?.message);
		return false;
	}

	const newCredits = profile.credits + delta;

	const { error: updateError } = await supabase
		.from("profiles")
		.update({ credits: newCredits })
		.eq("id", userId);

	if (updateError) {
		console.error("❌ Failed to update credits:", updateError.message);
		return false;
	}

	return true;
}

// Expand Panel

const navIcons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".panel");

const main = document.getElementById("main");

navIcons.forEach((icon) => {
	icon.addEventListener("click", () => {
		const targetId = icon.dataset.target;
		console.log("Clicked nav icon for:", targetId);

		if (targetId === "four") {
			console.log("Toggling class 'header-visible' on body");
			document.body.classList.toggle("header-visible");
			return;
		}

		const targetSection = document.getElementById(targetId);
		if (!targetSection) {
			console.warn("Target section not found:", targetId);
			return;
		}

		// Switch active nav icon
		navIcons.forEach((i) => i.classList.remove("active"));
		icon.classList.add("active");

		// Activate the selected panel
		sections.forEach((section) => {
			if (section.id === targetId) {
				section.classList.add("active");

				// ✅ Reset scroll on the #main scroll container
				if (main) main.scrollTop = 0;
			} else {
				section.classList.remove("active");
			}
		});

		// Remove sidebar if coming from "four"
		document.body.classList.remove("header-visible");
	});
});
