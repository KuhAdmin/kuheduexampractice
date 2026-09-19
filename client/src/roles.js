export const isAdmin = (user) => user?.role === "admin";
export const isModerator = (user) => user?.role === "moderator";
export const isSuperstudent = (user) => user?.role === "superstudent";
export const isTeacher = (user) => user?.role === "teacher";

// superstudentAccessEnabled is a per-account grant an admin can flip for ANY
// user (not just role === "superstudent") -- see AdminUsersPage's per-row
// toggle -- so this checks the flag alone, not the role.
export const hasFullContentAccess = (user) => Boolean(user?.isPremium) || Boolean(user?.superstudentAccessEnabled);
