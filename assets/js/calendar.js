// calendar.js

import { supabase } from './supabaseClient.js';

import {
  getSession,
  getUserProfile,
  getUserBookings,
  getAvailableClasses,
  isClassBooked,
  groupClassesByDate,
  showToast,
  confirmAction,
  formatDate,
  getUserRole,
  withSpinner,
  showSuccessToast,
  showErrorToast,
} from './utils.js';

import {
  renderAgenda,
  fetchUserRole,
  internalUserRole,
  renderBookedAgenda,
} from './agenda.js';

let viewDate = new Date();
let selectedDate = formatDate(new Date());
let allClasses = [];
export let selectedFilter = null;
export let userBookings = [];
export let groupedByDate = {};

export function setGroupedByDate(newData) {
  groupedByDate = newData;
}

const calendarBody = document.getElementById('calendar');
const monthLabel = document.getElementById('month-label');

function updateMonthLabel() {
  // const options = { year: "numeric", month: "long" };
  const options = { month: 'short' };
  monthLabel.textContent = viewDate.toLocaleDateString('en-US', options);
}

export function populateClassFilter(classList) {
  const filterList = document.getElementById('filter-options');

  // Remove all existing filter options
  filterList.innerHTML = '';

  // Create and append "All" option
  const allOption = document.createElement('li');
  allOption.dataset.value = 'all';
  allOption.textContent = 'All Classes';
  filterList.appendChild(allOption);

  const uniqueNames = [...new Set(classList.map((cls) => cls.name))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  uniqueNames.forEach((name) => {
    const li = document.createElement('li');
    li.dataset.value = name;
    li.textContent = name;
    filterList.appendChild(li);
  });
  console.log(
    '🎯 Final filter list being populated with:',
    classList.map((c) => c.name),
  );
}

// Caching mechanism
const loadedMonths = new Set(); //
export const classCache = {}; //

// Format YYYY-MM string
function getMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

// Fetch classes for a given month if not already loaded
async function fetchClassesForMonth(date) {
  const key = getMonthKey(date);
  if (loadedMonths.has(key)) return;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const firstDay = `${key}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('classes')
    .select('id, name, date, time, description, booked_slots, capacity')
    .gte('date', firstDay)
    .lte('date', lastDay);

  if (error) {
    console.error(`❌ Failed to fetch classes for ${key}:`, error.message);
    return;
  }

  classCache[key] = data;
  loadedMonths.add(key);
  console.log(`📅 Fetching classes between ${firstDay} and ${lastDay}`);

  // Flatten all months to update global state
  allClasses = Object.values(classCache).flat();
  groupedByDate = groupClassesByDate(allClasses);
}

export async function renderCalendar() {
  calendarBody.innerHTML = '';

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();

  const viewMonthDate = new Date(Date.UTC(year, month, 1));
  await fetchClassesForMonth(viewMonthDate);

  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rawOffset = firstDay.getUTCDay();
  const startOffset = (rawOffset + 6) % 7;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    calendarBody.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    const dateObj = new Date(Date.UTC(year, month, day));
    const dateStr = formatDate(dateObj);
    cell.dataset.date = dateStr;

    const number = document.createElement('div');
    number.className = 'day-number';
    number.textContent = day;
    cell.appendChild(number);

    const classes = groupedByDate[dateStr] || [];

    if (classes.length === 0) {
      cell.classList.add('no-classes');
    } else {
      console.log('🔎 selectedFilter:', selectedFilter);
      console.log(
        '📚 Available class names for this day:',
        classes.map((c) => c.name),
      );
      let showDot = false;

      if (getUserRole() === 'admin') {
        showDot = true;
      } else if (selectedFilter === 'all') {
        showDot = true;
      } else if (selectedFilter) {
        showDot = classes.some((cls) => cls.name === selectedFilter);
      }

      if (showDot) {
        cell.classList.add('has-class');
        const dot = document.createElement('div');
        dot.classList.add('dot', 'green-dot');
        cell.appendChild(dot);
      }
    }

    // Marking today logic
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )
      .toISOString()
      .split('T')[0];

    if (dateStr === today) {
      cell.classList.add('is-today');
    }

    if (dateStr === selectedDate) {
      cell.classList.add('selected');
    }

    calendarBody.appendChild(cell);

    cell.addEventListener('click', async () => {
      selectedDate = dateStr;
      await renderCalendar();
      await renderAgenda(dateStr);

      const overlay = document.getElementById('schedule-overlay');

      overlay.scrollTo({
        top: 450,
        behavior: 'smooth',
      });
    });
  }
}

// Chevron calendar

export async function loadCalendar(bookings = []) {
  const now = new Date();
  await fetchClassesForMonth(now);

  allClasses = Object.values(classCache).flat();
  groupedByDate = groupClassesByDate(allClasses);

  // ✅ Defensive fix: ensure all values are class IDs
  userBookings = bookings
    .map((b) => (typeof b === 'object' && b?.class_id ? b.class_id : b))
    .filter(Boolean);

  updateMonthLabel();
  await renderCalendar();
  populateClassFilter(allClasses);
}

export async function goToNextMonth() {
  viewDate.setMonth(viewDate.getMonth() + 1);
  updateMonthLabel();
  await renderCalendar();
}

export async function goToPrevMonth() {
  viewDate.setMonth(viewDate.getMonth() - 1);
  updateMonthLabel();
  await renderCalendar();
}

// Month nav buttons
document.getElementById('next-month').addEventListener('click', async () => {
  await goToNextMonth();
});
document.getElementById('prev-month').addEventListener('click', async () => {
  await goToPrevMonth();
});

const filterButton = document.getElementById('filter-button');
const filterOptions = document.getElementById('filter-options');

filterButton.addEventListener('click', () => {
  filterOptions.classList.toggle('hidden');
});

filterOptions.addEventListener('click', async (e) => {
  const value = e.target.dataset.value;
  if (!value) return;

  selectedFilter = value;

  const label =
    e.target.textContent === 'All' ? 'All Classes' : e.target.textContent;
  filterButton.textContent = `${label}`;
  filterOptions.classList.add('hidden');

  await renderCalendar();
  await renderAgenda(selectedDate);

  const element = document.querySelector('.mainsection');
  const overlay = document.getElementById('schedule-overlay');

  overlay.scrollTo({
    top: element.offsetTop,
    behavior: 'smooth',
  });
});

// Close dropdown when clicking outside

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('filter-options');
  const button = document.getElementById('filter-button');

  const isDropdownOpen = !dropdown.classList.contains('hidden');
  const clickedInsideDropdown = dropdown.contains(e.target);
  const clickedButton = button.contains(e.target);

  // If dropdown is not open, do nothing
  if (!isDropdownOpen) return;

  // If click is outside both the button and the dropdown, close it
  if (!clickedInsideDropdown && !clickedButton) {
    dropdown.classList.add('hidden');
  }
});

// (async () => {
//   setTimeout(() => {
//     document.getElementById('app-loader')?.classList.add('hide');
//   }, 2500);
//   const session = await getSession();
//   const userId = session?.user?.id;

//   const bookings = userId ? await getUserBookings(userId) : [];

//   await loadCalendar(bookings);

//   const initialMonthKey = `${viewDate.getUTCFullYear()}-${String(
//     viewDate.getUTCMonth() + 1,
//   ).padStart(2, '0')}`;
//   const initialClasses = classCache[initialMonthKey] || [];

//   populateClassFilter(initialClasses);
// })();

(async () => {
  setTimeout(() => {
    document.getElementById('app-loader')?.classList.add('hide');
  }, 2500);

  const session = await getSession();
  const userId = session?.user?.id;
  const bookings = userId ? await getUserBookings(userId) : [];

  await loadCalendar(bookings); // ✅ fetches classes + populates allClasses

  // ✅ Now that allClasses is filled, populate the filter
  console.log(
    '🎯 Populating filter with:',
    allClasses.map((c) => c.name),
  );
  //   populateClassFilter(allClasses);
})();

// Refresh calendar slots without rendering calendar again

export function refreshCalendarDots() {
  const cells = document.querySelectorAll('.calendar-cell'); // ✅ Add this line
  cells.forEach((cell) => {
    const dateStr = cell.dataset.date;
    const classes = groupedByDate[dateStr] || [];

    console.log(`📅 ${dateStr}: ${classes.length} classes`);

    // Remove existing dots
    cell.querySelectorAll('.dot').forEach((dot) => dot.remove());

    let showDot = false;

    for (const cls of classes) {
      if (getUserRole() === 'admin') {
        showDot = true;
        // if (cls.booked_slots > 0) {
        // 	showDot = true;
        // 	break;
        // }
      }

      if (selectedFilter === 'all' || cls.name === selectedFilter) {
        showDot = true;
        break;
      }
    }

    if (showDot) {
      cell.classList.add('has-class');
      const dot = document.createElement('div');
      dot.classList.add('dot');

      if (getUserRole() === 'admin') {
        dot.classList.add('admin-dot');
      } else {
        dot.classList.add('green-dot');
      }

      cell.appendChild(dot);
    } else {
    }
  });
}

export async function updateCalendarDots(userId) {
  const now = new Date();

  await forceRefreshClassesForMonth(now);

  if (getUserRole() !== 'admin') {
    userBookings = await getUserBookings(userId);
  } else {
  }

  refreshCalendarDots();
}

export async function refreshCalendarAfterAdminAction() {
  const now = new Date();
  const key = getMonthKey(now);

  // ❌ Remove old cache entry to force fresh fetch
  loadedMonths.delete(key);

  // 🔁 Re-fetch and update global class list
  await fetchClassesForMonth(now);

  allClasses = Object.values(classCache).flat();
  groupedByDate = groupClassesByDate(allClasses);

  // ✅ Refresh the visible dots using updated data
  refreshCalendarDots();
}

// Force Refresh even if classes are already loaded

export async function forceRefreshClassesForMonth(date) {
  const key = getMonthKey(date);

  // 🔁 Remove the cache so the month gets re-fetched
  loadedMonths.delete(key);
  delete classCache[key];

  await fetchClassesForMonth(date);
}

// Click listener on main to close Schedule Overlay

const overlay = document.getElementById('schedule-overlay');

export async function closeOverlay() {
  if (overlay) {
    overlay.classList.remove('active');
    const session = await getSession();
    const userId = session?.user?.id;

    await updateCalendarDots(userId);
    await renderBookedAgenda('#landing-agenda');
    await renderAgenda(selectedDate);
  }
}

// Browse Class Card Click → Trigger Calendar Filter + Open Overlay
const container = document.querySelector('.browseclasses_container');

container.addEventListener('click', (e) => {
  const card = e.target.closest('.browseclasscard');
  if (!card) return;

  // If schedule button was clicked, trigger overlay logic
  if (e.target.classList.contains('open-schedule-btn')) {
    const selectedValue = card.dataset.value;
    const li = document.querySelector(
      `#filter-options li[data-value="${selectedValue}"]`,
    );
    if (li) li.click();

    const overlay = document.getElementById('schedule-overlay');
    overlay.classList.add('active');
    requestAnimationFrame(() => {
      overlay.scrollTop = 0;
    });
    document.getElementById('main').classList.add('no-scroll');

    return;
  }

  // Toggle show-info
  if (card.classList.contains('show-info')) {
    card.classList.remove('show-info');
  } else {
    // Close any others
    document
      .querySelectorAll('.browseclasscard')
      .forEach((c) => c.classList.remove('show-info'));
    card.classList.add('show-info');
  }
});

// Binding the back button to close the schedule overlay

function openScheduleOverlay() {
  const overlay = document.getElementById('schedule-overlay');
  overlay.classList.add('active');
  overlay.scrollTop = 0;

  // Push a fake state so back button triggers `popstate`
  history.pushState({ overlay: true }, '');
}

window.addEventListener('popstate', (event) => {
  const overlay = document.getElementById('schedule-overlay');

  if (overlay.classList.contains('active')) {
    // Close the overlay instead of navigating
    overlay.classList.remove('active');

    // Optional: scroll to top or reset things
    overlay.scrollTop = 0;

    // Don't let it navigate further back
    // We'll handle the history manually
    return;
  }
});

window.addEventListener('load', () => {
  history.pushState({}, ''); // base state
});

window._classCache = classCache;
window._allClasses = allClasses;
