// dashboard.js
import {
	supabase,
	getUserProfile,
	getSession,
	getAvailableClasses,
	getUserBookings,
	getUpcomingUserBookings,
	renderUserBookings,
	showToast,
	showConfirmation,
} from "../../assets/js/utils.js";

export async function refreshAvailableClasses() {
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const allClasses = await getAvailableClasses();
	const bookedClassIds = await getUserBookings(userId);

	const filteredClasses = allClasses.filter(
		(cls) => !bookedClassIds.includes(cls.id)
	);

	renderGroupedClassColumns(filteredClasses);
}

// ✅ Check auth on load
const {
	data: { session },
} = await supabase.auth.getSession();

var $window = $(window),
	$body = $("body"),
	$header = $("#header"),
	$titleBar = null,
	$nav = $("#nav"),
	$wrapper = $("#wrapper");

if (!session || !session.user) {
	window.location.href = "index.html";
} else {
	const userId = session.user.id;

	const { data: profile, error } = await supabase
		.from("profiles")
		.select("name, surname")
		.eq("id", userId)
		.single();

	$titleBar = $(
		`<div id="titleBar">
            <a href="#header" class="toggle"></a>
            <span class="title">${profile.name} ${profile.surname}</span>
        </div>`
	).appendTo($body);

	document.getElementById("logo").textContent = `Hello ${profile.name}`;
}

let userRole = null;
const container = document.getElementById("class-container");

(async () => {
	const session = await getSession();
	const userId = session?.user?.id;

	if (userId) {
		const profile = await getUserProfile(userId);
		userRole = profile?.role;
		if (userRole === "admin") document.body.classList.add("admin");
	}

	const allClasses = await getAvailableClasses();
	const bookedClassIds = await getUserBookings(userId);

	const filteredClasses = allClasses.filter(
		(cls) => !bookedClassIds.includes(cls.id)
	);

	if (!filteredClasses || filteredClasses.length === 0) {
		container.innerHTML = "<p>Unable to load classes right now.</p>";
	} else {
		renderGroupedClassColumns(filteredClasses);
	}

	// 🔥 THIS is what was missing
	renderUserBookings();
})();

