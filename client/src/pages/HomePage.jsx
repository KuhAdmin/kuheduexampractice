import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useBreakpoint } from "../hooks/useBreakpoint";

const GOOGLE_AUTH_URL =
 "/api/auth/google";

const homeScreens = [
  {
    id: "splash",
    kind: "splash",
  },
  {
    id: "onboarding-1",
    kind: "onboarding",
    title: "Master Every Subject,\nStep by Step",
    body:
      "Learn through concepts, practice, and personalized guidance designed for lasting understanding.",
    artClass: "is-cell",
  },
  {
    id: "onboarding-2",
    kind: "onboarding",
    title: "Understand Once.\nRemember Longer.",
    body:
      "Stories, visuals, and real-life examples help every concept stay with you.",
    artClass: "is-plant",
  },
  {
    id: "onboarding-3",
    kind: "onboarding",
    title: "Practice. Improve.\nSucceed.",
    body:
      "Discover weak areas, strengthen your skills, and track your progress with smart assessments.",
    artClass: "is-clipboard",
  },
  {
    id: "welcome",
    kind: "welcome",
    title: "One Concept at a Time.\nUnlimited Growth.",
    body:
      "Build confidence every day with guided learning designed around your pace.",
    artClass: "is-book",
  },
  {
    id: "register",
    kind: "register",
    title: "Create Your Account",
    body:
      "Set up your profile to continue your guided Biology experience.",
    artClass: "is-seed",
  },
  {
    id: "login",
    kind: "login",
    title: "Welcome Back",
    body:
      "Sign in to continue where you left off and restore your saved practice progress.",
    artClass: "is-portal",
  },
  {
    id: "google",
    kind: "google",
    title: "Continue With Google",
    body:
      "Use Google for a faster sign-in and keep your learning synced across your devices.",
    artClass: "is-google",
  },
];

const screenIndexById = Object.fromEntries(homeScreens.map((screen, index) => [screen.id, index]));
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 15;
const boardOptions = [
  { id: "cbse", label: "CBSE", badge: "C" },
  { id: "icse", label: "ICSE", badge: "I" },
  { id: "isc", label: "ISC", badge: "S" },
  { id: "igcse", label: "IGCSE", badge: "G" },
  { id: "neet", label: "NEET", badge: "N" },
  { id: "jee-foundation", label: "JEE Foundation", badge: "J" },
];
const classOptions = ["6", "7", "8", "9", "10", "11", "12"];
const subjectOptions = [
  { id: "biology", label: "Biology", badge: "B" },
  { id: "physics", label: "Physics", badge: "P" },
  { id: "chemistry", label: "Chemistry", badge: "C" },
  { id: "mathematics", label: "Math", badge: "M" },
  { id: "english", label: "English", badge: "E" },
];

const initialRegisterForm = {
  role: "student",
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  board: "",
  studentClass: "",
  subject: "",
  acceptPolicy: false,
};

const initialLoginForm = {
  email: "",
  password: "",
};

