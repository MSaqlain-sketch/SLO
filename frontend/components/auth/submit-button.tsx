"use client";
import { useFormStatus } from "react-dom";

export default function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="auth-submit">
      <span>{pending ? "Please wait..." : children}</span>
      {pending && <span className="auth-spinner" aria-hidden="true" />}
    </button>
  );
}