function renderGroupedClassColumns(allClasses) {
	container.innerHTML = "";

	const today = new Date();
	const todayStr = today.toISOString().split("T")[0];

	const startDate = new Date(today);
	startDate.setDate(startDate.getDate() - 40);
	startDate.setHours(0, 0, 0, 0);
	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + 40);
	endDate.setHours(23, 59, 59, 999);

	const allDates = [];
	let current = new Date(startDate);

	while (current <= endDate) {
		allDates.push(current.toISOString().split("T")[0]);
		current.setDate(current.getDate() + 1);
	}

	const grouped = {};
	allClasses.forEach((cls) => {
		const dateKey = cls.date.split("T")[0];
		if (!grouped[dateKey]) grouped[dateKey] = [];
		grouped[dateKey].push(cls);
	});

	allDates.forEach((date) => {
		const dateObj = new Date(date);
		const dayName = dateObj.toLocaleString("default", { weekday: "short" });
		const dayNum = dateObj.getDate();
		const monthName = dateObj.toLocaleString("default", { month: "short" });
		const isToday = date === todayStr;

		const dayContainer = document.createElement("div");
		dayContainer.className = "day-container";
		dayContainer.setAttribute("data-date", date);

		dayContainer.innerHTML = `
        <div class="calendar-header-wrapper">
            <button class="day-scroll scroll-left">&#10094;</button>
            <div class="day-header calendar-box ${isToday ? "today-box" : ""}">
                <div class="month">${monthName}</div>
                <div class="day-number">${dayNum}</div>
                <div class="weekday">${dayName}</div>
            </div>
            <button class="day-scroll scroll-right">&#10095;</button>
        </div>

		<div class="inner">
      <ul class="legend">
        
<li class="legend-blue">This class has available spots. </li>
<li class="legend-green">You have successfully booked this class.</li>
<li class="legend-black">Class is no longer available.</li>


      </ul>
    </div>
        ${
					userRole === "admin"
						? `


       `
						: ""
				}`;

		const dayClasses = (grouped[date] || []).sort((a, b) =>
			a.time.localeCompare(b.time)
		);

		if (dayClasses.length === 0) {
			const noClassMsg = document.createElement("div");
			noClassMsg.className = "class-slot no-classes";
			noClassMsg.textContent = "No classes today";
			dayContainer.appendChild(noClassMsg);

			for (let i = 1; i < 6; i++) {
				const slot = document.createElement("div");
				slot.className = "empty-slot";

				dayContainer.appendChild(slot);
			}
		} else {
			dayClasses.forEach((cls) => {
				const slot = document.createElement("div");
				slot.className = "class-slot";
				slot.dataset.classId = cls.id; // 👈 moved data-class-id to the card itself
				slot.dataset.classDate = cls.date; // Add this line
				slot.dataset.classTime = cls.time; // Add this line

				const classDateTime = new Date(`${cls.date}T${cls.time}`);
				const now = new Date();
				const isPast = classDateTime.getTime() < now.getTime();

				const [hour, minute] = cls.time.split(":");
				const timeObj = new Date();
				timeObj.setHours(parseInt(hour), parseInt(minute));
				const timeFormatted = timeObj.toLocaleTimeString([], {
					hour: "numeric",
					minute: "2-digit",
					hour12: true,
				});

				console.log("Class object:", cls);

				// prettier-ignore
				slot.innerHTML = `
    
        <div class="card-calendar-col">
            <div class="calendar-month">${new Date(cls.date).toLocaleString("default", {
                month: "short",
            })}</div>
            <div class="calendar-day">${new Date(cls.date).getDate()}</div>
            <div class="calendar-weekday">${new Date(cls.date).toLocaleString("default", {
                weekday: "short",
            })}</div>
        </div>
        <div class="card-info-col ${isPast ? "past-class" : ""}">
            <div class="class-name-row">
                <span class="card-class-name">${cls.name}</span>
                ${
                    cls.description
                        ? `<span class="card-class-description">${cls.description}</span>`
                        : ""
                }
            </div>
            <div class="card-class-time">${timeFormatted}</div>
        </div>
    
`;

				dayContainer.appendChild(slot);
			});
		}

		// 🟧 Add placeholder slots only if there are some real classes
		if (dayClasses.length > 0) {
			const numPlaceholders = 7 - dayClasses.length;
			for (let i = 0; i < numPlaceholders; i++) {
				const placeholder = document.createElement("div");
				placeholder.className = "admin-class-slot admin-slot-placeholder";
				placeholder.innerHTML = `
      <div class="admin-card-calendar-col">
          <div class="admin-calendar-month">${monthName}</div>
          <div class="admin-calendar-day">${dayNum}</div>
          <div class="admin-calendar-weekday">${dayName}</div>
      </div>
      <div class="admin-card-info-col">
          <div class="admin-card-class-name placeholder-text">Open Slot</div>
          <div class="admin-card-time placeholder-text">Placeholder text</div>
      </div>
    `;
				dayContainer.appendChild(placeholder);
			}
		}

		container.appendChild(dayContainer);
	});

	const scrollCap = document.createElement("div");
	scrollCap.style.flex = "0 0 1px";
	scrollCap.style.width = "1px";
	scrollCap.style.height = "1px";
	container.appendChild(scrollCap);

	requestAnimationFrame(() => {
		const allDays = container.querySelectorAll(".day-container");
		const scrollTarget = Array.from(allDays).find(
			(day) => day.getAttribute("data-date") === todayStr
		);
		if (scrollTarget) {
			container.scrollTo({
				left: scrollTarget.offsetLeft,
				behavior: "instant",
			});
		}
	});
}

// Delete Full Day (For Admins)
document.addEventListener("click", async (e) => {
	if (e.target.matches(".day-delete")) {
		const dateToDelete = e.target.dataset.date;
		if (
			!confirm(
				`Are you sure you want to delete all classes on ${dateToDelete}?`
			)
		)
			return;

		const { error } = await supabase
			.from("classes")
			.delete()
			.eq("date", dateToDelete);

		if (error) {
			alert("Failed to delete classes: " + error.message);
		} else {
			const { data: updatedClasses, error: refreshError } = await supabase
				.from("classes")
				.select("id, name, description, date, time, capacity, booked_slots")
				.order("date", { ascending: true });

			if (refreshError || !updatedClasses) {
				alert("Failed to refresh class view.");
			} else {
				renderGroupedClassColumns(updatedClasses);
				alert("Classes deleted for " + dateToDelete);
			}
		}
	}
});

// Create Class Modal
document.addEventListener("click", (e) => {
	if (e.target.matches(".day-add")) {
		const date = e.target.dataset.date;
		document.getElementById("classDate").value = date;
		document.getElementById("classModal").style.display = "flex";
		document.getElementById("classModalOverlay").style.display = "flex";
	}
	if (e.target.matches("#cancelModal, #classModalOverlay")) {
		closeModal();
	}
});

