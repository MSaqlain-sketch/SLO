export type VerifiedPaperReference = {
  paper: string;
  source_type: string;
  question_number: number;
  question_part: string | null;
  source_page: number | null;
};

const PAPER_CLAIM_PATTERN =
  /\b(?:model[\s-]+papers?|past[\s-]+(?:(?:model[\s-]+)?papers?|exams?|examinations?)|previous[\s-]+(?:papers?|exams?|examinations?)|appeared\s+in\s+(?:an?\s+)?(?:exam|examination))\b/i;
const PAST_EXAM_CLAIM_PATTERN =
  /\b(?:past[\s-]+(?:(?:model[\s-]+)?papers?|exams?|examinations?)|previous[\s-]+(?:papers?|exams?|examinations?)|appeared\s+in\s+(?:an?\s+)?(?:exam|examination))\b/i;

function paperTitle(paper: string): string | null {
  const match = /^paper-([1-3])$/i.exec(paper);
  if (!match) return null;
  return `Paper ${["I", "II", "III"][Number(match[1]) - 1]}`;
}

export function verifiedPaperReferenceContext(
  references: VerifiedPaperReference[],
): string {
  const officialModelPapers = references.filter(
    (reference) => reference.source_type === "official_model_paper",
  );

  if (!officialModelPapers.length) {
    return [
      "No verified model/past paper reference found.",
      "No actual past-examination records were retrieved.",
    ].join("\n");
  }

  return [
    "Verified retrieved source metadata (model papers are not past-examination appearances):",
    ...officialModelPapers.map((reference) => {
      const title = paperTitle(reference.paper);
      if (!title) return null;
      const part = reference.question_part
        ? `(${reference.question_part})`
        : "";
      const page = reference.source_page == null
        ? ""
        : `, Page ${reference.source_page}`;
      return `AKU-EB Official Model ${title}, Question ${reference.question_number}${part}${page}. Year is not present in the retrieved source metadata.`;
    }).filter((line): line is string => line !== null),
    "No actual past-examination records were retrieved.",
  ].join("\n");
}

function isSupportedModelPaperClaim(
  sentence: string,
  references: VerifiedPaperReference[],
): boolean {
  if (PAST_EXAM_CLAIM_PATTERN.test(sentence)) {
    return false;
  }

  const matchingPaper = references.find((reference) => {
    if (reference.source_type !== "official_model_paper") return false;
    const title = paperTitle(reference.paper);
    return title !== null &&
      new RegExp(`\\bmodel\\s+${title.replace(" ", "\\s+")}\\b`, "i")
        .test(sentence);
  });

  if (!matchingPaper) return false;

  const years = sentence.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (years.length) return false;

  const questionNumbers = [
    ...sentence.matchAll(/\b(?:question|q\.?)\s*(\d+)\b/gi),
  ].map((match) => Number(match[1]));
  if (
    questionNumbers.some((number) => number !== matchingPaper.question_number)
  ) {
    return false;
  }

  const questionParts = [
    ...sentence.matchAll(/\b(?:question|q\.?)\s*\d+\(([a-z])\)/gi),
  ].map((match) => match[1].toLowerCase());
  if (
    questionParts.some((part) =>
      part !== matchingPaper.question_part?.toLowerCase()
    )
  ) {
    return false;
  }

  const pages = [
    ...sentence.matchAll(/\bpage\s+(\d+)\b/gi),
  ].map((match) => Number(match[1]));
  if (
    pages.some((page) => page !== matchingPaper.source_page)
  ) {
    return false;
  }

  return true;
}

function verifiedReferenceSummary(
  references: VerifiedPaperReference[],
): string {
  const official = references.filter(
    (reference) =>
      reference.source_type === "official_model_paper" &&
      paperTitle(reference.paper) !== null,
  );
  if (!official.length) {
    return "No verified model/past paper reference found.";
  }

  const details = official.map((reference) => {
    const part = reference.question_part ? `(${reference.question_part})` : "";
    const page = reference.source_page == null
      ? ""
      : `, Page ${reference.source_page}`;
    return `AKU-EB Official Model ${
      paperTitle(reference.paper)
    }, Question ${reference.question_number}${part}${page}`;
  });
  return `Verified model-paper reference: ${
    [...new Set(details)].join("; ")
  }. No verified past-examination reference found.`;
}

export function removeUnverifiedPaperClaims(
  answer: string,
  references: VerifiedPaperReference[],
): string {
  let removedClaim = false;
  const cleaned = answer
    .split(/(\r?\n)/)
    .map((line) => {
      if (!line || /^\r?\n$/.test(line)) return line;
      return (line.match(/\s*[^.!?]+[.!?]*/g) ?? [line])
        .filter((sentence) => {
          if (!PAPER_CLAIM_PATTERN.test(sentence)) {
            return true;
          }
          if (isSupportedModelPaperClaim(sentence, references)) return true;
          removedClaim = true;
          return false;
        })
        .join("");
    })
    .join("");

  if (!removedClaim) return cleaned;
  const separator = cleaned && !cleaned.endsWith("\n") ? "\n" : "";
  return `${cleaned}${separator}${verifiedReferenceSummary(references)}`;
}