const validateRegisterForm = (form) => {
  const trimmedName = form.name.trim();

  if (trimmedName.length < MIN_NAME_LENGTH) {
    return `Name must be at least ${MIN_NAME_LENGTH} characters long.`;
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (form.password.length < MIN_PASSWORD_LENGTH || form.password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`;
  }

  if (form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }

  if (!form.acceptPolicy) {
    return "Please accept the Privacy Policy to continue.";
  }

  if (!form.board) {
    return "Please select your board to continue.";
  }

  if (!form.studentClass) {
    return "Please select your class to continue.";
  }

  if (!form.subject) {
    return "Please select your subject to continue.";
  }

  return "";
};

const validateRegisterDetails = (form) => {
  const trimmedName = form.name.trim();

  if (trimmedName.length < MIN_NAME_LENGTH) {
    return `Name must be at least ${MIN_NAME_LENGTH} characters long.`;
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (form.password.length < MIN_PASSWORD_LENGTH || form.password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`;
  }

  if (form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }

  if (!form.acceptPolicy) {
    return "Please accept the Privacy Policy to continue.";
  }

  return "";
};

const isStudentOnboardingComplete = (user) =>
  user?.role === "moderator" || Boolean(user?.board && user?.studentClass && user?.subject);

const getOnboardingResumeStep = (user) => {
  if (!user?.board) {
    return "board";
  }

  if (!user?.studentClass) {
    return "class";
  }

  if (!user?.subject) {
    return "subject";
  }

  return "board";
};

const Illustration = ({ variant }) => {
  const iconByVariant = {
    "is-splash": "S",
    "is-cell": "C",
    "is-plant": "P",
    "is-clipboard": "A",
    "is-book": "B",
    "is-seed": "R",
    "is-portal": "L",
    "is-google": "G",
  };

  return (
    <div className={`home-illustration ${variant}`}>
      <div className="home-illustration-orbit orbit-one" />
      <div className="home-illustration-orbit orbit-two" />
      <div className="home-illustration-card">
        <div className="home-illustration-stem stem-left" />
        <div className="home-illustration-stem stem-right" />
        <div className={`home-illustration-icon ${variant === "is-splash" || variant === "is-cell" || variant === "is-plant" || variant === "is-clipboard" || variant === "is-book" || variant === "is-seed" || variant === "is-portal" || variant === "is-google" ? "has-image" : ""}`}>
          {variant === "is-splash" ? (
            <img src="/microscope.png" alt="Microscope illustration" />
          ) : variant === "is-cell" ? (
            <img src="/plant.png" alt="Plant illustration" />
          ) : variant === "is-plant" ? (
            <img src="/brain.png" alt="Brain illustration" />
          ) : variant === "is-clipboard" ? (
            <img src="/bulb.png" alt="Bulb illustration" />
          ) : variant === "is-book" ? (
            <img src="/concept.png" alt="Concept illustration" />
          ) : variant === "is-seed" || variant === "is-portal" || variant === "is-google" ? (
            <img src="/access.png" alt="Access illustration" />
          ) : (
            iconByVariant[variant] || "K"
          )}
        </div>
        <div className="home-illustration-soil" />
      </div>
    </div>
  );
};

const PasswordField = ({
  name,
  label,
  value,
  placeholder,
  onChange,
  required = false,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="home-field">
      <span>{label}</span>
      <div className="home-password-input">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          required={required}
        />
        <button
          type="button"
          className="home-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 4.5 19.5 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 9.4 4.2 10 7-.2.9-.8 2.1-1.8 3.3M6.6 6.7C4.5 8.1 3.2 10 2 12c1 2.8 5 7 10 7 1.5 0 2.9-.3 4.2-.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M2 12c1.2-2.8 5.2-7 10-7s8.8 4.2 10 7c-1.2 2.8-5.2 7-10 7S3.2 14.8 2 12Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
};

const RegisterForm = ({
  form,
  step,
  error,
  submitting,
  onChange,
  onTogglePolicy,
  onContinue,
  onSubmit,
  onGoogle,
  onBack,
  onStepBack,
  onSwitchToLogin,
}) => {
  const isBoardStep = step === "board";
  const isClassStep = step === "class";
  const isSubjectStep = step === "subject";
  const selectionOptions = isBoardStep
    ? boardOptions
    : isClassStep
      ? classOptions.map((value) => ({ id: value, label: value }))
      : subjectOptions;
  const selectedValue = isBoardStep ? form.board : isClassStep ? form.studentClass : form.subject;
  const selectionField = isBoardStep ? "board" : isClassStep ? "studentClass" : "subject";
  const isCompactSelectionStep = isClassStep;
  const selectionAriaLabel = isBoardStep
    ? "Select your board"
    : isClassStep
      ? "Select your class"
      : "Select your subject";

  return (
    <div className="home-auth-stack">
      {step === "details" ? (
        <form className="home-auth-form is-register-form" onSubmit={onContinue}>
        <label className="home-field">
          <span>Name</span>
          <input
            type="text"
            name="name"
            value={form.name}
            placeholder="Your full name"
            minLength={MIN_NAME_LENGTH}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => onChange("name", event.target.value)}
            required
          />
        </label>
        <label className="home-field">
          <span>Email ID</span>
          <input
            type="email"
            name="email"
            value={form.email}
            placeholder="you@example.com"
            onChange={(event) => onChange("email", event.target.value)}
            required
          />
        </label>
        <div className="home-password-row">
          <PasswordField
            name="password"
            label="Password"
            value={form.password}
            placeholder={`Use ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`}
            onChange={(event) => onChange("password", event.target.value)}
            required
          />
          <PasswordField
            name="confirmPassword"
            label="Confirm Password"
            value={form.confirmPassword}
            placeholder="Re-enter password"
            onChange={(event) => onChange("confirmPassword", event.target.value)}
            required
          />
        </div>
        <label className="home-checkbox">
          <input type="checkbox" checked={form.acceptPolicy} onChange={onTogglePolicy} />
          <span>I agree to the Privacy Policy and Terms.</span>
        </label>
        {error ? <p className="home-auth-error">{error}</p> : null}
        <button type="submit" className="home-primary-cta" disabled={submitting}>
          Continue
        </button>
        <p className="home-auth-divider" aria-hidden="true">
          OR
        </p>
        <button type="button" className="home-google-cta" onClick={onGoogle}>
          <span className="home-google-mark">G</span>
          <span>Create with Google</span>
        </button>
        <button type="button" className="home-secondary-cta" onClick={onBack}>
          Back
        </button>
        <p className="home-auth-switch">
          <span>Already have an account?</span>
          <button type="button" onClick={onSwitchToLogin}>
            Sign In
          </button>
        </p>
        </form>
      ) : (
        <form
          className="home-auth-form is-register-board-form"
          onSubmit={isSubjectStep ? onSubmit : onContinue}
        >
          <div className="home-board-step">
            <div
              className={`home-board-list ${isCompactSelectionStep ? "is-class-list" : ""}`.trim()}
              role="radiogroup"
              aria-label={selectionAriaLabel}
            >
              {selectionOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`home-board-option ${
                  selectedValue === option.id ? "is-active" : ""
                } ${isCompactSelectionStep ? "is-class-option" : ""}`.trim()}
                onClick={() => onChange(selectionField, option.id)}
              >
                {!isClassStep ? (
                  <span className="home-board-option-badge" aria-hidden="true">
                    {option.badge}
                  </span>
                ) : null}
                <span className="home-board-option-label">{option.label}</span>
                <span className="home-board-option-radio" aria-hidden="true" />
              </button>
              ))}
            </div>
            {(isBoardStep || isSubjectStep) ? <p className="home-board-note">You can change this later.</p> : null}
          </div>
          {error ? <p className="home-auth-error">{error}</p> : null}
          <button type="submit" className="home-primary-cta" disabled={submitting}>
            {isBoardStep || isClassStep ? "Continue" : submitting ? "Creating..." : "Continue"}
          </button>
          <button type="button" className="home-secondary-cta" onClick={onStepBack}>
            Back
          </button>
        </form>
      )}
    </div>
  );
};

