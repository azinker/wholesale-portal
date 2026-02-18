import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendApplicantApprovalEmail } from "../email";

const mockSend = vi.fn().mockResolvedValue({ data: { id: "resend-123" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("sendApplicantApprovalEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_test_123",
      NEXT_PUBLIC_APP_URL: "https://wholesale.example.com",
    };
  });

  it("sends an email via Resend with correct to, subject, and from", async () => {
    await sendApplicantApprovalEmail("applicant@example.com", "Acme Corp");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.to).toBe("applicant@example.com");
    expect(payload.subject).toBe("Your wholesale account has been approved — The Perfect Part");
    expect(payload.from).toBeDefined();
  });

  it("includes company name and login link in the email body", async () => {
    await sendApplicantApprovalEmail("bob@acme.com", "Acme Corp");

    const payload = mockSend.mock.calls[0][0];
    expect(payload.html).toContain("Acme Corp");
    expect(payload.html).toContain("wholesale.example.com/login");
    expect(payload.html).toContain("You're approved for wholesale");
  });

  it("does not throw when Resend returns success", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "ok" }, error: null });
    await expect(
      sendApplicantApprovalEmail("a@b.com", "Biz")
    ).resolves.toBeUndefined();
  });

  it("does not throw when Resend returns an error (logs only)", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "Rate limited" } });
    await expect(
      sendApplicantApprovalEmail("a@b.com", "Biz")
    ).resolves.toBeUndefined();
  });

  it("skips sending and returns early when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    // Force module to re-use getResend; the key check is inside sendApplicantApprovalEmail
    await sendApplicantApprovalEmail("a@b.com", "Biz");
    expect(mockSend).not.toHaveBeenCalled();
  });
});
