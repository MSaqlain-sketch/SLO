import {
  hasStrongSyllabusMatch,
  isAffirmative,
  isAnswerTextbookSupported,
  isBriefFollowUp,
  isSyllabusRelevant,
  overlap,
  tokens,
} from "./scope.ts";

function groqResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

Deno.test("a new Messi question is not treated as a course follow-up", () => {
  if (isBriefFollowUp("What is Messi?")) {
    throw new Error("A new subject must not inherit the previous SLO context.");
  }
  if (isBriefFollowUp("Yes, what is Messi?")) {
    throw new Error(
      "A new question after an affirmative must not use old context.",
    );
  }
  if (isAffirmative("Yes, what is Messi?")) {
    throw new Error(
      "A new question must not be treated as an answer confirmation.",
    );
  }
});

Deno.test("affirmative confirmations remain eligible for question context", () => {
  if (isAffirmative("Yes, please solve it.")) {
    return;
  }
  throw new Error("A valid affirmative follow-up should be recognized.");
});

Deno.test("brief pronoun questions remain eligible for conversation context", () => {
  if (
    !isBriefFollowUp("What is it?") ||
    !isBriefFollowUp("Why?") ||
    !isBriefFollowUp("Explain it.")
  ) {
    throw new Error(
      "A genuine short follow-up should retain conversation context.",
    );
  }
});

Deno.test("syllabus topic terms match their verified SLO statement", () => {
  const score = overlap(
    "What is a primary key?",
    "describe the following keys: primary key, foreign key, candidate key;",
  );

  if (score < 0.5) {
    throw new Error(`Expected a syllabus match, got ${score}.`);
  }
});

Deno.test("strong syllabus matches accept clear concepts but reject incidental overlap", () => {
  const syllabus = [
    {
      slo_code: "12.1.1",
      statement: "Explain database management systems and their benefits",
    },
    {
      slo_code: "12.2.1",
      statement: "Describe the design and analysis of algorithms",
    },
  ];

  if (!hasStrongSyllabusMatch("What is database management?", syllabus)) {
    throw new Error("A clear syllabus topic should pass the local gate.");
  }
  if (hasStrongSyllabusMatch("What is Messi algorithm?", syllabus)) {
    throw new Error("One incidental term must not authorize a new topic.");
  }
});

Deno.test("unrelated topic terms do not match syllabus SLO statements", () => {
  const score = overlap(
    "What is Messi?",
    "describe the use of digital devices in terms of ease and efficiency;",
  );

  if (score !== 0) {
    throw new Error(`Expected no syllabus match, got ${score}.`);
  }
});

Deno.test("Grade 12 computer-science acronyms are retained during matching", () => {
  if (!tokens("What is ML?").includes("ml")) {
    throw new Error("The syllabus acronym ML should be retained.");
  }
});

Deno.test("subject scope validation rejects a clearly unrelated question", async () => {
  const requests: Record<string, unknown>[] = [];
  const inScope = await isSyllabusRelevant(
    "What is Messi? (2 marks)",
    [],
    [{ slo_code: "12.1.1", statement: "Explain database management systems" }],
    "test-key",
    "test-model",
    async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return groqResponse('{"in_scope":false}');
    },
  );

  if (inScope) throw new Error("An unrelated question must be rejected.");
  if (requests.length !== 1) throw new Error("The scope request was not made.");

  const messages = requests[0].messages as Array<{ content: string }>;
  const input = JSON.parse(messages[1].content);
  if (input.question !== "What is Messi? (2 marks)") {
    throw new Error("The actual question must reach the server-side gate.");
  }
});

Deno.test("subject scope validation includes syllabus context for concepts beyond textbook text", async () => {
  const syllabus = [
    {
      slo_code: "12.1.1",
      statement: "Explain database management systems and their benefits",
    },
  ];
  const inScope = await isSyllabusRelevant(
    "What is database management? (2 marks)",
    [],
    syllabus,
    "test-key",
    "test-model",
    async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      const messages = request.messages as Array<{ content: string }>;
      const input = JSON.parse(messages[1].content);
      if (input.syllabus_slos[0].statement !== syllabus[0].statement) {
        throw new Error("The verified syllabus context must be supplied.");
      }
      return groqResponse('{"in_scope":true}');
    },
  );

  if (!inScope) {
    throw new Error("A syllabus-related question should be allowed.");
  }
});

Deno.test("subject scope validation preserves context for genuine follow-ups", async () => {
  const inScope = await isSyllabusRelevant(
    "Why?",
    [{ role: "user", content: "What is a primary key?" }],
    [{ slo_code: "12.1.1", statement: "Describe database keys" }],
    "test-key",
    "test-model",
    async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      const messages = request.messages as Array<{ content: string }>;
      const input = JSON.parse(messages[1].content);
      if (input.recent_conversation[0].content !== "What is a primary key?") {
        throw new Error("Recent conversation must be supplied for follow-ups.");
      }
      return groqResponse('{"in_scope":true}');
    },
  );

  if (!inScope) throw new Error("A contextual follow-up should be allowed.");
});

Deno.test("textbook support validation accepts only an explicit support decision", async () => {
  const passages = [{
    page: 12,
    text: "A primary key uniquely identifies a record.",
  }];
  const supported = await isAnswerTextbookSupported(
    "What is a primary key?",
    "A primary key uniquely identifies each record.",
    passages,
    "test-key",
    "test-model",
    async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      const messages = request.messages as Array<{ content: string }>;
      if (
        !messages[0].content.includes("Topic similarity alone is not support")
      ) {
        throw new Error("The verifier must require direct evidence.");
      }
      return groqResponse('{"supported":true}');
    },
  );
  const unsupported = await isAnswerTextbookSupported(
    "What is a primary key?",
    "A primary key guarantees encrypted communication.",
    passages,
    "test-key",
    "test-model",
    async () => groqResponse('{"supported":false}'),
  );

  if (!supported || unsupported) {
    throw new Error("Textbook support decisions were not applied correctly.");
  }
});

Deno.test("scope validation fails closed on malformed model output", async () => {
  let failed = false;
  try {
    await isSyllabusRelevant(
      "What is database management?",
      [],
      [],
      "test-key",
      "test-model",
      async () => groqResponse("maybe"),
    );
  } catch {
    failed = true;
  }

  if (!failed) {
    throw new Error("Malformed validation output must not authorize answers.");
  }
});