const LoginForm = ({ form, error, submitting, onChange, onSubmit, onGoogle, onBack }) => (
  <div className="home-auth-stack">
    <form className="home-auth-form" onSubmit={onSubmit}>
      <label className="home-field">
        <span>Email ID</span>
        <input
          type="email"
          name="email"
          value={form.email}
          placeholder="you@example.com"
          onChange={(event) => onChange("email", event.target.value)}
          required
        />
      </label>
      <PasswordField
        name="password"
        label="Password"
        value={form.password}
        placeholder="Enter your password"
        onChange={(event) => onChange("password", event.target.value)}
        required
      />
      {error ? <p className="home-auth-error">{error}</p> : null}
      <button type="submit" className="home-primary-cta" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign In"}
      </button>
      <p className="home-auth-divider" aria-hidden="true">
        OR
      </p>
      <button type="button" className="home-google-cta" onClick={onGoogle}>
        <span className="home-google-mark">G</span>
        <span>Continue with Google</span>
      </button>
      <button type="button" className="home-secondary-cta" onClick={onBack}>
        Back
      </button>
      <p className="home-auth-switch is-subtle">
        <button type="button">
          Forgot password?
        </button>
      </p>
    </form>
  </div>
);

const GoogleScreen = ({ onGoogle, onBack }) => (
  <div className="home-auth-stack is-google-screen">
    <div className="home-google-panel">
      <p>Choose Google authentication to continue in one tap without filling the form again.</p>
    </div>
    <div className="home-screen-actions home-screen-actions-inline">
      <button type="button" className="home-google-cta" onClick={onGoogle}>
        <span className="home-google-mark">G</span>
        <span>Continue with Google</span>
      </button>
      <button type="button" className="home-secondary-cta" onClick={onBack}>
        Back
      </button>
    </div>
  </div>
);

