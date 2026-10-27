export const SCHOOL_CLASSES = ["IX", "X", "XI", "XII"] as const;

export type SchoolClass = (typeof SCHOOL_CLASSES)[number];

export type StudySelection = {
  classLevel: SchoolClass;
  subjectSlug: string;
};

export const CURRICULUM: Record<SchoolClass, readonly string[]> = {
  IX: [
    "Computer Science",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
  ],
  X: [
    "Computer Science",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
  ],
  XI: ["Computer Science", "Mathematics", "Physics", "Statistics"],
  XII: ["Computer Science", "Mathematics", "Physics", "Statistics"],
};

export function subjectSlug(subject: string): string {
  return subject.toLowerCase().replace(/\s+/g, "-");
}

export function subjectLabel(subjectSlugValue: string): string | null {
  const normalizedSlug = subjectSlugValue.toLowerCase();
  for (const subjects of Object.values(CURRICULUM)) {
    const subject = subjects.find(
      (candidate) => subjectSlug(candidate) === normalizedSlug,
    );
    if (subject) return subject;
  }
  return null;
}

export function classLevelToGrade(classLevel: "XI"): 11;
export function classLevelToGrade(classLevel: "XII"): 12;
export function classLevelToGrade(classLevel: SchoolClass): 9 | 10 | 11 | 12;
export function classLevelToGrade(classLevel: SchoolClass): 9 | 10 | 11 | 12 {
  switch (classLevel) {
    case "IX":
      return 9;
    case "X":
      return 10;
    case "XI":
      return 11;
    case "XII":
      return 12;
  }
}

export function gradeToClassLevel(grade: number): SchoolClass | null {
  switch (grade) {
    case 9:
      return "IX";
    case 10:
      return "X";
    case 11:
      return "XI";
    case 12:
      return "XII";
    default:
      return null;
  }
}

export function isSchoolClass(value: string): value is SchoolClass {
  return SCHOOL_CLASSES.some((schoolClass) => schoolClass === value.toUpperCase());
}

export function parseStudySelection(
  classValue: string | null,
  subjectValue: string | null,
): StudySelection | null {
  if (!classValue || !subjectValue) return null;

  const classLevel = classValue.replace(/^class\s+/i, "").toUpperCase();
  if (!isSchoolClass(classLevel)) return null;

  const subject = subjectLabel(subjectValue);
  if (!subject || !CURRICULUM[classLevel].includes(subject)) return null;

  return { classLevel, subjectSlug: subjectSlug(subject) };
}

export function selectionHref(
  path: string,
  selection: StudySelection,
): string {
  const params = new URLSearchParams({
    class: selection.classLevel,
    subject: selection.subjectSlug,
  });
  return `${path}?${params.toString()}`;
}
