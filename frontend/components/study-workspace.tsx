
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Atom,
  BarChart3,
  BookOpen,
  ChartColumn,
  Check,
  ClipboardCheck,
  CodeXml,
  Copy,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  Newspaper,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  Calculator,
} from "lucide-react";
import {
  classLevelToGrade,
  CURRICULUM,
  parseStudySelection,
  selectionHref,
  subjectLabel,
  subjectSlug as toSubjectSlug,
  type SchoolClass,
  type StudySelection,
} from "../lib/curriculum";
import { useSelection } from "../lib/selection-context";
type Paper2Question = {
  question_number: number;
  question_part: string | null;
  question_text: string;
  marks: number;
  source_page: number | null;
  paper: string;
  source_type: string;
};
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  paper2_questions?: Paper2Question[];
};

const ANSWER_VERIFICATION_LABEL =
  /^(Textbook-Based Answer|AI Knowledge\s*[-—]\s*Not Verified in Textbook)\s*:?[ \t]*(?:\r?\n)?/i;

function splitAnswerVerification(content: string) {
  const match = ANSWER_VERIFICATION_LABEL.exec(content);

  return match
    ? {
        label: /^AI Knowledge/i.test(match[1])
          ? "AI Knowledge — Not Verified in Textbook"
          : match[1],
        answer: content.slice(match[0].length),
      }
    : { label: null, answer: content };
}

function renderAssistantAnswer(content: string) {
  const { label, answer } = splitAnswerVerification(content);

  return (
    <>
      {label && (
        <span className="mb-2 block font-semibold">
          {label}
        </span>
      )}
      <ReactMarkdown>
  {answer.replace(/\\\r?\n/g, "\n\n")}
</ReactMarkdown>
    </>
  );
}

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type SLO = {
  slo_code: string;
  topic: string;
  topic_title?: string;
  statement: string;
  page: number | null;
};

type Chapter = {
  chapter: number;
  title: string;
  slos: SLO[];
};

type ModelPaperMCQ = {
  id: number;
  question_number: number;
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  source_page: number | null;
  model_year: number;
  paper: string;
  slo_code: string;
};

type ChaptersResponse = {
  total_chapters: number;
  total_slos: number;
  chapters: Chapter[];
};

const STORAGE_KEY = "aku-learn-chats";
const ACTIVE_KEY = "aku-learn-active-chat";
const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fltaxhryfwthjlvltffr.supabase.co"
).replace(/\/$/, "");
const SUPABASE_FUNCTIONS_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ||
  `${SUPABASE_URL}/functions/v1`
).replace(/\/$/, "");
const LOCAL_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? process.env.NEXT_PUBLIC_LOCAL_API_URL
    : undefined;
const CHAPTERS_API_URL =
  process.env.NEXT_PUBLIC_CHAPTERS_API_URL ||
  `${SUPABASE_FUNCTIONS_URL}/chapters`;
const AI_CHAT_API_URL = `${SUPABASE_FUNCTIONS_URL}/ai-chat`;
const QUIZ_API_URL = `${SUPABASE_FUNCTIONS_URL}/quiz`;
const CS_CHAPTERS = {
  11: [
    { name: "Computing Systems", page: 10 },
    { name: "Computational Thinking and Algorithm", page: 14 },
    { name: "Programming Fundamentals (Python)", page: 15 },
    { name: "Data and Analysis", page: 20 },
    { name: "Applications of Computer Science", page: 21 },
    { name: "Impacts of Computing", page: 23 },
    { name: "Digital Literacy", page: 25 },
    { name: "Entrepreneurship in the Digital Age", page: 26 },
  ],
  12: [
    { name: "Computing Systems", page: 27 },
    { name: "Computational Thinking and Algorithm", page: 28 },
    { name: "Programming Fundamentals (Python)", page: 29 },
    { name: "Data and Analysis", page: 33 },
    { name: "Applications of Computer Science", page: 34 },
    { name: "Impacts of Computing", page: 35 },
    { name: "Digital Literacy", page: 37 },
    { name: "Entrepreneurship in the Digital Age", page: 38 },
  ],
};

const GRADE_12_CHAPTER_TITLES: Record<number, string> = {
  9: "Computing Systems",
  10: "Computational Thinking and Algorithm",
  11: "Programming Fundamentals (Python)",
  12: "Data and Analysis",
  13: "Applications of Computer Science",
  14: "Impacts of Computing",
  15: "Digital Literacy",
  16: "Entrepreneurship in the Digital Age",
};

const MATHEMATICS_CHAPTER_TITLES: Record<11 | 12, Record<number, string>> = {
  11: {
    1: "Complex Numbers",
    2: "Matrices and Determinants",
    3: "Sequence and Series",
    4: "Miscellaneous Series",
    5: "Permutation and Combination",
    6: "Mathematical Induction and Binomial Theorem",
    7: "Factor and Remainder Theorems",
    8: "Trigonometric Identities",
    9: "Trigonometric Functions and their Graphs",
    10: "Inverse Trigonometric Functions and Trigonometric Equations",
    11: "Vectors",
  },
  12: {
    12: "Straight Line",
    13: "Functions and Limits",
    14: "Differentiation",
    15: "Higher Order Derivatives and their Applications",
    16: "Vector Differentiation",
    17: "Integration",
    18: "Numerical Solution of Nonlinear Equations",
    19: "Circles",
    20: "Parabola",
    21: "Ellipse",
    22: "Hyperbola",
    23: "MAPLE",
  },
};

