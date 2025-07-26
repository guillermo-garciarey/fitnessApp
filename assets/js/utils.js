import { internalUserRole } from './agenda.js';
import { closeOverlay } from './calendar.js';
import { supabase } from './supabaseClient.js';

// utils.js

export async function fetchAndSetUserRole(supabase) {
  const session = await supabase.auth.getSession();
  const userId = session?.data?.session?.user?.id;
  if (!userId) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', userId)
    .single();

  if (!error && data?.role) {
    userRole = data.role;
    userName = data.name;
  }
}

// Logout Button
document
  .getElementById('logout-session')
  .addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Logout failed:', error.message);
      showToast?.('Logout failed', 'error');
      return;
    }

    showToast?.('Logged out successfully', 'success');

    // Redirect to login or index page
    window.location.href = 'index.html';
  });

export function getUserRole() {
  return internalUserRole;
}

// Get current session
export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    console.error('Session error:', error.message);
  }
  return session;
}

// Get User Profile by ID
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data;
}

// Get All Classes
export async function getAvailableClasses() {
  const { data, error } = await supabase.from('classes').select('*');

  if (error) {
    console.error('Error fetching classes:', error.message);
    return [];
  }

  return data;
}

// Get Bookings for a User
export async function getUserBookings(userId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('class_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching bookings:', error.message);
    return [];
  }

  const result = data.map((b) => b.class_id);
  console.log('📦 getUserBookings →', result);
  return result;
}

// Get All Users (admin use)
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, surname, role');

  if (error) {
    console.error('Error fetching all users:', error.message);
    return [];
  }

  return data;
}

