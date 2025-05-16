// utils.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase setup
export const supabase = createClient(
	"https://jbcrdyjoggrsdiwkipda.supabase.co",
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JkeWpvZ2dyc2Rpd2tpcGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzY2ODksImV4cCI6MjA2MjU1MjY4OX0.Pa1rIyOnmM00fJTqRXj-IUHyLFCas1qBiMjBL4FFJFE"
);

// Collapsible Sections

document.querySelectorAll(".collapsible-section").forEach((section) => {
	section.addEventListener("click", () => {
		// Only proceed if the clicked section is not already expanded
		if (!section.classList.contains("expanded")) {
			document.querySelectorAll(".collapsible-section").forEach((s) => {
				s.classList.remove("expanded");
			});
			section.classList.add("expanded");
		}
	});
});

// Links

document.querySelectorAll('a[href^="#"]').forEach((link) => {
	link.addEventListener("click", (e) => {
		const targetId = link.getAttribute("href");
		const targetSection = document.querySelector(targetId);

		if (
			targetSection &&
			targetSection.classList.contains("collapsible-section")
		) {
			// Prevent default scroll so we can do smooth scroll after expand
			e.preventDefault();

			// Collapse all sections
			document.querySelectorAll(".collapsible-section").forEach((section) => {
				section.classList.remove("expanded");
			});

			// Expand target section
			targetSection.classList.add("expanded");

			// Scroll to the section after it's expanded
			setTimeout(() => {
				targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
			}, 100); // Delay matches CSS transition timing
		}
	});
});

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
export async function getAvailableClasses(filters = {}, userId = null) {
	let query = supabase.from("classes").select("*").gt("available_spots", 0);

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

	const { data: classes, error } = await query;

	if (error) {
		console.error("Class fetch error:", error.message);
		return [];
	}

	if (userId) {
		// Get the class_ids the user is already booked for
		const { data: bookings } = await supabase
			.from("bookings")
			.select("class_id")
			.eq("user_id", userId);

		const bookedIds = bookings.map((b) => b.class_id);

		// Filter out booked classes
		return classes.filter((cls) => !bookedIds.includes(cls.id));
	}

	return classes;
}

// Placeholder for booking function
export async function createUserBooking(userId, classId) {
	alert(`Booking user ${userId} for class ${classId} (function not built yet)`);
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

// Get User Bookings
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

// Get Upcoming User Bookings
export async function getUpcomingUserBookings(userId) {
	const today = new Date().toISOString().split("T")[0];

	const { data, error } = await supabase
		.from("bookings")
		.select("*, class:classes(*)")
		.eq("user_id", userId)
		.gte("class.date", today);

	if (error) {
		console.error("getUpcomingUserBookings error:", error.message);
		return [];
	}

	// 🛑 Filter out bookings where related class is missing
	const validBookings = data.filter(
		(b) => b.class && b.class.date && b.class.time
	);

	// ✅ Sort by class date
	return validBookings.sort((a, b) => {
		const dateA = new Date(`${a.class.date}T${a.class.time}`);
		const dateB = new Date(`${b.class.date}T${b.class.time}`);
		return dateA - dateB;
	});
}

// Render User Bookings
export async function renderUserBookings() {
	const bookingContainer = document.getElementById("my-bookings-list");
	if (!bookingContainer) return;

	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const bookings = await getUpcomingUserBookings(userId);

	if (!bookings || bookings.length === 0) {
		bookingContainer.innerHTML = "<p>No upcoming bookings.</p>";
		return;
	}

	bookingContainer.innerHTML = "";

	bookings.forEach(({ class: cls }) => {
		const classDateTime = new Date(`${cls.date}T${cls.time}`);
		const formattedTime = classDateTime.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});

		const wrapper = document.createElement("div");
		wrapper.className = "class-slot confirmed-booking";
		wrapper.dataset.classId = cls.id;

		wrapper.innerHTML = `

		
			
				<div class="card-calendar-col">
					<div class="calendar-month">${new Date(cls.date).toLocaleString("default", {
						month: "short",
					})}</div>
					<div class="calendar-day">${new Date(cls.date).getDate()}</div>
					<div class="calendar-weekday">${new Date(cls.date).toLocaleString("default", {
						weekday: "short",
					})}</div>
				</div>
				<div class="card-info-col">
					<div class="class-name-row">
	<span class="card-class-name">${cls.name}</span>
	${
		cls.description
			? `<span class="card-class-description">${cls.description}</span>`
			: ""
	}
</div>
<div class="card-class-time">${formattedTime}</div>
				</div>
				<i class="fa-solid fa-trash booking-trash-icon"></i>
			
		`;

		bookingContainer.appendChild(wrapper);
	});
}

export function showToast(message, type = "success") {
	const toast = document.getElementById("toast");
	if (!toast) return;

	toast.textContent = message;
	toast.className = `toast show ${type === "error" ? "error" : ""}`;

	// Longer duration for errors (e.g., 5s), default is 3s
	const duration = type === "error" ? 5000 : 3000;

	setTimeout(() => {
		toast.classList.remove("show");
	}, duration);
}

export function showConfirmation(message, onConfirm, onCancel = () => {}) {
	const toast = document.getElementById("confirmation-toast");
	const messageElem = document.getElementById("confirmation-message");
	const yesBtn = document.getElementById("confirm-yes");
	const noBtn = document.getElementById("confirm-no");

	messageElem.textContent = message;
	toast.style.display = "flex";

	// Clear old listeners
	const newYes = yesBtn.cloneNode(true);
	const newNo = noBtn.cloneNode(true);
	yesBtn.parentNode.replaceChild(newYes, yesBtn);
	noBtn.parentNode.replaceChild(newNo, noBtn);

	newYes.addEventListener("click", () => {
		toast.style.display = "none";
		onConfirm();
	});
	newNo.addEventListener("click", () => {
		toast.style.display = "none";
		onCancel();
	});
}
