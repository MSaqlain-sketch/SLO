import {
  removeUnverifiedPaperClaims,
  type VerifiedPaperReference,
  verifiedPaperReferenceContext,
} from "./paper-references.ts";

const modelPaperReference: VerifiedPaperReference = {
  paper: "paper-2",
  source_type: "official_model_paper",
  question_number: 2,
  question_part: null,
  source_page: 2,
};

Deno.test("paper context uses only retrieved metadata and distinguishes model papers", () => {
  const context = verifiedPaperReferenceContext([modelPaperReference]);

  if (!context.includes("Official Model Paper II, Question 2, Page 2")) {
    throw new Error("Expected retrieved model-paper metadata in context.");
  }
  if (!context.includes("Year is not present")) {
    throw new Error("The missing year field must be explicit.");
  }
  if (!context.includes("No actual past-examination records")) {
    throw new Error("Model-paper data must not imply past-exam provenance.");
  }
  if (context.includes("2022") || context.includes("2027")) {
    throw new Error("An unsupported paper year was included.");
  }
});

Deno.test("no source metadata yields the required no-reference wording", () => {
  const context = verifiedPaperReferenceContext([]);
  if (!context.includes("No verified model/past paper reference found.")) {
    throw new Error("The no-reference instruction is missing.");
  }

  const sanitized = removeUnverifiedPaperClaims(
    "It appeared in Model Paper II 2022.",
    [],
  );
  if (
    sanitized.includes("2022") ||
    !sanitized.includes("No verified model/past paper reference found.")
  ) {
    throw new Error(
      "Unverified claims without source metadata were not removed.",
    );
  }
});

Deno.test("unsupported years and past-exam claims are removed without losing answer lines", () => {
  const answer = [
    "Binary search compares the target with the middle item.",
    "It appeared in Model Paper II 2022.",
    "It also appeared in a past examination.",
    "left = middle + 1",
  ].join("\n");

  const sanitized = removeUnverifiedPaperClaims(answer, [
    modelPaperReference,
  ]);

  if (sanitized.includes("2022") || sanitized.includes("appeared")) {
    throw new Error("An unsupported paper claim remained in the answer.");
  }
  if (
    !sanitized.includes("Binary search compares the target") ||
    !sanitized.includes("left = middle + 1")
  ) {
    throw new Error("Non-reference answer text or line breaks were lost.");
  }
  if (!sanitized.includes("No verified past-examination reference found.")) {
    throw new Error("The replacement must distinguish past-exam sources.");
  }
});

Deno.test("a model-paper citation is retained only when its metadata matches", () => {
  const supported = removeUnverifiedPaperClaims(
    "See AKU-EB Official Model Paper II, Question 2, Page 2.",
    [modelPaperReference],
  );
  const unsupported = removeUnverifiedPaperClaims(
    "See AKU-EB Official Model Paper II, Question 3, Page 2.",
    [modelPaperReference],
  );

  if (!supported.includes("Question 2, Page 2")) {
    throw new Error("The citation matching verified metadata was removed.");
  }
  if (unsupported.includes("Question 3")) {
    throw new Error("A citation with an unsupported question number remained.");
  }
});
