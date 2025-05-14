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
        ${
					userRole === "admin"
						? `

                        <div class="admin-actions" data-date="${date}">
    <i class="fa-solid fa-circle-plus day-add admin-icon" data-date="${date}" title="Add new class to this day"></i>
    <i class="fa-solid fa-calendar-plus month-generate admin-icon" data-date="${date}" title="Generate schedule for this month"></i>
    <i class="fa-solid fa-trash day-delete admin-icon" data-date="${date}" title="Delete all classes on this day"></i>
</div>
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
				slot.style.height = "60px";
				dayContainer.appendChild(slot);
			}
		} else {
			dayClasses.forEach((cls) => {
				const slot = document.createElement("div");
				slot.className = "class-slot";
				slot.dataset.classId = cls.id; // 👈 moved data-class-id to the card itself

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
                <div class="card-content ${isPast ? "past-class" : ""}">
        <div class="card-info">
            <div class="card-top">${cls.name}</div>
			${cls.description ? `<div class="card-description">${cls.description}</div>` : ""}

            <div class="card-bottom">${timeFormatted}</div>
        </div>
    </div>`;

				dayContainer.appendChild(slot);
			});
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
		document.getElementById("classModal").style.display = "block";
		document.getElementById("classModalOverlay").style.display = "block";
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
		const { error: bookingError } = await supabase
			.from("bookings")
			.insert([{ user_id: userId, class_id: classId }]);

		if (bookingError) {
			alert("Booking failed: " + bookingError.message);
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
		showToast("Booking successful!");
		slot.classList.add("pulse-once");

		// alert("Booking successful!");

		await renderUserBookings();
	}

	// 🟥 Cancel Flow (Bookings View)
	if (inBookingsView) {
		const { error: deleteError } = await supabase
			.from("bookings")
			.delete()
			.eq("user_id", userId)
			.eq("class_id", classId);

		if (deleteError) {
			alert("Failed to cancel booking: " + deleteError.message);
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
			alert("Booking cancelled, but refund failed: " + creditError.message);
		} else {
			// alert("Booking cancelled successfully!");
		}

		await renderUserBookings();

		const session2 = await getSession(); // in case logout
		const uid = session2?.user?.id;
		const updatedClasses = await getAvailableClasses({}, uid);
		renderGroupedClassColumns(updatedClasses);
	}
});

export { renderUserBookings };