const STATISTICS_CHAPTER_TITLES: Record<11 | 12, Record<number, string>> = {
  11: {
    1: "Introduction to Statistics",
    2: "Presentation of Statistical Data",
    3: "Measures of Central Tendency",
    4: "Measures of Dispersion",
    5: "Index Numbers",
    6: "Time-Series",
    7: "Regression and Correlation",
  },
  12: {
    8: "Counting Techniques",
    9: "Probability",
    10: "Random Variables",
    11: "Probability Distributions",
    12: "Sampling and Sampling Distributions",
    13: "Estimation",
    14: "Statistical Inference",
  },
};

const PHYSICS_CHAPTER_TITLES: Record<11 | 12, Record<number, string>> = {
  11: {
    1: "Physical Quantities and Measurement",
    2: "Scalars and Vectors",
    3: "Motion in One Dimension",
    4: "Motion in Two Dimensions",
    5: "Deformation in Solids",
    6: "Fluids Dynamics",
    7: "Oscillations",
    8: "Waves",
    9: "Physical Optics",
    10: "Thermodynamics",
  },
  12: {
    11: "Gravitation",
    12: "Electrostatics",
    13: "Electric Current",
    14: "Electromagnetism",
    15: "Electromagnetic Induction and Alternating Current",
    16: "Quantum Mechanics",
    17: "Nuclear Physics",
    18: "Particle Physics",
    19: "Medical and Space Physics",
    20: "Nature of Science",
  },
};

const STUDY_SUBJECTS = [
  { id: "computer-science", name: "Computer Science", icon: CodeXml },
  { id: "mathematics", name: "Mathematics", icon: Calculator },
  { id: "statistics", name: "Statistics", icon: ChartColumn },
  { id: "physics", name: "Physics", icon: Atom },
] as const;

const SLO_SUBJECTS = [
  {
    id: "computer-science",
    name: "Computer Science",
    icon: CodeXml,
    file: "/akueb-computer-science.pdf",
    pages: { 11: 10, 12: 27 },
  },
  {
    id: "mathematics",
    name: "Mathematics",
    icon: Calculator,
    file: "/mathematics-syllabus.pdf",
    pages: { 11: 10, 12: 28 },
  },
  {
    id: "statistics",
    name: "Statistics",
    icon: ChartColumn,
    file: "/statistics-syllabus.pdf",
    pages: { 11: 10, 12: 22 },
  },
  {
    id: "physics",
    name: "Physics",
    icon: Atom,
    file: "/physics-syllabus.pdf",
    pages: { 11: 10, 12: 28 },
  },
] as const;

function getStudyChapterTitle(
  subject: (typeof STUDY_SUBJECTS)[number]["id"],
  grade: 11 | 12,
  chapter: Chapter
) {
  const subjectTitle =
    subject === "mathematics"
      ? MATHEMATICS_CHAPTER_TITLES[grade]?.[chapter.chapter]
      : subject === "statistics"
        ? STATISTICS_CHAPTER_TITLES[grade]?.[chapter.chapter]
        : subject === "physics"
          ? PHYSICS_CHAPTER_TITLES[grade]?.[chapter.chapter]
      : subject === "computer-science" && grade === 12
        ? GRADE_12_CHAPTER_TITLES[chapter.chapter]
        : subject === "computer-science" && grade === 11
          ? CS_CHAPTERS[11][chapter.chapter - 1]?.name
        : undefined;
  const title = subjectTitle ?? chapter.title;

  return title === `Chapter ${chapter.chapter}`
    ? title
    : `Chapter ${chapter.chapter}: ${title}`;
}

type WorkspaceProps = {
  initialView?: "chat" | "study" | "slos" | "quiz";
  initialClassLevel: Extract<SchoolClass, "XI" | "XII">;
  initialSubjectSlug: string;
};

