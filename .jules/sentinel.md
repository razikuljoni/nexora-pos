## 2024-05-24 - Plaintext UI PIN Display
**Vulnerability:** User PINs were rendered in plaintext in the React `SettingsView` component (`{u.pin}`).
**Learning:** The frontend state contained the plaintext PIN and developers rendered it directly into the DOM instead of masking it, making it vulnerable to shoulder surfing or screen sharing.
**Prevention:** Always ensure sensitive fields like passwords, API keys, or PINs are masked (e.g. `****`) or omitted entirely from the UI representation.
