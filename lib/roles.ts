export const roles = ["super_admin", "school_admin", "teacher", "parent", "student", "bursar", "boarding_staff", "admissions_officer"] as const;
export type SchoolRole = typeof roles[number];

export const roleDetails: Record<SchoolRole, { label: string; destination: string }> = {
  super_admin: { label: "Super Administrator", destination: "/portal/admin" },
  school_admin: { label: "School Administrator", destination: "/portal/admin" },
  teacher: { label: "Teacher", destination: "/portal/teacher" },
  parent: { label: "Parent or Guardian", destination: "/portal/parent" },
  student: { label: "Student", destination: "/portal/student" },
  bursar: { label: "Bursar", destination: "/portal/bursar" },
  boarding_staff: { label: "Boarding Staff", destination: "/portal/boarding" },
  admissions_officer: { label: "Admissions Officer", destination: "/portal/admissions_officer" },
};
