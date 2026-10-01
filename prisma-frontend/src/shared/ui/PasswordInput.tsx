import { useState, type InputHTMLAttributes } from "react";
import { inputClass } from "./classes";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Drop-in replacement for <input type="password"> with a show/hide button. */
export function PasswordInput({ className = "", ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {/* `pr-11!` (Tailwind v4 important) keeps room for the button even if inputClass sets its own padding */}
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`${inputClass} pr-11! ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3.01 9.96 7.18.07.21.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3.01-9.96-7.18Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