function closeModal() {
	document.getElementById("classModal").style.display = "none";
	document.getElementById("classModalOverlay").style.display = "none";
}

// Create Class (For Admins)
document.getElementById("classForm").addEventListener("submit", async (e) => {
	e.preventDefault();

	const newClass = {
		name: document.getElementById("className").value,
		trainer: document.getElementById("classTrainer").value,
		time: document.getElementById("classTime").value,
		capacity: parseInt(document.getElementById("classCapacity").value),
		date: document.getElementById("classDate").value,
		booked_slots: 0,
	};

	const { error } = await supabase.from("classes").insert([newClass]);

	if (error) {
		alert("Error creating class: " + error.message);
	} else {
		alert("Class created successfully!");
		closeModal();
		const { data: updatedClasses, error: refreshError } = await supabase
			.from("classes")
			.select("id, name, description, date, time, capacity, booked_slots")
			.order("date", { ascending: true });

		if (refreshError || !updatedClasses) {
			alert("Failed to refresh class view.");
		} else {
			renderGroupedClassColumns(updatedClasses);
		}
	}
});

// Create Upcoming Bookings

const bookingContainer = document.getElementById("my-bookings-list");

// Cancel booking

document.addEventListener("click", async (e) => {
	const slot = e.target.closest(".class-slot");
	if (!slot || !slot.dataset.classId) return;

	// ❌ Prevent interaction if it's a past class
	if (slot.classList.contains("past-class")) {
		showToast("You cannot interact with a past class.", "error");
		return;
	}

	const classId = slot.dataset.classId;

	const inAvailableView = !!slot.closest(".available-view");
	const inBookingsView = !!slot.closest(".bookings-view");

	const session = await getSession();
	const userId = session?.user?.id;

	if (!userId || !classId) {
		alert("Missing user or class ID.");
		return;
	}

	// 🟦 Booking Flow (Available View)
	if (inAvailableView) {
		const classDateTime = new Date(
			`${slot.dataset.classDate}T${slot.dataset.classTime}`
		);
		const now = new Date();

		if (classDateTime < now) {
			showToast("You cannot book a past class.", "error");
			return;
		}
		showConfirmation("Book class?", async () => {
			const { error: bookingError } = await supabase
				.from("bookings")
				.insert([{ user_id: userId, class_id: classId }]);

			if (bookingError) {
				showToast("Booking failed: " + bookingError.message, "error");
				return;
			}

			await supabase.from("payments").insert([
				{
					user_id: userId,
					date: new Date().toISOString().split("T")[0],
					credits: -1,
					reason: "Class Booking",
				},
			]);

			slot.classList.add("confirmed-booking");
			slot.classList.add("pulse-once");
			showToast("Booking successful!");

			const previousScrollY = window.scrollY;

			await renderUserBookings();
			window.scrollTo({ top: previousScrollY, behavior: "instant" });
		});
	}

	// 🟥 Cancel Flow (Bookings View)
	if (inBookingsView) {
		showConfirmation("Cancel booking?", async () => {
			const { error: deleteError } = await supabase
				.from("bookings")
				.delete()
				.eq("user_id", userId)
				.eq("class_id", classId);

			if (deleteError) {
				showToast("Failed to cancel booking: " + deleteError.message, "error");
				return;
			}

			const { error: creditError } = await supabase.from("payments").insert([
				{
					user_id: userId,
					credits: 1,
					reason: "Cancelled booking",
				},
			]);

			if (creditError) {
				showToast(
					"Booking cancelled, but refund failed: " + creditError.message,
					"error"
				);
			} else {
				showToast("Booking cancelled successfully!");
			}

			await renderUserBookings();

			const session2 = await getSession(); // in case logout
			const uid = session2?.user?.id;
			const updatedClasses = await getAvailableClasses({}, uid);
			renderGroupedClassColumns(updatedClasses);
		});
	}
});

/// ADMIN MODAL