// Get All Bookings (admin use)
export async function getAllBookings() {
  const { data, error } = await supabase.from('bookings').select('*');

  if (error) {
    console.error('Error fetching all bookings:', error.message);
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
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Toast

export function showToast(
  message = 'Yay!',
  type = 'success',
  description = '',
) {
  const toastContainer = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast-entry ${type}-alert`;

  toast.innerHTML = `
		<div class="toast-content">
			<div class="icon-wrapper">
				${type === 'success' ? successIcon() : errorIcon()}
			</div>
			<div class="text-block">
				<p class="title">${message}</p>
				${description ? `<p class="desc">${description}</p>` : ''}
			</div>
		</div>
	`;

  toastContainer.appendChild(toast);

  // Fade and remove after animation duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function successIcon() {
  return `
	<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
		<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
	</svg>`;
}

function errorIcon() {
  return `
	<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
	</svg>`;
}

// Helper Toast functions

export function showSuccessToast() {
  showToast('yay!', 'success', 'Whatever you were doing went alright : )');
}

export function showErrorToast() {
  showToast('aww dang...', 'error', 'Something didn’t go as planned. : (');
}

// Confirmation Modal

export function confirmAction(message, title) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const msg = document.getElementById('confirm-message');
    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');
    const ttl = document.getElementById('confirm-title');

    msg.textContent = message;
    modal.classList.remove('hidden');
    ttl.textContent = title;

    const cleanup = () => {
      modal.classList.add('hidden');
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

// Generate Schedule
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generate-schedule');
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-input');

  console.log('🔍 Button:', generateBtn);
  console.log('🔍 Month select:', monthSelect);
  console.log('🔍 Year select:', yearSelect);

  if (generateBtn && monthSelect && yearSelect) {
    console.log('✅ All elements found, adding click listener');

    generateBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate button clicked');

      const monthIndex = parseInt(monthSelect.value);
      const year = parseInt(yearSelect.value);
      const monthName = monthSelect.options[monthSelect.selectedIndex].text;

      console.log(`📅 Selected: ${monthName} ${year} (index: ${monthIndex})`);

      if (!year || isNaN(monthIndex)) {
        console.warn('⚠️ Invalid month/year selection');
        showErrorToast('Please select a valid month and year.');
        return;
      }

      const monthStart = `${year}-${String(monthIndex + 1).padStart(
        2,
        '0',
      )}-01`;
      const monthEnd = formatDate(new Date(year, monthIndex + 1, 0));

      console.log(
        `📆 Checking for existing schedule between ${monthStart} and ${monthEnd}`,
      );

      const { data: existing, error: checkError } = await supabase
        .from('classes')
        .select('id')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .limit(1);

      if (checkError) {
        console.error('❌ Supabase error:', checkError.message);
        showErrorToast('Error checking existing schedule.');
        return;
      }

      if (existing.length > 0) {
        console.log('🛑 Schedule already exists for that month.');
        showErrorToast('Schedule already exists for this month.');
        return;
      }

      const confirmed = await confirmAction(
        `This will generate a full schedule for ${monthName} ${year}.\n\nAre you sure?`,
        'Generate Schedule',
      );

      if (!confirmed) {
        console.log('❌ User cancelled generation');
        return;
      }

      console.log('✅ Generating schedule...');
      await generateScheduleForMonth(year, monthIndex);
    });
  } else {
    console.warn(
      '⚠️ Could not find one or more required elements. Listener not attached.',
    );
  }
});

// Generate Schedule Function

window.generateScheduleForMonth = async function generateScheduleForMonth(
  year,
  monthIndex,
) {
  const { data: templates, error: templateError } = await supabase
    .from('class_schedule_template')
    .select('*');

  if (templateError) {
    console.error('❌ Template fetch failed:', templateError.message);
    showToast?.('Failed to load schedule templates.', 'error');
    return;
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate(); // ✅ get # days in correct month
  const newClasses = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(Date.UTC(year, monthIndex, day));
    console.log('📆 Date:', dateObj.toISOString(), '→', formatDate(dateObj));

    const dayIndex = dateObj.getDay(); // 0–6 (Sun–Sat)

    const matchingTemplates = templates.filter(
      (t) => Number(t.day_of_week) === dayIndex,
    );

    for (const template of matchingTemplates) {
      const newClass = {
        name: template.name,
        date: formatDate(dateObj),
        time: template.time,
        capacity: template.capacity,
        description: template.description || null,
        image_url: template.image_url || null, // ✅ Add this line
        // trainer: template.trainer || null, // optional
      };

      newClasses.push(newClass);
    }
  }

  console.log(`🧾 Preparing to insert ${newClasses.length} classes`);

  if (newClasses.length === 0) {
    console.warn('⚠️ No classes generated. Investigating why...');
    console.log(`📅 Processed ${daysInMonth} days`);
    console.log(`📋 Loaded ${templates?.length || 0} templates`);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(Date.UTC(year, monthIndex, day));
      const dayIndex = dateObj.getDay();

      const matchingTemplates = templates.filter(
        (t) => Number(t.day_of_week) === dayIndex,
      );

      if (matchingTemplates.length === 0) {
        console.log(
          `🕳️ No templates matched for ${formatDate(dateObj)} (day ${dayIndex})`,
        );
      }
    }

    showErrorToast?.('No classes generated for this month.');
    return;
  }

  const { error: insertError } = await supabase
    .from('classes')
    .insert(newClasses);

  if (insertError) {
    console.error('❌ Insert failed:', insertError.message);
    console.log('🧾 Payload:', newClasses);
    showErrorToast();
  } else {
    showSuccessToast();
  }
};

// Helper function to adjust user credits (for admin use)

export async function adjustUserCredits(userId, delta) {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    console.error('❌ Could not fetch credits:', fetchError?.message);
    return false;
  }

  const newCredits = profile.credits + delta;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', userId);

  if (updateError) {
    console.error('❌ Failed to update credits:', updateError.message);
    return false;
  }

  return true;
}

// Bottom Nav Expand Panel

const navIcons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.panel');

const main = document.getElementById('main');

navIcons.forEach((icon) => {
  icon.addEventListener('click', () => {
    const targetId = icon.dataset.target;
    console.log('Clicked nav icon for:', targetId);

    // if (targetId === "sidebar") {
    // 	console.log("Toggling class 'header-visible' on body");
    // 	document.body.classList.toggle("header-visible");
    // 	return;
    // }

    const targetSection = document.getElementById(targetId);
    if (!targetSection) {
      //   console.warn('Target section not found:', targetId);
      return;
    }

    // Switch active nav icon
    navIcons.forEach((i) => i.classList.remove('active'));
    icon.classList.add('active');

    // Activate the selected panel
    sections.forEach((section) => {
      if (section.id === targetId) {
        section.classList.add('active');

        section.scrollTop = 0;
      } else {
        section.classList.remove('active');
      }
    });

    // Remove sidebar if coming from "four"
    // document.body.classList.remove("header-visible");
  });
});

// Sidebar Nav

const sidebarLinks = document.querySelectorAll('#nav a');

sidebarLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const scheduleoverlay = document.getElementById('schedule-overlay');
    scheduleoverlay.classList.remove('active');
    const main = document.getElementById('main');
    main.classList.remove('no-scroll');
    const targetId = link.dataset.target;
    console.log('Clicked sidebar link for:', targetId);

    const targetSection = document.getElementById(targetId);
    if (!targetSection) {
      console.warn('Target section not found:', targetId);
      return;
    }

    // Switch active sidebar link
    sidebarLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');

    // Also update the icon nav if it's visible
    navIcons.forEach((i) => i.classList.remove('active'));
    const matchingIcon = [...navIcons].find(
      (i) => i.dataset.target === targetId,
    );
    if (matchingIcon) matchingIcon.classList.add('active');

    // Activate the selected panel
    sections.forEach((section) => {
      if (section.id === targetId) {
        section.classList.add('active');
        section.scrollTop = 0;
      } else {
        section.classList.remove('active');
      }
    });

    document.body.classList.remove('header-visible');
  });
});

// Profile generation

export function stringToColor(str) {
  const palette = [
    '#EF4444',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F43F5E',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function showLetterAvatar(name = '', surname = '') {
  const initials = `${name[0] || ''}${surname[0] || ''}`.toUpperCase();
  const bgColor = stringToColor(name + surname);

  const avatarEl = document.getElementById('avatar-preview');
  if (!avatarEl) return;

  const fallback = document.createElement('div');
  fallback.className = 'avatar-placeholder';
  fallback.textContent = initials;
  fallback.style.backgroundColor = bgColor;

  avatarEl.replaceWith(fallback);
}

// Spinner

export async function withSpinner(callback) {
  const spinner = document.getElementById('loading-spinner');
  if (!spinner) return await callback(); // fallback if missing

  spinner.classList.remove('hidden');

  try {
    await callback();
  } finally {
    spinner.classList.add('hidden');
  }
}

// Nav-btn to close schedule

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const overlay = document.getElementById('schedule-overlay');

    if (overlay.classList.contains('active')) {
      closeOverlay();
      const main = document.getElementById('main');
      main.classList.remove('no-scroll');
    } else {
      console.log("Toggling class 'header-visible' on body");
      document.body.classList.toggle('header-visible');
      return;
    }
  });
});

const themeToggle = document.getElementById('theme-switch');
const body = document.body;

// 🔄 Load theme from localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  body.classList.add('darkmode');
}

// 🌗 Toggle theme on click
themeToggle.addEventListener('click', () => {
  body.classList.toggle('darkmode');

  const isDark = body.classList.contains('darkmode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Swipe support to close Nav Menu

const header = document.getElementById('header');

let startX = 0;
let isSwiping = false;

header.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    startX = e.touches[0].clientX;
    isSwiping = true;
  }
});

header.addEventListener('touchmove', (e) => {
  if (!isSwiping) return;

  const currentX = e.touches[0].clientX;
  const deltaX = currentX - startX;

  // Trigger only if swipe is clearly left-to-right
  if (deltaX > 50) {
    isSwiping = false; // prevent repeat trigger
    console.log("Toggling class 'header-visible' on body");
    document.body.classList.toggle('header-visible');
  }
});

header.addEventListener('touchend', () => {
  isSwiping = false;
});
