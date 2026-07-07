import { useEffect, useState } from "react";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.5 8.5 9 6.8c.2-.2.4-.3.7-.3h4.6c.3 0 .5.1.7.3l1.5 1.7h1.8A1.7 1.7 0 0 1 20 10.2v6.3a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 16.5v-6.3a1.7 1.7 0 0 1 1.7-1.7Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
  </svg>
);

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const avatarLetters = (name) =>
  String(name || "ST")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const EditProfileModal = ({ open, onClose, user, onSave }) => {
  const [name, setName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setAvatarPreview(user?.avatarUrl || "");
      setAvatarDataUrl(null);
      setError("");
    }
  }, [open, user]);

  if (!open) {
    return null;
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarDataUrl(dataUrl);
      setAvatarPreview(dataUrl);
    } catch (readError) {
      setError(readError.message || "Failed to read the selected image.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      setError(`Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters long.`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave({ name: trimmedName, avatarDataUrl });
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <button className="close-button" onClick={onClose} type="button">
          x
        </button>
        <p className="eyebrow">Profile</p>
        <h2>Edit Profile</h2>

        <form className="auth-form" onSubmit={submit}>
          <div className="account-modal-avatar-row">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="student-profile-avatar" />
            ) : (
              <div className="student-profile-avatar student-profile-avatar-fallback">
                {avatarLetters(name)}
              </div>
            )}
            <label className="student-ocr-upload-button">
              <CameraIcon />
              <span>Change photo</span>
              <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </label>
          </div>

          <label>
            Full name
            <input
              name="name"
              value={name}
              minLength={MIN_NAME_LENGTH}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
};