export default function StudyWorkspace({
  initialView = "chat",
  initialClassLevel,
  initialSubjectSlug,
}: WorkspaceProps) {
  const { setSelection } = useSelection();
  const initialSubject = initialSubjectSlug;
const initialGrade = classLevelToGrade(initialClassLevel);
  const [question, setQuestion] = useState("");
  const [marks, setMarks] = useState("2");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
const [view, setView] = useState<"chat" | "study" | "slos" | "quiz">(
  initialView,
);
  const [classLevel, setClassLevel] = useState<Extract<SchoolClass, "XI" | "XII">>(
    initialClassLevel,
  );
  const [selectionSubjectSlug, setSelectionSubjectSlug] = useState(
    initialSubjectSlug,
  );
  const [changeSelectionOpen, setChangeSelectionOpen] = useState(false);
  const [selectedSloSubject, setSelectedSloSubject] = useState<string | null>(
    initialView === "slos" &&
        SLO_SUBJECTS.some((subject) => subject.id === initialSubjectSlug)
      ? initialSubjectSlug
      : null,
  );
  const [selectedSloGrade, setSelectedSloGrade] =
  useState<11 | 12 | null>(
    initialView === "slos"
      ? (initialClassLevel === "XI" ? 11 : 12)
      : null,
  );
  const [selectedSloChapterPage, setSelectedSloChapterPage] =
  useState<number | null>(null);
  const [sloFullscreen, setSloFullscreen] = useState(false);
  const [selectedStudyChapter, setSelectedStudyChapter] = useState<number | null>(null);
  const [studyChapters, setStudyChapters] = useState<Chapter[]>([]);
  const [studyChaptersLoading, setStudyChaptersLoading] = useState(false);
  const [studyChaptersError, setStudyChaptersError] = useState("");
  const [studyChaptersRetry, setStudyChaptersRetry] = useState(0);
  const [relatedModelQuestions, setRelatedModelQuestions] = useState<ModelPaperMCQ[]>([]);
  const [relatedModelQuestionsLoading, setRelatedModelQuestionsLoading] = useState(false);
  const [relatedModelQuestionsError, setRelatedModelQuestionsError] = useState("");
  const [selectedQuizQuestionId, setSelectedQuizQuestionId] = useState<number | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestInFlight = useRef(false);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const messages = activeChat?.messages ?? [];

  const studyGrade: 11 | 12 = classLevel === "XI" ? 11 : 12;
  const studySubject =
    STUDY_SUBJECTS.find((subject) => subject.id === selectionSubjectSlug)?.id ??
    "computer-science";

  const studyCurrentChapter = studyChapters.find(
    (chapter) => chapter.chapter === selectedStudyChapter
  );
  const currentChapter = studyCurrentChapter;

  useEffect(() => {
    const controller = new AbortController();

    async function loadRelatedModelQuestions() {
      if (view !== "study" || !currentChapter) {
        setRelatedModelQuestions([]);
        setRelatedModelQuestionsError("");
        setRelatedModelQuestionsLoading(false);
        return;
      }

      const sloCodes = currentChapter.slos.map((slo) => slo.slo_code);
      setRelatedModelQuestions([]);
      setRelatedModelQuestionsError("");
      setRelatedModelQuestionsLoading(true);

      try {
        const response = await fetch(QUIZ_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "for_slos", slo_codes: sloCodes }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Unable to load related model-paper questions (${response.status}).`);
        }

        const data: { questions?: ModelPaperMCQ[] } = await response.json();
        const chapterSloCodes = new Set(sloCodes);

        setRelatedModelQuestions(
          (data.questions ?? []).filter(
            (question) =>
              chapterSloCodes.has(question.slo_code) &&
              Number.isSafeInteger(question.id) &&
              Number.isSafeInteger(question.question_number) &&
              Number.isSafeInteger(question.model_year)
          )
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        setRelatedModelQuestionsError(
          error instanceof Error
            ? error.message
            : "Unable to load related model-paper questions."
        );
      } finally {
        if (!controller.signal.aborted) {
          setRelatedModelQuestionsLoading(false);
        }
      }
    }

    void loadRelatedModelQuestions();

    return () => controller.abort();
  }, [currentChapter, view]);

  // Load existing saved chat history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const active = localStorage.getItem(ACTIVE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const validChats = parsed.filter(
            (item): item is Chat =>
              item !== null &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              Array.isArray(item.messages)
          );

          setChats(validChats);

          if (validChats.some((chat) => chat.id === active)) {
            setActiveChatId(active);
          }
        }
      }
    } catch {
      console.error("Could not load chat history.");
    }

    setHistoryLoaded(true);
  }, []);

  // Preserve the same localStorage keys as Step 3
  useEffect(() => {
    if (!historyLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));

      if (activeChatId) {
        localStorage.setItem(ACTIVE_KEY, activeChatId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch {
      console.error("Could not save chat history.");
    }
  }, [chats, activeChatId, historyLoaded]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudyChapters() {
      if (view !== "study") {
        return;
      }

      setStudyChaptersLoading(true);
      setStudyChaptersError("");
      setStudyChapters([]);
      setSelectedStudyChapter(null);

      const requestParams = {
        grade: studyGrade,
        subject: studySubject,
      };
      const requestUrl = new URL(CHAPTERS_API_URL, window.location.origin);
      requestUrl.searchParams.set("grade", String(requestParams.grade));
      requestUrl.searchParams.set("subject", requestParams.subject);
      let status: number | null = null;
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        status = response.status;

        if (!response.ok) {
          throw new Error(`Unable to fetch study chapters (HTTP ${response.status}).`);
        }

        const data: ChaptersResponse = await response.json();
        const nextChapters = data.chapters ?? [];
        setStudyChapters(nextChapters);

        if (nextChapters.length > 0) {
          setSelectedStudyChapter((current) =>
            current && nextChapters.some((chapter) => chapter.chapter === current)
              ? current
              : nextChapters[0].chapter
          );
        } else {
          setSelectedStudyChapter(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setStudyChapters([]);
        setStudyChaptersError(
          "Could not load this syllabus. Check that the study data service is running."
        );
        if (process.env.NODE_ENV === "development") {
          console.error("Study chapter request failed.", {
            url: requestUrl.toString(),
            params: requestParams,
            status,
            error,
          });
        }
      } finally {
        if (!controller.signal.aborted) setStudyChaptersLoading(false);
      }
    }

    void loadStudyChapters();
    return () => controller.abort();
  }, [studyGrade, studySubject, studyChaptersRetry, view]);

  // Automatically scroll to newest chat message
  useEffect(() => {
    if (view !== "chat" || messages.length === 0) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading, activeChatId, view]);

  async function askAI(customQuestion?: string) {
    const text = (customQuestion ?? question).trim();

    if (!text || requestInFlight.current || !historyLoaded) return;

    requestInFlight.current = true;
    setLoading(true);
    setView("chat");
    setSidebarOpen(false);

    const chatId = activeChatId ?? crypto.randomUUID();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: `${text.replace(/\s*\(\s*\d+\s*marks?\s*\)/gi, "").trim()} (${marks} marks)`,
    };

    setChats((prev) => {
      const existing = prev.some((chat) => chat.id === chatId);

      if (existing) {
        return prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, userMessage],
              }
            : chat
        );
      }

      return [
        {
          id: chatId,
          title: text.length > 40 ? `${text.slice(0, 40)}...` : text,
          messages: [userMessage],
        },
        ...prev,
      ];
    });

    setActiveChatId(chatId);
    setQuestion("");

    try {
      const response = await fetch(AI_CHAT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  question: text,
  marks,
  grade: classLevel === "XI" ? 11 : 12,
  subject: selectionSubjectSlug,
  history: (
            chats.find((chat) => chat.id === chatId)?.messages ?? []
          )
            .slice(-10)
            .map((message) => ({
              role: message.role,
              content:
                message.role === "assistant" &&
                message.paper2_questions?.length
                  ? `${message.content}

RELATED OFFICIAL MODEL PAPER II QUESTIONS:
${message.paper2_questions
  .map(
    (q) =>
      `Question ${q.question_number}${q.question_part ? `(${q.question_part})` : ""} (${q.marks} marks): ${q.question_text}`
  )
  .join("\n")}`
                  : message.content,
            })),
        }),
      });

     if (!response.ok) {
  if (response.status === 429) {
    throw new Error("AI is temporarily busy. Please try again shortly.");
  }

  throw new Error(`API error: ${response.status}`);
}

      const data = await response.json();

      const aiMessage: Message = {
  id: crypto.randomUUID(),
  role: "assistant",
  content: data.answer || "No answer received.",
  paper2_questions: Array.isArray(data.paper2_questions)
    ? data.paper2_questions
    : [],
};

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, aiMessage],
              }
            : chat
        )
      );
   } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
  error instanceof Error &&
  error.message === "AI is temporarily busy. Please try again shortly."
    ? error.message
    : "Unable to connect to Babul Learn AI. Please check the backend server.",
      };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, errorMessage],
              }
            : chat
        )
      );
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function newChat() {
    if (requestInFlight.current) return;

    setActiveChatId(null);
    setQuestion("");
    setView("chat");
    setSidebarOpen(false);
    setEditingChatId(null);
  }

  function openChat(id: string) {
    if (requestInFlight.current) return;

    setActiveChatId(id);
    setView("chat");
    setQuestion("");
    setSidebarOpen(false);
    setEditingChatId(null);
  }

  function persistSelection(nextSelection: StudySelection) {
    const parsedSelection = parseStudySelection(
      nextSelection.classLevel,
      nextSelection.subjectSlug,
    );
    if (!parsedSelection) {
      throw new Error("Cannot apply an invalid class and subject selection.");
    }

    setClassLevel(parsedSelection.classLevel as Extract<SchoolClass, "XI" | "XII">);
    setSelectionSubjectSlug(parsedSelection.subjectSlug);
    setSelectedStudyChapter(null);
    setSelectedSloSubject(parsedSelection.subjectSlug);
    setSelectedSloGrade(
  parsedSelection.classLevel === "XI" ? 11 :
  parsedSelection.classLevel === "XII" ? 12 : null
);
    setSelectedQuizQuestionId(null);
    setSelection(parsedSelection);
    window.history.replaceState(
      null,
      "",
      selectionHref(window.location.pathname, parsedSelection),
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function changeClassLevel(value: string) {
    if (value !== "XI" && value !== "XII") return;
    const currentSubject = subjectLabel(selectionSubjectSlug);
    const nextSubject = currentSubject &&
        CURRICULUM[value].includes(currentSubject)
      ? currentSubject
      : CURRICULUM[value][0];
    persistSelection({
      classLevel: value,
      subjectSlug: toSubjectSlug(nextSubject),
    });
  }

  function changeSubject(value: string) {
    const selection = parseStudySelection(classLevel, value);
    if (selection) persistSelection(selection);
  }

function closeSLOs() {
  setSelectedSloGrade(null);
  setSelectedSloSubject(null);
  setView("chat");
}

  function openStudy() {
    if (requestInFlight.current) return;

    setSelectedStudyChapter(null);
    setView("study");
    setSidebarOpen(false);
  }

  function practiceModelQuestion(questionId: number) {
    setSelectedQuizQuestionId(questionId);
    setView("quiz");
    setSidebarOpen(false);
  }

  function practiceSLO(slo: SLO, subject = "Computer Science") {
    if (requestInFlight.current) return;

    // Explicitly reference the real SLO in the question.
    // Existing backend SLO matching remains unchanged.
    const prompt =
      `Explain this ${subject} learning outcome ` +
      `in an exam-style answer: ${slo.statement} ` +
      `(SLO ${slo.slo_code}).`;

    void askAI(prompt);
  }

  function startRename(chat: Chat) {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  }

  function saveRename(id: string) {
    const title = editTitle.trim();

    if (title) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === id ? { ...chat, title } : chat
        )
      );
    }

    setEditingChatId(null);
    setEditTitle("");
  }

  function deleteChat(id: string) {
    if (requestInFlight.current) return;

    if (!window.confirm("Delete this chat permanently?")) return;

    setChats((prev) => prev.filter((chat) => chat.id !== id));

    if (activeChatId === id) {
      setActiveChatId(null);
    }

    if (editingChatId === id) {
      setEditingChatId(null);
    }
  }

  async function copyAnswer(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === message.id ? null : current
        );
      }, 2000);
    } catch {
      alert("Could not copy the answer.");
    }
  }

  function handleQuestionKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void askAI();
    }
  }

  return (
    <div className="babul-app flex h-dvh bg-white text-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/30"
          aria-label="Close sidebar"
        />
      )}

{/* Sidebar */}
<aside
  aria-label="Main navigation"
  className={`${
    sidebarOpen ? "flex" : "hidden"
  } babul-sidebar fixed inset-y-0 left-0 z-30 flex-col`}
>
        <div className="babul-brand flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/babul-learn-logo.png"
              alt="Babul Tech logo"
              width={46}
              height={46}
              priority
            />
            <div>
              <h1 className="text-lg font-bold">Babul Learn</h1>
              <p>Your AI study companion</p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="babul-sidebar-close rounded-lg p-2 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <button
          onClick={newChat}
          disabled={loading}
          className="babul-new-chat"
        >
          <Plus size={18} strokeWidth={2} />
          New chat
        </button>

{/* Class and Subject Switcher */}
<div className="mx-4 mt-4 rounded-xl border border-emerald-400/20 bg-white/5 p-3">
  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-300">
    Your Study Selection
  </p>

  <div className="space-y-3">
    <div>
      <label
        htmlFor="sidebar-class"
        className="mb-1 block text-xs font-medium text-slate-300"
      >
        Class
      </label>
      <select
        id="sidebar-class"
        value={classLevel}
        onChange={(event) => changeClassLevel(event.target.value)}
        disabled={loading}
        className="w-full cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400"
      >
        <option value="XI">Class XI</option>
        <option value="XII">Class XII</option>
      </select>
    </div>

    <div>
      <label
        htmlFor="sidebar-subject"
        className="mb-1 block text-xs font-medium text-slate-300"
      >
        Subject
      </label>
      <select
        id="sidebar-subject"
        value={selectionSubjectSlug}
        onChange={(event) => changeSubject(event.target.value)}
        disabled={loading}
        className="w-full cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400"
      >
        {CURRICULUM[classLevel].map((subject) => (
          <option key={subject} value={toSubjectSlug(subject)}>
            {subject}
          </option>
        ))}
      </select>
    </div>
  </div>
</div>

        <nav className="babul-nav mt-3 flex flex-col gap-1" aria-label="Study navigation">
          <Link
            href={selectionHref("/chat", {
              classLevel,
              subjectSlug: selectionSubjectSlug,
            })}
            onClick={() => setSidebarOpen(false)}
            className={`babul-nav-item ${view === "chat" ? "is-active" : ""}`}
          >
            <span className="babul-icon-tile"><MessageSquare size={18} /></span>
            Ask a question
          </Link>
          <Link
            href={selectionHref("/chapters", {
              classLevel,
              subjectSlug: selectionSubjectSlug,
            })}
            onClick={() => setSidebarOpen(false)}
            className={`babul-nav-item ${view === "study" ? "is-active" : ""}`}
          >
            <span className="babul-icon-tile"><BookOpen size={18} /></span>
            Study by chapter
          </Link>
          <Link
            href={selectionHref("/slos", {
              classLevel,
              subjectSlug: selectionSubjectSlug,
            })}
            onClick={() => setSidebarOpen(false)}
            className={`babul-nav-item ${view === "slos" ? "is-active" : ""}`}
          >
            <span className="babul-icon-tile"><ClipboardCheck size={18} /></span>
            Learning outcomes (SLOs)
          </Link>
          <Link
            href={selectionHref("/practice", {
              classLevel,
              subjectSlug: selectionSubjectSlug,
            })}
            onClick={() => setSidebarOpen(false)}
            className={`babul-nav-item ${view === "quiz" ? "is-active" : ""}`}
          >
            <span className="babul-icon-tile"><BarChart3 size={18} /></span>
            MCQ Practice
          </Link>
          <Link
            href={selectionHref("/past-papers", {
              classLevel,
              subjectSlug: selectionSubjectSlug,
            })}
            onClick={() => setSidebarOpen(false)}
            className="babul-nav-item"
          >
            <span className="babul-icon-tile"><Newspaper size={18} /></span>
            Past Papers
          </Link>
        </nav>
        <div className="babul-recent-chats mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-400">
            Recent chats
          </p>

          {!historyLoaded ? (
            <p className="text-sm text-slate-500">Loading chats...</p>
          ) : chats.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved chats yet.
            </p>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`rounded-xl p-1 ${
                    view === "chat" && activeChatId === chat.id
                      ? "is-active"
                      : ""
                  }`}
                >
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(chat.id);
                          if (e.key === "Escape") {
                            setEditingChatId(null);
                          }
                        }}
                        className="babul-rename-input min-w-0 flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                        aria-label="New chat title"
                      />

                      <button
                        onClick={() => saveRename(chat.id)}
                        className="babul-chat-action p-2"
                        aria-label="Save chat name"
                      >
                        <Check size={16} />
                      </button>

                      <button
                        onClick={() => setEditingChatId(null)}
                        className="babul-chat-action p-2"
                        aria-label="Cancel rename"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openChat(chat.id)}
                        disabled={loading}
                        className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm disabled:opacity-50"
                        title={chat.title}
                      >
                        <span className="babul-recent-title">
                          <MessageSquare size={16} />
                          <span>{chat.title}</span>
                        </span>
                      </button>

                      <button
                        onClick={() => startRename(chat)}
                        disabled={loading}
                        className="babul-chat-action shrink-0 p-2 disabled:opacity-50"
                        aria-label={`Rename ${chat.title}`}
                        title="Rename chat"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => deleteChat(chat.id)}
                        disabled={loading}
                        className="babul-chat-action shrink-0 p-2 disabled:opacity-50"
                        aria-label={`Delete ${chat.title}`}
                        title="Delete chat"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="babul-profile mt-4">
          <span className="babul-avatar" aria-hidden="true">B</span>
          <div>
            <p>Grade 12</p>
            <span>Computer Science</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="babul-header flex h-16 shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
           <button
  type="button"
  onClick={() => setSidebarOpen((open) => !open)}
  className="babul-mobile-menu"
  aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
  aria-expanded={sidebarOpen}
>
  <Menu size={20} />
</button>

            <h2 className="font-semibold">
             {view === "study"
  ? "Study by Chapter"
  : view === "slos"
    ? "View SLOs"
    : "Babul Learn AI"}
            </h2>
          </div>

          <span className="babul-status">
            {STUDY_SUBJECTS.find((subject) => subject.id === initialSubject)?.name ??
              "Computer Science"}{" "}
            <span aria-hidden="true">·</span> Grade {initialGrade}
          </span>
        </header>
{view === "quiz" ? (
  <iframe
    src={`/quiz?grade=${initialGrade}&subject=${initialSubject}${
      selectedQuizQuestionId === null ? "" : `&questionId=${selectedQuizQuestionId}`
    }`}
    title="MCQ Practice "
    className="min-h-0 w-full flex-1 border-0"
  />
) : view === "slos" ? (
  
  <div className="flex min-h-0 flex-1 flex-col bg-slate-50">

    <div className="flex items-center justify-between border-b bg-white px-5 py-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          View SLOs
        </h2>
        <p className="text-sm text-slate-500">
          {selectedSloGrade === null
            ? "Select your year"
            : selectedSloSubject === null
              ? `Grade ${selectedSloGrade} — Select subject`
              : `Grade ${selectedSloGrade} — ${
                  SLO_SUBJECTS.find(
                    (s) => s.id === selectedSloSubject
                  )?.name
                }`}
        </p>
      </div>

      <button
        type="button"
        onClick={closeSLOs}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100"
      >
        <X className="mr-1 inline" size={16} />
        Close SLOs
      </button>
    </div>

   {selectedSloGrade === null ? (
  <div className="grid gap-4 p-6 sm:grid-cols-2">
    <button
      type="button"
      onClick={() => setSelectedSloGrade(11)}
      className="rounded-xl border bg-white p-6 text-left shadow-sm hover:border-blue-500 hover:bg-blue-50"
    >
      <span className="babul-icon-tile"><BookOpen size={18} /></span>
      <h3 className="mt-3 text-xl font-bold text-slate-900">
        1st Year
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Grade XI — View Subjects →
      </p>
    </button>

    <button
      type="button"
      onClick={() => setSelectedSloGrade(12)}
      className="rounded-xl border bg-white p-6 text-left shadow-sm hover:border-blue-500 hover:bg-blue-50"
    >
      <span className="babul-icon-tile"><BookOpen size={18} /></span>
      <h3 className="mt-3 text-xl font-bold text-slate-900">
        2nd Year
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Grade XII — View Subjects →
      </p>
    </button>
  </div>

    ) : selectedSloSubject === null ? (

      <div className="flex-1 overflow-y-auto p-6">
        <button
          type="button"
          onClick={() => setSelectedSloGrade(null)}
          className="mb-5 text-sm font-medium text-blue-600"
        >
          ← Back to Years
        </button>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLO_SUBJECTS.map((subject) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => setSelectedSloSubject(subject.id)}
              className="rounded-xl border bg-white p-6 text-left shadow-sm hover:border-blue-500 hover:bg-blue-50"
            >
              <span className="babul-icon-tile"><subject.icon size={18} /></span>
              <h3 className="mt-3 font-bold">
                {subject.name}
              </h3>
              <p className="mt-2 text-sm text-blue-600">
                View Original SLOs →
              </p>
            </button>
          ))}
        </div>
      </div>

    ) : (

     <div className="flex min-h-0 flex-1 flex-col">

        <div className="border-b bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => {
  setSelectedSloChapterPage(null);
  setSloFullscreen(false);
  setSelectedSloSubject(null);
}}
            className="inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-800 hover:text-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            ← Back to Subjects
          </button>
          <button
  type="button"
  onClick={() => setSloFullscreen((prev) => !prev)}
  className="ml-4 inline-flex cursor-pointer items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-all duration-200 hover:border-emerald-800 hover:bg-emerald-800 hover:text-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
>
  {sloFullscreen ? (
    <><Minimize2 className="mr-1 inline" size={16} /> Exit Full Screen</>
  ) : (
    <><Maximize2 className="mr-1 inline" size={16} /> Full Screen</>
  )}
</button>
        </div>
{selectedSloSubject === "computer-science" &&
  selectedSloGrade !== null && (
    <div className="border-b bg-white px-5 py-3">
      <label
        htmlFor="slo-chapter"
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        Select chapter
      </label>

      <select
        id="slo-chapter"
        value={selectedSloChapterPage ?? ""}
        onChange={(e) =>
          setSelectedSloChapterPage(
            e.target.value === "" ? null : Number(e.target.value)
          )
        }
className="w-full min-h-14 rounded-xl border-2 border-blue-300 bg-blue-50 px-5 py-3 text-base font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"      >
        <option value="">Full Syllabus — Start of Grade</option>

        {CS_CHAPTERS[selectedSloGrade].map((chapter, index) => (
          <option key={chapter.page} value={chapter.page}>
            Chapter {index + 1}: {chapter.name}
          </option>
        ))}
      </select>
    </div>
  )}
<div
  className={
    sloFullscreen
      ? "fixed inset-0 z-[100] flex flex-col bg-white"
      : "flex min-h-0 flex-1 flex-col"
  }
>
  {sloFullscreen && (
    <div className="flex justify-end border-b bg-white p-3">
      <button
        type="button"
        onClick={() => setSloFullscreen(false)}
        className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white"
      >
        ⤡ Exit Full Screen
      </button>
    </div>
  )}
        {(() => {
          const subject = SLO_SUBJECTS.find(
            (s) => s.id === selectedSloSubject
          );

          if (!subject) return null;

         const page =
  subject.id === "computer-science" &&
  selectedSloChapterPage !== null
    ? selectedSloChapterPage
    : selectedSloGrade === 11
      ? subject.pages[11]
      : subject.pages[12];

          return (
            <iframe
              key={`${subject.id}-${selectedSloGrade}-${page}`}
              src={`${subject.file}#page=${page}&toolbar=1`}
              title={`${subject.name} Grade ${selectedSloGrade} Syllabus`}
              className="min-h-0 w-full flex-1 bg-white"
            />
          );
        })()}
      </div>
      </div>
    )}
  </div>
) : view === "study" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-8">
            <div className="mx-auto max-w-5xl">
              

              {studyChaptersLoading ? (
                <p className="mt-8 text-slate-500">Loading study chapters...</p>
              ) : studyChaptersError ? (
                <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-700">{studyChaptersError}</p>
              ) : studyChapters.length === 0 ? (
                <p className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  No syllabus data is available in the production database for{" "}
                  {STUDY_SUBJECTS.find((subject) => subject.id === studySubject)?.name}{" "}
                  Grade {studyGrade} yet.
                </p>
              ) : (
                <>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                      {studyChapters.length} Chapters
                    </span>
                    <span className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      {studyChapters.reduce(
                        (total, chapter) => total + chapter.slos.length,
                        0
                      )}{" "}
                      Learning Outcomes
                    </span>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {studyChapters.map((chapter) => {
                      const chapterTitle = getStudyChapterTitle(
                        studySubject,
                        studyGrade,
                        chapter
                      );

                      return (
                        <button
                          key={chapter.chapter}
                          type="button"
                          onClick={() => setSelectedStudyChapter(chapter.chapter)}
                          className={`rounded-2xl border p-5 text-left transition hover:border-blue-400 hover:shadow-sm ${
                            selectedStudyChapter === chapter.chapter
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="babul-icon-tile mb-3"><BookOpen size={18} /></span>
                          <h3 className="font-bold">{chapterTitle}</h3>
                          <p className="mt-2 text-sm text-slate-500">{chapter.slos.length} SLOs</p>
                          <p className="mt-3 text-sm font-medium text-blue-700">View learning outcomes →</p>
                        </button>
                      );
                    })}
                  </div>

                  {studyCurrentChapter && (
                    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-xl font-bold">
                        {getStudyChapterTitle(
                          studySubject,
                          studyGrade,
                          studyCurrentChapter
                        )}
                        {" "} — Learning Outcomes
                      </h3>

                      {studySubject !== "computer-science" && (
                        <div className="mt-5 space-y-4">
                          {Array.from(
                            studyCurrentChapter.slos.reduce((groups, slo) => {
                              const key = slo.topic || "general";
                              const label = slo.topic_title || `Subtopic ${slo.topic}`;
                              const current = groups.get(key) ?? { title: label, slos: [] as SLO[] };
                              current.slos.push(slo);
                              groups.set(key, current);
                              return groups;
                            }, new Map<string, { title: string; slos: SLO[] }>())
                          ).map(([topicKey, group]) => (
                            <div key={topicKey} className="rounded-xl border border-slate-200 p-4">
                              <h4 className="text-base font-bold text-slate-800">{group.title}</h4>
                              <div className="mt-3 space-y-3">
                                {group.slos.map((slo) => (
                                  <div key={slo.slo_code} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                        SLO {slo.slo_code}
                                      </span>
                                      {slo.page != null && (
                                        <span className="text-[11px] text-slate-500">Page {slo.page}</span>
                                      )}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-700">{slo.statement}</p>
                                    <button
                                      type="button"
                                      onClick={() => practiceSLO(
                                        slo,
                                        STUDY_SUBJECTS.find((subject) => subject.id === studySubject)?.name
                                      )}
                                      disabled={loading || !historyLoaded}
                                      className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Practice with AI
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {studySubject === "computer-science" && (
                        <div className="mt-5 space-y-3">
                          {[...studyCurrentChapter.slos]
  .sort((a, b) =>
    a.slo_code.localeCompare(b.slo_code, undefined, {
      numeric: true,
    })
  )
  .map((slo) => (
                            <div key={slo.slo_code} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                  SLO {slo.slo_code}
                                </span>
                                <span className="text-xs text-slate-500">Topic {slo.topic}</span>
                                {slo.page != null && (
                                  <span className="text-xs text-slate-500">• SLO document page {slo.page}</span>
                                )}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">{slo.statement}</p>
                              <button
                                type="button"
                                onClick={() => practiceSLO(slo, "Computer Science")}
                                disabled={loading || !historyLoaded}
                                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Practice with AI
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="babul-feed min-h-0 flex-1 overflow-y-auto">
              <div className="babul-conversation mx-auto">
                {messages.length === 0 && (
                  <div className="babul-welcome">
                    <div className="babul-welcome-icon">
                      <MessageSquare size={24} />
                    </div>

                    <h2>
                      How can I help you learn?
                    </h2>

                    <p>
                      Ask your AKU-EB Grade 12 Computer Science question, or explore the syllabus chapter by chapter.
                    </p>

                    <button
                      onClick={openStudy}
                      className="babul-study-link"
                    >
                      <BookOpen size={17} />
                      Study by chapter
                    </button>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`babul-message babul-message--${message.role} flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`babul-bubble babul-bubble--${message.role}`}
                    >
                      {message.role === "assistant" && (
                        <span className="babul-answer-label">Babul Learn answer</span>
                      )}

                      <div className="babul-message-content">
                        {message.role === "assistant" ? (
                          renderAssistantAnswer(message.content)
                        ) : (
                          message.content
                        )}
                      </div>

                      {message.role === "assistant" &&
                        (message.paper2_questions?.length ?? 0) > 0 && (
                          <section className="babul-related-questions">
                            <h3>Related AKU-EB model paper questions</h3>
                            {message.paper2_questions?.map((q, index) => (
                              <article
                                key={`${q.question_number}-${q.question_part ?? index}`}
                                className="babul-paper-question"
                              >
                                <div className="babul-paper-heading">
                                  <strong>
                                    Question {q.question_number}
                                    {q.question_part ? `(${q.question_part})` : ""}
                                  </strong>
                                  <span>{q.marks} marks</span>
                                </div>
                                <p>{q.question_text}</p>
                                <small>
                                {q.source_type === "official_model_paper"
                                  ? `AKU-EB Official Model ${
                                      q.paper === "paper-1"
                                        ? "Paper I"
                                        : q.paper === "paper-2"
                                          ? "Paper II"
                                          : q.paper === "paper-3"
                                            ? "Paper III"
                                            : "Paper"
                                    }`
                                  : "AKU-EB question source"}
                                {q.source_page ? ` · Page ${q.source_page}` : ""}
                                </small>
                                <button
                                  type="button"
                                  onClick={() => void askAI(q.question_text)}
                                  disabled={loading || !historyLoaded}
                                  className="babul-practice-question"
                                >
                                  Practice this question
                                </button>
                              </article>
                            ))}
                          </section>
                        )}

                      {message.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => copyAnswer(message)}
                          className="babul-copy"
                        >
                          <Copy size={14} />
                          {copiedId === message.id ? "Copied" : "Copy answer"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div
                    className="flex justify-start"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="babul-thinking">
                      <span>Babul Learn is thinking</span>
                      <span className="babul-typing-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="babul-composer shrink-0">
              <div className="mx-auto max-w-[760px]">
                <div className="babul-composer-box">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      e.currentTarget.style.height = "auto";
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                    }}
                    onKeyDown={handleQuestionKeyDown}
                    placeholder="Ask your Computer Science question..."
                    rows={1}
                    className="babul-textarea"
                    aria-label="Your question"
                  />

                  <div className="babul-composer-controls">
                    <div className="babul-composer-options">
                      <label className="babul-marks-label" htmlFor="answer-marks">
                        Marks
                      </label>
                      <select
                        id="answer-marks"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        className="babul-marks-select"
                        aria-label="Answer marks"
                      >
                        <option value="2">2 marks</option>
                        <option value="3">3 marks</option>
                        <option value="5">5 marks</option>
                        <option value="8">8 marks</option>
                      </select>
                      <button
                        type="button"
                        className="babul-suggestion"
                        onClick={() => setQuestion("Explain the main concepts in this topic.")}
                      >
                        Explain a concept
                      </button>
                      <button
                        type="button"
                        className="babul-suggestion"
                        onClick={() => setQuestion("Give me an exam-style practice question.")}
                      >
                        Exam practice
                      </button>
                    </div>

                    <button
                      onClick={() => void askAI()}
                      disabled={loading || !question.trim() || !historyLoaded}
                      className="babul-send"
                    >
                      <span>{loading ? "Sending" : "Send"}</span>
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                <p className="babul-chat-disclaimer">
                  AI answers can contain mistakes. Check the textbook label before relying on one.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
