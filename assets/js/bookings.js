import { supabase, getSession } from "./utils.js";
import { renderUserBookings, refreshAvailableClasses } from "./dashboard.js";

let userId = null;

(async () => {
	const session = await getSession();
	userId = session?.user?.id;
	console.log("userId at load:", userId);
})();
