export type Mentor = {
  name: string;
  role: string;
  note: string;
  photo?: string;
};

export const mentors: Mentor[] = [
  {
    name: "Siraj Amin",
    role: "Mentor",
    note:
      "Holds a bachelor's degree in Cybersecurity at Fast University Karachi and teaches at Habib Public High School.",
  },
  {
    name: "M. Ali Abidi",
    role: "Mentor",
    note:
      "Co-founder of Shift Deploy and Babul Tech. Currently completing his studies at the University of Karachi.",
  },
];