// JavaScript to show the modal with dynamic content
async function openAdminModal(cls) {
	const modal = document.getElementById("admin-modal");
	const modalContent = document.getElementById("admin-modal-content");

	modalContent.innerHTML = ""; // clear existing

	const classId = cls.id;
	const className = cls.name;
	const classDate = new Date(cls.date).toLocaleDateString();

	// Fetch bookings
	const { data: bookings, error } = await supabase
		.from("bookings")
		.select("id, user_id, profiles(name, surname)")
		.eq("class_id", classId);

	if (error) {
		console.error("Failed to fetch bookings:", error.message);
		return;
	}

	// Fetch all users
	const { data: users } = await supabase
		.from("profiles")
		.select("id, name, surname");

	// Build modal content
	let html = `<h2>${className}</h2><p>${classDate}</p><ul>`;
	bookings.forEach((b) => {
		html += `<li>${b.profiles.name} ${b.profiles.surname}
			<i class="fa fa-trash remove-user" data-booking-id="${b.id}" data-user-id="${b.user_id}"></i></li>`;
	});
	html += `</ul>`;

	// User dropdown and add button
	html += `
	<select id="user-select">
		<option value="">Select User</option>
		${users
			.map((u) => `<option value="${u.id}">${u.name} ${u.surname}</option>`)
			.join("")}
	</select>
	<button id="add-user-to-class" data-class-id="${classId}">Add to class</button>`;

	// 🔥 Cancel Class Button
	html += `
	<hr>
	<button id="cancel-class" data-class-id="${classId}" style="margin-top: 1rem; background-color: #f44336; color: white;">
		Cancel Class
	</button>`;

	modalContent.innerHTML = html;

	// Animate and show modal
	modal.classList.remove("modal-animate-out");
	modal.style.display = "flex";

	requestAnimationFrame(() => {
		modal.classList.add("modal-animate-in");
	});
}

// Event listeners for modal actions
document.addEventListener("click", async (e) => {
	// Click outside modal closes it
	if (e.target.id === "admin-modal") {
		const modal = document.getElementById("admin-modal");

		modal.classList.remove("modal-animate-in");
		modal.classList.add("modal-animate-out");

		setTimeout(() => {
			modal.style.display = "none";
		}, 300); // Matches the duration of your slideOutToTop animation
	}

	if (e.target.id === "add-user-to-class") {
		const userId = document.getElementById("user-select").value;
		const classId = e.target.dataset.classId;
		if (!userId) return;

		await supabase
			.from("bookings")
			.insert([{ user_id: userId, class_id: classId }]);
		await supabase
			.from("payments")
			.insert([{ user_id: userId, credits: -1, reason: "Class Booking" }]);
		showToast("User added to class!");

		// Refresh modal content
		const { data: refreshedClasses } = await supabase
			.from("classes")
			.select("id, name, description, date, time")
			.eq("id", classId)
			.single();
		if (refreshedClasses) openAdminModal(refreshedClasses);
	}

	if (e.target.classList.contains("remove-user")) {
		if (!confirm("Are you sure you want to remove this user from the class?"))
			return;
		const bookingId = e.target.dataset.bookingId;
		const userId = e.target.dataset.userId;

		await supabase.from("bookings").delete().eq("id", bookingId);
		await supabase
			.from("payments")
			.insert([
				{ user_id: userId, credits: 1, reason: "Admin Cancelled Booking" },
			]);
		showToast("Booking removed and credit refunded");

		// Refresh modal content
		const { data: refreshedClasses } = await supabase
			.from("classes")
			.select("id, name, description, date, time")
			.eq(
				"id",
				e.target.closest("#admin-modal-content").querySelector("#cancel-class")
					.dataset.classId
			)
			.single();
		if (refreshedClasses) openAdminModal(refreshedClasses);
	}

	if (e.target.id === "cancel-class") {
		if (
			!confirm(
				"Are you sure you want to cancel this class and refund all bookings?"
			)
		)
			return;
		const classId = e.target.dataset.classId;

		// Get all bookings for class
		const { data: bookings } = await supabase
			.from("bookings")
			.select("user_id")
			.eq("class_id", classId);

		await supabase.from("bookings").delete().eq("class_id", classId);

		const refunds = bookings.map((b) => ({
			user_id: b.user_id,
			credits: 1,
			reason: "Class Cancelled",
		}));

		await supabase.from("payments").insert(refunds);
		showToast("Class cancelled and all credits refunded");
		document.getElementById("admin-modal").style.display = "none";
	}
});

// ADMIN PANEL

const { data: allClasses } = await supabase
	.from("classes")
	.select("id, name, description, date, time, capacity, booked_slots")
	.order("date", { ascending: true });

renderAdminClassColumns(allClasses);

