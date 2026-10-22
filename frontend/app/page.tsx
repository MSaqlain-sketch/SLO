
"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type SLO = {
  slo_code: string;
  topic: string;
  statement: string;
  page: number | null;
};

type Chapter = {
  chapter: number;
  title: string;
  slos: SLO[];
};

type ChaptersResponse = {
  total_chapters: number;
  total_slos: number;
  chapters: Chapter[];
};

const STORAGE_KEY = "aku-learn-chats";
const ACTIVE_KEY = "aku-learn-active-chat";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
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

const SLO_SUBJECTS = [
  {
    id: "computer-science",
    name: "Computer Science",
    icon: "💻",
    file: "/akueb-computer-science.pdf",
    pages: { 11: 10, 12: 27 },
  },
  {
    id: "mathematics",
    name: "Mathematics",
    icon: "📐",
    file: "/mathematics-syllabus.pdf",
    pages: { 11: 10, 12: 28 },
  },
  {
    id: "statistics",
    name: "Statistics",
    icon: "📊",
    file: "/statistics-syllabus.pdf",
    pages: { 11: 10, 12: 22 },
  },
  {
    id: "physics",
    name: "Physics",
    icon: "⚛️",
    file: "/physics-syllabus.pdf",
    pages: { 11: 10, 12: 28 },
  },
] as const;
export default function Home() {
  const [question, setQuestion] = useState("");
  const [marks, setMarks] = useState("2");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

const sloSubjects = [
  {
    id: "computer-science",
    name: "Computer Science",
    pdf: "/akueb-computer-science.pdf",
    year: 2025,
    pages: { 11: 10, 12: 27 },
  },
  {
    id: "mathematics",
    name: "Mathematics",
    pdf: "/mathematics-syllabus.pdf",
    year: 2025,
    pages: { 11: 10, 12: 28 },
  },
  {
    id: "statistics",
    name: "Statistics",
    pdf: "/statistics-syllabus.pdf",
    year: 2026,
    pages: { 11: 10, 12: 22 },
  },
  {
    id: "physics",
    name: "Physics",
    pdf: "/physics-syllabus.pdf",
    year: 2025,
    pages: { 11: 10, 12: 28 },
  },
];
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
const [view, setView] = useState<"chat" | "study" | "slos">("chat");
  const [selectedSloSubject, setSelectedSloSubject] = useState<string | null>(null);
  const [selectedSloGrade, setSelectedSloGrade] =
  useState<11 | 12 | null>(null);
  const [selectedSloChapterPage, setSelectedSloChapterPage] =
  useState<number | null>(null);
  const [sloFullscreen, setSloFullscreen] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [chaptersError, setChaptersError] = useState("");
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestInFlight = useRef(false);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const messages = activeChat?.messages ?? [];

  const currentChapter = chapters.find(
    (chapter) => chapter.chapter === selectedChapter
  );

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

  // Load real chapter and SLO data from FastAPI
  useEffect(() => {
    async function loadChapters() {
      try {
        const response = await fetch(`${API_URL}/chapters`)

        if (!response.ok) {
          throw new Error("Unable to fetch chapters");
        }

        const data: ChaptersResponse = await response.json();

        setChapters(data.chapters);
        setChaptersError("");
      } catch {
        setChaptersError(
          "Could not load chapters. Please check the backend."
        );
      } finally {
        setChaptersLoading(false);
      }
    }

    void loadChapters();
  }, []);

  // Automatically scroll to newest chat message
  useEffect(() => {
    if (view !== "chat") return;

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
      content: `${text} (${marks} marks)`,
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
      const response = await fetch(`${API_URL}/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: `${text} (${marks} marks)`,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || "No answer received.",
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
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Unable to connect to AKU Learn AI. Please check the backend server.",
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
function openSLOs() {
  if (requestInFlight.current) return;

  setView("slos");
  setSelectedSloGrade(null);
  setSelectedSloSubject(null);
  setSelectedChapter(null);
  setSidebarOpen(false);
}

function closeSLOs() {
  setSelectedSloGrade(null);
  setSelectedSloSubject(null);
  setView("chat");
}

  function openStudy() {
    if (requestInFlight.current) return;

    setView("study");
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
    <div className="flex h-dvh bg-white text-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } fixed inset-y-0 left-0 z-30 w-72 flex-col border-r border-slate-200 bg-slate-50 p-4 md:static md:flex`}
      >
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-700">
              AKU Learn
            </h1>
            <p className="text-xs text-slate-500">
              Your AI Study Companion
            </p>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-slate-200 md:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <button
          onClick={newChat}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          ＋ New Chat
        </button>

        {/* New Study by Chapter navigation */}
        <button
          onClick={openStudy}
          disabled={loading}
          className={`mt-3 rounded-xl px-4 py-3 text-left font-medium disabled:opacity-50 ${
            view === "study"
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-slate-200"
          }`}
        >
          📚 Study by Chapter
        </button>
<button
  type="button"
  onClick={openSLOs}
  disabled={loading}
  className={`mt-3 rounded-xl px-4 py-3 text-left font-medium disabled:opacity-50 ${
    view === "slos"
      ? "bg-blue-100 text-blue-700"
      : "hover:bg-slate-200"
  }`}
>
  📋 View SLOs
</button>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-400">
            Recent Chats
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
                      ? "bg-blue-100"
                      : "hover:bg-slate-200"
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
                        className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-2 py-2 text-sm outline-none"
                        aria-label="New chat title"
                      />

                      <button
                        onClick={() => saveRename(chat.id)}
                        className="p-2 text-green-700"
                        aria-label="Save chat name"
                      >
                        ✓
                      </button>

                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-2 text-slate-500"
                        aria-label="Cancel rename"
                      >
                        ✕
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
                        💬 {chat.title}
                      </button>

                      <button
                        onClick={() => startRename(chat)}
                        disabled={loading}
                        className="shrink-0 p-2 text-slate-500 hover:text-blue-700 disabled:opacity-50"
                        aria-label={`Rename ${chat.title}`}
                        title="Rename chat"
                      >
                        ✎
                      </button>

                      <button
                        onClick={() => deleteChat(chat.id)}
                        disabled={loading}
                        className="shrink-0 p-2 text-slate-500 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Delete ${chat.title}`}
                        title="Delete chat"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold">
            Grade 12 Computer Science
          </p>
          <p className="text-xs text-slate-500">
            AI-Powered Learning
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-xl md:hidden"
              aria-label="Open sidebar"
            >
              ☰
            </button>

            <h2 className="font-semibold">
             {view === "study"
  ? "Study by Chapter"
  : view === "slos"
    ? "View SLOs"
    : "AKU Learn AI"}
            </h2>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Computer Science • Grade 12
          </span>
        </header>

   {view === "slos" ? (
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
        ✕ Close SLOs
      </button>
    </div>

   {selectedSloGrade === null ? (
  <div className="grid gap-4 p-6 sm:grid-cols-2">
    <button
      type="button"
      onClick={() => setSelectedSloGrade(11)}
      className="rounded-xl border bg-white p-6 text-left shadow-sm hover:border-blue-500 hover:bg-blue-50"
    >
      <div className="text-3xl">📘</div>
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
      <div className="text-3xl">📗</div>
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
              <div className="text-3xl">{subject.icon}</div>
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
            className="text-sm font-medium text-blue-600"
          >
            ← Back to Subjects
          </button>
          <button
  type="button"
  onClick={() => setSloFullscreen((prev) => !prev)}
  className="ml-4 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
>
  {sloFullscreen ? "⤡ Exit Full Screen" : "⛶ Full Screen"}
</button>
        </div>
{selectedSloSubject === "computer-science" &&
  selectedSloGrade !== null && (
    <div className="border-b bg-white px-5 py-3">
      <label
        htmlFor="slo-chapter"
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        📚 Select Chapter
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
          /* Study by Chapter screen */
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-8">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-bold">
                📚 Explore Your Syllabus
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Select a chapter and practice its learning outcomes.
              </p>

              {chaptersLoading ? (
                <p className="mt-8 text-slate-500">
                  Loading chapters...
                </p>
              ) : chaptersError ? (
                <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-700">
                  {chaptersError}
                </p>
              ) : (
                <>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                      {chapters.length} Chapters
                    </span>

                    <span className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      {chapters.reduce(
                        (total, chapter) => total + chapter.slos.length,
                        0
                      )}{" "}
                      Learning Outcomes
                    </span>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.chapter}
                        onClick={() => setSelectedChapter(chapter.chapter)}
                        className={`rounded-2xl border p-5 text-left transition hover:border-blue-400 hover:shadow-sm ${
                          selectedChapter === chapter.chapter
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-3 text-2xl">📖</div>

                        <h3 className="font-bold">
                          {chapter.title}
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          {chapter.slos.length} SLOs
                        </p>

                        <p className="mt-3 text-sm font-medium text-blue-700">
                          View learning outcomes →
                        </p>
                      </button>
                    ))}
                  </div>

                  {currentChapter && (
                    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-xl font-bold">
                        {currentChapter.title} — Learning Outcomes
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        Choose an SLO to generate an exam-style explanation.
                      </p>

                      <div className="mt-5 space-y-3">
                        {currentChapter.slos.map((slo) => (
                          <div
                            key={slo.slo_code}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                SLO {slo.slo_code}
                              </span>

                              <span className="text-xs text-slate-500">
                                Topic {slo.topic}
                              </span>

                              {slo.page != null && (
                                <span className="text-xs text-slate-500">
                                  • SLO document page {slo.page}
                                </span>
                              )}
                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {slo.statement}
                            </p>

                            <button
                              onClick={() => practiceSLO(slo)}
                              disabled={loading || !historyLoaded}
                              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              ✦ Practice with AI →
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Chat messages */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
              <div className="mx-auto max-w-3xl space-y-7">
                {messages.length === 0 && (
                  <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
                    <div className="mb-5 rounded-2xl bg-blue-50 p-5 text-3xl">
                      🎓
                    </div>

                    <h2 className="text-3xl font-bold">
                      How can I help you learn?
                    </h2>

                    <p className="mt-3 max-w-md text-slate-500">
                      Ask Computer Science questions or explore
                      learning outcomes chapter by chapter.
                    </p>

                    <button
                      onClick={openStudy}
                      className="mt-6 rounded-xl border border-blue-200 px-5 py-3 font-medium text-blue-700 hover:bg-blue-50"
                    >
                      📚 Study by Chapter
                    </button>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-5 py-4 text-sm leading-7 md:max-w-[80%] ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <p className="mb-2 font-bold text-blue-700">
                          ✦ AKU Learn
                        </p>
                      )}

                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>

                      {message.role === "assistant" && (
                        <button
                          onClick={() => copyAnswer(message)}
                          className="mt-3 text-xs font-medium text-slate-500 hover:text-blue-700"
                        >
                          {copiedId === message.id
                            ? "✓ Copied!"
                            : "⧉ Copy Answer"}
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
                    <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm text-slate-500">
                      ✦ AKU Learn is thinking...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Question composer */}
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl border border-slate-300 p-3 shadow-sm focus-within:border-blue-500">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    placeholder="Ask your Computer Science question..."
                    rows={2}
                    className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
                    aria-label="Your question"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Marks:
                      </span>

                      <select
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        aria-label="Answer marks"
                      >
                        <option value="2">2 Marks</option>
                        <option value="3">3 Marks</option>
                        <option value="5">5 Marks</option>
                      </select>
                    </div>

                    <button
                      onClick={() => void askAI()}
                      disabled={loading || !question.trim() || !historyLoaded}
                      className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? "..." : "Send ↑"}
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-center text-xs text-slate-400">
                  Enter to send • Shift+Enter for a new line
                </p>

                <p className="mt-1 text-center text-xs text-slate-400">
                  AI answers may contain mistakes. Check textbook
                  verification labels before relying on an answer.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
