import { supabase } from "../../assets/js/utils.js";

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

	$titleBar = $(`
		<div id="titleBar">
			<a href="#header" class="toggle"></a>
			<span class="title">${profile.name} ${profile.surname}</span>
		</div>
	`).appendTo($body);

	document.getElementById("logo").textContent = `Hello ${profile.name}`;
}

const container = document.getElementById("class-container");

const { data: classes, error: classError } = await supabase
	.from("classes")
	.select("name, trainer, date, time, capacity, booked_slots")
	.order("date", { ascending: true });

if (classError || !classes) {
	container.innerHTML = "<p>Unable to load classes right now.</p>";
} else {
	renderGroupedClassColumns(classes);
}

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
		const todayStr = today.toISOString().split("T")[0];
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

				slot.innerHTML = `
	<div class="card-content ${isPast ? "past-class" : ""}">
		<div class="card-info">
			<div class="card-top">${cls.name}</div>
			<div class="card-bottom">${timeFormatted}</div>
		</div>
		<i class="fa-solid fa-user-plus book-btn" data-class-id="${
			cls.id
		}" title="Book class"></i>
	</div>
`;
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