// Modified version of renderGroupedClassColumns for the admin panel
export async function renderAdminClassColumns(allClasses) {
	const container = document.getElementById("admin-class-container");
	if (!container) return;

	container.innerHTML = "";

	const today = new Date();
	const todayStr = today.toISOString().split("T")[0];

	const startDate = new Date(today);
	startDate.setDate(startDate.getDate() - 40);
	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + 40);

	const allDates = [];
	let current = new Date(startDate);
	while (current <= endDate) {
		allDates.push(current.toISOString().split("T")[0]);
		current.setDate(current.getDate() + 1);
	}

	const grouped = {};
	allClasses.forEach((cls) => {
		const dateKey = cls.date.split("T")[0];
		if (!grouped[dateKey]) grouped[dateKey] = [];
		grouped[dateKey].push(cls);
	});

	allDates.forEach((date) => {
		const dateObj = new Date(date);
		const dayName = dateObj.toLocaleString("default", { weekday: "short" });
		const dayNum = dateObj.getDate();
		const monthName = dateObj.toLocaleString("default", { month: "short" });
		const isToday = date === todayStr;

		const dayContainer = document.createElement("div");
		dayContainer.className = "day-container";
		dayContainer.setAttribute("data-date", date);

		dayContainer.innerHTML = `
			<div class="calendar-header-wrapper">
				<div class="day-header calendar-box ${isToday ? "today-box" : ""}">
					<div class="month">${monthName}</div>
					<div class="day-number">${dayNum}</div>
					<div class="weekday">${dayName}</div>
				</div>
			</div>
			<div class="admin-actions">
				<i class="fa-solid fa-circle-plus admin-icon day-add" data-date="${date}" title="Add new class"></i>
				<i class="fa-solid fa-calendar-plus admin-icon month-generate" data-date="${date}" title="Generate month"></i>
				<i class="fa-solid fa-trash admin-icon day-delete" data-date="${date}" title="Delete day"></i>
			</div>
		`;

		const dayClasses = (grouped[date] || []).sort((a, b) =>
			a.time.localeCompare(b.time)
		);

		dayClasses.forEach((cls) => {
			const slot = document.createElement("div");
			slot.className = "admin-class-slot";
			slot.dataset.classId = cls.id;

			const [hour, minute] = cls.time.split(":");
			const timeObj = new Date();
			timeObj.setHours(parseInt(hour), parseInt(minute));
			const timeFormatted = timeObj.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});

			const classDateTime = new Date(`${cls.date}T${cls.time}`);
			const now = new Date();
			const isPast = classDateTime.getTime() < now.getTime(); // ✅ Define this first

			slot.innerHTML = `
	<div class="card-calendar-col">
		<div class="calendar-month">${new Date(cls.date).toLocaleString("default", {
			month: "short",
		})}</div>
		<div class="calendar-day">${new Date(cls.date).getDate()}</div>
		<div class="calendar-weekday">${new Date(cls.date).toLocaleString("default", {
			weekday: "short",
		})}</div>
	</div>
	<div class="card-info-col ${isPast ? "past-class" : ""}">
		<div class="class-name-row">
			<span class="card-class-name">${cls.name}</span>
			${
				cls.description
					? `<span class="card-class-description">${cls.description}</span>`
					: ""
			}
		</div>
		<div class="card-class-time">${timeFormatted}</div>
	</div>
`;
			slot.addEventListener("click", () => openAdminModal(cls));

			dayContainer.appendChild(slot);
		});

		// 🟧 Add placeholder slots if needed
		const numPlaceholders = 7 - dayClasses.length;
		for (let i = 0; i < numPlaceholders; i++) {
			const placeholder = document.createElement("div");
			placeholder.className = "admin-class-slot admin-slot-placeholder";
			placeholder.innerHTML = `
		<div class="admin-card-calendar-col">
			<div class="admin-calendar-month">${monthName}</div>
			<div class="admin-calendar-day">${dayNum}</div>
			<div class="admin-calendar-weekday">${dayName}</div>
		</div>
		<div class="admin-card-info-col">
			<div class="admin-card-class-name placeholder-text">Open Slot</div>
			<div class="admin-card-time placeholder-text">Placeholder text</div>
		</div>
	`;
			dayContainer.appendChild(placeholder);
		}

		container.appendChild(dayContainer);
		requestAnimationFrame(() => {
			const allDays = container.querySelectorAll(".day-container");
			const scrollTarget = Array.from(allDays).find(
				(day) => day.getAttribute("data-date") === todayStr
			);
			if (scrollTarget) {
				container.scrollTo({
					left: scrollTarget.offsetLeft,
					behavior: "instant",
				});
			}
		});
	});
}

export { renderUserBookings };
