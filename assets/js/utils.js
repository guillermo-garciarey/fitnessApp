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
		const dateKey = cls.date.split("T")[0];
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

// Generate Schedule (Admin only)

document
	.getElementById("generate-schedule")
	.addEventListener("click", async () => {
		const label = document.getElementById("month-label").textContent.trim(); // e.g. "June 2025"
		const [monthName, yearStr] = label.split(" ");
		const year = parseInt(yearStr);
		const monthIndex = new Date(`${monthName} 1, 2000`).getMonth() + 1; // convert to number 1-12

		if (!year || !monthIndex) {
			showToast?.("Invalid month label.", "error");
			return;
		}

		// Step 1: Check for existing classes in selected month
		const monthStart = `${year}-${String(monthIndex).padStart(2, "0")}-01`;
		const monthEnd = new Date(year, monthIndex, 0).toISOString().split("T")[0]; // last day of month

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

		// Step 2: Proceed to generate
		await generateScheduleForMonth(year, monthIndex);
	});

// Generate Schedule Function

async function generateScheduleForMonth(year, month) {
	const { data: templates, error: templateError } = await supabase
		.from("class_schedule_template")
		.select("*");

	if (templateError) {
		console.error("❌ Template fetch failed:", templateError.message);
		showToast?.("Failed to load schedule templates.", "error");
		return;
	}

	const daysInMonth = new Date(year, month, 0).getDate();
	const newClasses = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateObj = new Date(year, month - 1, day);

		// 🧠 Get full weekday name (e.g., "Monday")
		const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

		const matchingTemplates = templates.filter(
			(t) => t.day_of_week === dayName
		);

		for (const template of matchingTemplates) {
			newClasses.push({
				name: template.name,
				date: dateObj.toISOString().split("T")[0],
				time: template.time,
				capacity: template.capacity,
				description: template.description || null,
				trainer: template.trainer || null,
			});
		}
	}

	if (newClasses.length === 0) {
		showToast?.("No matching templates for this month.", "info");
		return;
	}

	const { error: insertError } = await supabase
		.from("classes")
		.insert(newClasses);

	if (insertError) {
		console.error("❌ Insert failed:", insertError.message);
		showToast?.("Failed to generate schedule.", "error");
	} else {
		showToast?.("Schedule generated successfully!", "success");
	}
}
