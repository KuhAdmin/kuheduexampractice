import { useBreakpoint } from "../hooks/useBreakpoint";

/**
 * Opt-in narrow/centered layout for single-task screens (a single flashcard,
 * a single simple question). On mobile, StudentPageShell already renders the
 * phone card, so this is a no-op passthrough there. On tablet/desktop, where
 * StudentPageShell renders a plain full-width div, this reintroduces the
 * narrow card deliberately, regardless of the ambient sidebar width.
 */
export const FocusLayout = ({ children, className = "" }) => {
  const tier = useBreakpoint();

  if (tier === "mobile") {
    return <>{children}</>;
  }

  return (
    <div className={`focus-layout ${className}`.trim()}>
      <div className="focus-layout-card">{children}</div>
    </div>
  );
};
