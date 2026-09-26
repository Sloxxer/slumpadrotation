"use client";

import { useFormStatus } from "react-dom";

// Skicka-knapp som frågar innan formuläret skickas, för åtgärder som är svåra
// att ångra (rensa historik, arkivera).
export function ConfirmSubmitButton({
  label,
  pendingLabel = "Sparar...",
  confirmMessage,
  className
}: {
  label: string;
  pendingLabel?: string;
  confirmMessage: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
