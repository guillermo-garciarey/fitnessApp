import {
	getAvailableClasses,
	createUserBooking,
	getSession,
	formatPrettyDate,
} from "../../assets/js/utils.js";

const typeSelect = document.getElementById("filter-type");
const container = document.getElementById("class-container");
const scrollLeft = document.querySelector(".scroll-left");
const scrollRight = document.querySelector(".scroll-right");

typeSelect.addEventListener("change", updateFilteredClasses);
document.addEventListener("DOMContentLoaded", updateFilteredClasses);

let userId = null;
(async () => {
	const session = await getSession();
	userId = session?.user?.id;
})();

function getCurrentVisibleDate() {
	const days = Array.from(container.querySelectorAll(".day-container"));
	const containerLeft = container.scrollLeft;
	for (let i = 0; i < days.length; i++) {
		const day = days[i];
		if (day.offsetLeft >= containerLeft) {
			return day.getAttribute("data-date");
		}
	}
	return null;
}

async function updateFilteredClasses() {
	const type = typeSelect.value;
	const filters = {};
	if (type) filters.type = type;

	const allClasses = await getAvailableClasses(filters);
	const classes = type
		? allClasses.filter((cls) => cls.name === type)
		: allClasses;

	renderGroupedClassColumns(allClasses, classes);
}

function renderGroupedClassColumns(
	allClasses,
	filteredClasses,
	visibleDate = null
) {
	container.innerHTML = "";

	const today = new Date();
	const todayStr = today.toISOString().split("T")[0];

	const startDate = new Date(today);
	startDate.setDate(startDate.getDate() - 40);
	startDate.setHours(0, 0, 0, 0);
	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + 40);
	endDate.setHours(23, 59, 59, 999);

	const monthDates = [];
	let current = new Date(startDate);

	while (current <= endDate) {
		monthDates.push(current.toISOString().split("T")[0]);
		current.setDate(current.getDate() + 1);
	}

	const filteredMap = {};
	filteredClasses.forEach((cls) => {
		const dateKey = cls.date.split("T")[0];
		if (!filteredMap[dateKey]) filteredMap[dateKey] = [];
		filteredMap[dateKey].push(cls);
	});

	monthDates.forEach((date) => {
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
`;

		const dayClasses = (filteredMap[date] || []).sort((a, b) =>
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
			for (let i = 0; i < 6; i++) {
				const slot = document.createElement("div");
				slot.className = "class-slot";

				if (dayClasses[i]) {
					const cls = dayClasses[i];
					const classDateTime = new Date(`${cls.date}T${cls.time}`);
					const now = new Date();
					const isPast = classDateTime.getTime() < now.getTime();

					const [hour, minute] = cls.time.split(":");
					const timeObj = new Date();
					timeObj.setHours(parseInt(hour), parseInt(minute));
					const formattedTime = timeObj.toLocaleTimeString([], {
						hour: "numeric",
						minute: "2-digit",
						hour12: true,
					});

					slot.innerHTML = `
  <div class="card-content ${isPast ? "past-class" : ""}">
    <div class="card-info">
      <div class="card-top">${cls.name}</div>
      <div class="card-bottom">${formattedTime}</div>
    </div>
    <i class="fa-solid fa-user-plus book-btn" data-class-id="${
			cls.id
		}" title="Book class"></i>
  </div>
`;
				} else {
					slot.classList.add("empty-slot");
				}

				dayContainer.appendChild(slot);
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

document.addEventListener("click", async (e) => {
	if (e.target.matches(".book-btn")) {
		if (!userId) return alert("Please log in first.");
		const classId = e.target.dataset.classId;
		const { success, error } = await createUserBooking(userId, classId);
		if (success) {
			alert("Booking successful!");
			updateFilteredClasses();
		} else {
			alert(error);
		}
	}
});

scrollLeft.addEventListener("click", () => {
	const day = container.querySelector(".day-container");
	if (!day) return;
	const scrollAmount = day.offsetWidth;
	container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
});

scrollRight.addEventListener("click", () => {
	const day = container.querySelector(".day-container");
	if (!day) return;
	const scrollAmount = day.offsetWidth;
	container.scrollBy({ left: scrollAmount, behavior: "smooth" });
});

document.addEventListener("click", (e) => {
	if (e.target.matches(".day-scroll.scroll-left")) {
		container.scrollBy({ left: -container.offsetWidth, behavior: "smooth" });
	}
	if (e.target.matches(".day-scroll.scroll-right")) {
		container.scrollBy({ left: container.offsetWidth, behavior: "smooth" });
	}
});
