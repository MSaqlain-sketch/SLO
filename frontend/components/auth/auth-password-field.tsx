"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

type AuthPasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  required: boolean;
  minLength: number;
  maxLength: number;
};

export default function AuthPasswordField({
  label,
  name,
  autoComplete,
  required,
  minLength,
  maxLength,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const VisibilityIcon = visible ? EyeOff : Eye;

  return (
    <label className="auth-field" htmlFor={inputId}>
      {label}
      <span className="auth-password-wrap">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          className="auth-password-toggle"
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          <VisibilityIcon size={18} aria-hidden="true" />
        </button>
      </span>
    </label>
  );
}