const HomeScreen = ({
  screen,
  index,
  registerForm,
  registerStep,
  loginForm,
  authState,
  onNext,
  onChooseGetStarted,
  onChooseSignIn,
  onChooseLogout,
  onChooseGoogle,
  onRegisterFieldChange,
  onLoginFieldChange,
  onTogglePolicy,
  onRegisterContinue,
  onRegisterSubmit,
  onLoginSubmit,
  onRegisterGoogleAuth,
  onLoginGoogleAuth,
  onBackToWelcome,
  onSwitchToLogin,
  user,
}) => {
  const isWelcome = screen.kind === "welcome";
  const isAuthScreen = ["register", "login", "google"].includes(screen.kind);
  // Sign-In/Sign-Up get the brand top bar + copyright footer too, but keep
  // their existing (faint, absolutely-positioned) illustration and form
  // layout -- only onboarding-1/2/3 and welcome go illustration-free with
  // the title/subtitle centered into the freed-up space.
  const showBrandChrome =
    screen.kind === "onboarding" || isWelcome || screen.kind === "register" || screen.kind === "login";
  const hideIllustration = screen.kind === "onboarding" || isWelcome;

  return (
    <article className="home-gallery-panel">
      <div className="home-phone-frame is-active">
        <div
          className={`home-phone-screen onboarding-screen ${isWelcome ? "is-welcome" : ""} ${isAuthScreen ? "is-auth-screen" : ""} ${hideIllustration ? "is-onboarding-slide" : ""}`}
        >
          {showBrandChrome ? (
            <div className="home-onboarding-topbar">
              <img src="/kuhedu-logo.png" alt="KUHEDU logo" />
              <span>KUHEDU MASTER</span>
            </div>
          ) : (
            <div className="home-screen-topline" aria-hidden="true" />
          )}
            <div className="home-screen-copy">
              <h2>
                {screen.kind === "register" && registerStep === "board"
                  ? "Select Your Board"
                  : screen.kind === "register" && registerStep === "class"
                    ? "Select Your Class"
                    : screen.kind === "register" && registerStep === "subject"
                      ? "Select Subject"
                  : screen.title}
              </h2>
              <p>
                {screen.kind === "register" && registerStep === "board"
                  ? "Choose your education board"
                  : screen.kind === "register" && registerStep === "class"
                    ? "Choose your class"
                    : screen.kind === "register" && registerStep === "subject"
                      ? "Choose a subject to start"
                  : screen.body}
              </p>
            </div>
            {!hideIllustration && <Illustration variant={screen.artClass} />}

            {isWelcome ? (
              <div className="home-screen-actions">
                {user ? (
                  <>
                    <button type="button" className="home-primary-cta" onClick={onChooseGetStarted}>
                      Go to Dashboard
                    </button>
                    <button type="button" className="home-secondary-cta" onClick={onChooseLogout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="home-secondary-cta" onClick={onChooseSignIn}>
                      Sign In
                    </button>
                    <p className="home-auth-divider" aria-hidden="true">
                      OR
                    </p>
                    <button type="button" className="home-primary-cta" onClick={onChooseGetStarted}>
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            ) : screen.kind === "register" ? (
              <RegisterForm
                form={registerForm}
                step={registerStep}
                error={authState.error}
                submitting={authState.submitting}
                onChange={onRegisterFieldChange}
                onTogglePolicy={onTogglePolicy}
                onContinue={onRegisterContinue}
                onSubmit={onRegisterSubmit}
                onGoogle={onRegisterGoogleAuth}
                onBack={onBackToWelcome}
                onStepBack={() => onRegisterContinue(null, true)}
                onSwitchToLogin={onSwitchToLogin}
              />
            ) : screen.kind === "login" ? (
              <LoginForm
                form={loginForm}
                error={authState.error}
                submitting={authState.submitting}
                onChange={onLoginFieldChange}
                onSubmit={onLoginSubmit}
                onGoogle={onLoginGoogleAuth}
                onBack={onBackToWelcome}
              />
            ) : screen.kind === "google" ? (
              <GoogleScreen onGoogle={onLoginGoogleAuth} onBack={onBackToWelcome} />
            ) : (
              <div className="home-screen-footer">
                <div className="home-dots" aria-hidden="true">
                  {homeScreens.slice(1, 5).map((item, dotIndex) => (
                    <span key={item.id} className={dotIndex === index - 1 ? "is-active" : ""} />
                  ))}
                </div>
                <button type="button" className="home-arrow-cta" onClick={onNext} aria-label="Next screen">
                  Continue
                </button>
              </div>
            )}
            {showBrandChrome && (
              <p className="home-onboarding-copyright">
                © 2026 Kuhedu Technologies (P) Ltd. All rights reserved.
              </p>
            )}
          </div>
        </div>
    </article>
  );
};

// Non-mobile landing page: same splash + onboarding-1/2/3 + welcome screens
// as mobile, just without the phone-mockup frame -- a single, wide, centered
// hero per screen, ChatGPT-landing-page style (big bold headline, generous
// whitespace, flat CTAs), plus a plain centered card for the auth screens.
const DesktopHomeScreen = ({
  screen,
  index,
  registerForm,
  registerStep,
  loginForm,
  authState,
  onNext,
  onChooseGetStarted,
  onChooseSignIn,
  onChooseLogout,
  onRegisterFieldChange,
  onLoginFieldChange,
  onTogglePolicy,
  onRegisterContinue,
  onRegisterSubmit,
  onLoginSubmit,
  onRegisterGoogleAuth,
  onLoginGoogleAuth,
  onBackToWelcome,
  onSwitchToLogin,
  user,
}) => {
  if (screen.kind !== "register" && screen.kind !== "login" && screen.kind !== "google") {
    const isWelcome = screen.kind === "welcome";

    return (
      <div className="home-desktop-hero">
        <h1>{screen.title}</h1>
        <p>{screen.body}</p>

        {isWelcome ? (
          <div className="home-desktop-actions">
            {user ? (
              <>
                <button type="button" className="home-primary-cta" onClick={onChooseGetStarted}>
                  Go to Dashboard
                </button>
                <button type="button" className="home-secondary-cta" onClick={onChooseLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button type="button" className="home-secondary-cta" onClick={onChooseSignIn}>
                  Sign In
                </button>
                <button type="button" className="home-primary-cta" onClick={onChooseGetStarted}>
                  Sign Up
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="home-desktop-carousel-nav">
            <div className="home-dots" aria-hidden="true">
              {homeScreens.slice(1, 5).map((item, dotIndex) => (
                <span key={item.id} className={dotIndex === index - 1 ? "is-active" : ""} />
              ))}
            </div>
            <button type="button" className="home-primary-cta" onClick={onNext}>
              Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  const heading =
    screen.kind === "register" && registerStep === "board"
      ? "Select Your Board"
      : screen.kind === "register" && registerStep === "class"
      ? "Select Your Class"
      : screen.kind === "register" && registerStep === "subject"
      ? "Select Subject"
      : screen.title;

  const subheading =
    screen.kind === "register" && registerStep === "board"
      ? "Choose your education board"
      : screen.kind === "register" && registerStep === "class"
      ? "Choose your class"
      : screen.kind === "register" && registerStep === "subject"
      ? "Choose a subject to start"
      : screen.body;

  return (
    <div className="home-desktop-auth-card">
      <h2>{heading}</h2>
      <p>{subheading}</p>
      {screen.kind === "register" ? (
        <RegisterForm
          form={registerForm}
          step={registerStep}
          error={authState.error}
          submitting={authState.submitting}
          onChange={onRegisterFieldChange}
          onTogglePolicy={onTogglePolicy}
          onContinue={onRegisterContinue}
          onSubmit={onRegisterSubmit}
          onGoogle={onRegisterGoogleAuth}
          onBack={onBackToWelcome}
          onStepBack={() => onRegisterContinue(null, true)}
          onSwitchToLogin={onSwitchToLogin}
        />
      ) : screen.kind === "login" ? (
        <LoginForm
          form={loginForm}
          error={authState.error}
          submitting={authState.submitting}
          onChange={onLoginFieldChange}
          onSubmit={onLoginSubmit}
          onGoogle={onLoginGoogleAuth}
          onBack={onBackToWelcome}
        />
      ) : (
        <GoogleScreen onGoogle={onLoginGoogleAuth} onBack={onBackToWelcome} />
      )}
    </div>
  );
};

export const HomePage = ({
  onLogin,
  onRegister,
  onOnboardingComplete,
  onLogout,
  emailOnboarding = false,
  googleOnboarding = false,
  resumeOnboarding = false,
  user,
}) => {
  const tier = useBreakpoint();
  const isMobile = tier === "mobile";
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSplashMuted, setIsSplashMuted] = useState(true);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [registerStep, setRegisterStep] = useState("details");
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [authState, setAuthState] = useState({ submitting: false, error: "" });
  const navigate = useNavigate();
  const activeScreen = homeScreens[activeIndex];
  const isPostCreateOnboarding = emailOnboarding || googleOnboarding || resumeOnboarding;

  // Primary advance is the video's own onEnded event (see the splash render
  // branch below); this is only a safety net in case the video fails to
  // fire onEnded (e.g. failed to load), so the splash screen never strands
  // a student indefinitely.
  useEffect(() => {
    if (activeIndex !== 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex(1);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    setAuthState({ submitting: false, error: "" });
    if (activeScreen.id !== "register") {
      setRegisterStep("details");
    }
  }, [activeScreen.id]);

  useEffect(() => {
    if (!isPostCreateOnboarding || !user) {
      return;
    }

    setAuthState({ submitting: false, error: "" });
    setRegisterForm((current) => ({
      ...current,
      name: user.name || current.name,
      email: user.email || current.email,
      board: user.board || "",
      studentClass: user.studentClass || "",
      subject: user.subject || "",
      acceptPolicy: true,
    }));
    setActiveIndex(screenIndexById.register);
    setRegisterStep(getOnboardingResumeStep(user));
  }, [isPostCreateOnboarding, user]);

  const goToScreen = (screenId) => {
    setActiveIndex(screenIndexById[screenId] ?? 0);
  };

  const openGoogleAuth = (intent = "login") => {
    window.location.href = `${GOOGLE_AUTH_URL}?intent=${intent}`;
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLoginField = (field, value) => {
    setLoginForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleContinue = () => {
    if (user?.role === "admin") {
      navigate("/admin");
      return;
    }

    if (user?.role === "moderator") {
      navigate("/moderator");
      return;
    }

    if (user) {
      if (!isStudentOnboardingComplete(user)) {
        setRegisterForm((current) => ({
          ...current,
          name: user.name || current.name,
          email: user.email || current.email,
          board: user.board || "",
          studentClass: user.studentClass || "",
          subject: user.subject || "",
          acceptPolicy: true,
        }));
        setActiveIndex(screenIndexById.register);
        setRegisterStep(getOnboardingResumeStep(user));
        return;
      }

      navigate("/dashboard");
      return;
    }

    goToScreen("register");
  };

  const handleRegisterContinue = async (event, goBack = false) => {
    if (event) {
      event.preventDefault();
    }

    if (goBack) {
      setAuthState({ submitting: false, error: "" });
      setRegisterStep((current) => (
        current === "subject"
          ? "class"
          : current === "class"
            ? "board"
            : isPostCreateOnboarding
              ? "board"
              : "details"
      ));
      return;
    }

    const validationError =
      registerStep === "details"
        ? validateRegisterDetails(registerForm)
        : registerStep === "board"
          ? !registerForm.board
            ? "Please select your board to continue."
            : ""
          : !registerForm.studentClass
            ? "Please select your class to continue."
            : "";

    if (validationError) {
      setAuthState({ submitting: false, error: validationError });
      return;
    }

    if (registerStep === "details" && !isPostCreateOnboarding) {
      setAuthState({ submitting: true, error: "" });

      try {
        await onRegister({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          role: registerForm.role,
        });
      } catch (error) {
        setAuthState({ submitting: false, error: error.message });
        return;
      }
    }

    setAuthState({ submitting: false, error: "" });
    setRegisterStep((current) => (
      current === "details" ? "board" : current === "board" ? "class" : "subject"
    ));
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();

    const validationError = isPostCreateOnboarding
      ? !registerForm.board
        ? "Please select your board to continue."
        : !registerForm.studentClass
          ? "Please select your class to continue."
          : !registerForm.subject
            ? "Please select your subject to continue."
            : ""
      : validateRegisterForm(registerForm);

    if (validationError) {
      setAuthState({ submitting: false, error: validationError });
      return;
    }

    if (isPostCreateOnboarding) {
      setAuthState({ submitting: true, error: "" });
      try {
        await onOnboardingComplete?.({
          board: registerForm.board,
          studentClass: registerForm.studentClass,
          subject: registerForm.subject,
        });
      } catch (error) {
        setAuthState({ submitting: false, error: error.message });
        return;
      }

      setRegisterForm(initialRegisterForm);
      setRegisterStep("details");
      setAuthState({ submitting: false, error: "" });
      return;
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setAuthState({ submitting: true, error: "" });

    try {
      await onLogin(loginForm);
    } catch (error) {
      setAuthState({ submitting: false, error: error.message });
      return;
    }

    setLoginForm(initialLoginForm);
    setAuthState({ submitting: false, error: "" });
  };

  // Splash is a single uninterruptible video -- no controls, no
  // click/keyboard/context-menu interaction, no way to skip or pause. It
  // starts muted (autoplay-with-sound is blocked by browsers until the user
  // has interacted with the page) and advances itself via onEnded (with the
  // 12s timer above as a fallback if the video never fires that event). The
  // one exception to "no controls" is a small mute/unmute toggle -- it can
  // only toggle sound, never pause/seek/skip the playback.
  if (activeScreen.kind === "splash") {
    return (
      <main className="home-splash-video-page">
        <video
          className="home-splash-video"
          src={tier === "desktop" ? "/splash_video.mp4" : "/splash_video_mobile.mp4"}
          autoPlay
          muted={isSplashMuted}
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate nofullscreen"
          onContextMenu={(event) => event.preventDefault()}
          onEnded={() => setActiveIndex(1)}
        />
        <button
          type="button"
          className="home-splash-mute-toggle"
          onClick={() => setIsSplashMuted((current) => !current)}
          aria-label={isSplashMuted ? "Unmute video" : "Mute video"}
        >
          {isSplashMuted ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.2L12 19V5L7.2 9.5H4Z" fill="currentColor" />
              <path
                d="m16 9 5 5m0-5-5 5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.2L12 19V5L7.2 9.5H4Z" fill="currentColor" />
              <path
                d="M16 8.5a5 5 0 0 1 0 7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.7"
              />
              <path
                d="M18.3 6.2a8.5 8.5 0 0 1 0 11.6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.7"
              />
            </svg>
          )}
        </button>
      </main>
    );
  }

  if (!isMobile) {
    return (
      <main className="home-desktop-page">
        <nav className="home-desktop-navbar">
          <div className="home-desktop-navbar-brand">
            <img src="/kuhedu-logo.png" alt="KUHEDU logo" />
            <span>KUHEDU MASTER</span>
          </div>
        </nav>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen.id}
            className="home-desktop-shell"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <DesktopHomeScreen
              screen={activeScreen}
              index={activeIndex}
              registerForm={registerForm}
              registerStep={registerStep}
              loginForm={loginForm}
              authState={authState}
              onNext={() => setActiveIndex((current) => Math.min(current + 1, screenIndexById.welcome))}
              onChooseGetStarted={handleContinue}
              onChooseSignIn={() => goToScreen("login")}
              onChooseLogout={onLogout}
              onRegisterFieldChange={updateRegisterField}
              onLoginFieldChange={updateLoginField}
              onTogglePolicy={() =>
                setRegisterForm((current) => ({
                  ...current,
                  acceptPolicy: !current.acceptPolicy,
                }))
              }
              onRegisterContinue={handleRegisterContinue}
              onRegisterSubmit={handleRegisterSubmit}
              onLoginSubmit={handleLoginSubmit}
              onRegisterGoogleAuth={() => openGoogleAuth("register")}
              onLoginGoogleAuth={() => openGoogleAuth("login")}
              onBackToWelcome={() => goToScreen("welcome")}
              onSwitchToLogin={() => goToScreen("login")}
              user={user}
            />
          </motion.div>
        </AnimatePresence>
        <footer className="home-desktop-footer">
          © 2026 Kuhedu Technologies (P) Ltd. All rights reserved.
        </footer>
      </main>
    );
  }

  return (
    <main className="home-gallery-page">
      <section className="home-gallery-shell">
        <motion.div
          className="home-gallery-stage"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen.id}
              className="home-gallery-track"
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -48 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <HomeScreen
                screen={activeScreen}
                index={activeIndex}
                registerForm={registerForm}
                registerStep={registerStep}
                loginForm={loginForm}
                authState={authState}
                onNext={() => setActiveIndex((current) => Math.min(current + 1, screenIndexById.welcome))}
                onChooseGetStarted={handleContinue}
                onChooseSignIn={() => goToScreen("login")}
                onChooseLogout={onLogout}
                onChooseGoogle={() => goToScreen("google")}
                onRegisterFieldChange={updateRegisterField}
                onLoginFieldChange={updateLoginField}
                onTogglePolicy={() =>
                  setRegisterForm((current) => ({
                    ...current,
                    acceptPolicy: !current.acceptPolicy,
                  }))
                }
                onRegisterContinue={handleRegisterContinue}
                onRegisterSubmit={handleRegisterSubmit}
                onLoginSubmit={handleLoginSubmit}
                onRegisterGoogleAuth={() => openGoogleAuth("register")}
                onLoginGoogleAuth={() => openGoogleAuth("login")}
                onBackToWelcome={() => goToScreen("welcome")}
                onSwitchToLogin={() => goToScreen("login")}
                user={user}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>
    </main>
  );
};
