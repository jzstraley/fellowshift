import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface FeedbackPayload {
  feedbackId: string;
  type: string;
  message: string;
  anonymous: boolean;
  userName?: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: FeedbackPayload = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500 }
      );
    }

    const userLabel = payload.anonymous ? "Anonymous User" : payload.userName || "Unknown User";

    const emailBody = `
New Feedback Submission

Type: ${payload.type}
From: ${userLabel}
Feedback ID: ${payload.feedbackId}

Message:
${payload.message}
    `.trim();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "noreply@fellowshift.app",
        to: "james@fellowshift.app",
        subject: `FellowShift Feedback: ${payload.type}`,
        text: emailBody,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: response.status }
      );
    }

    const result = await response.json();
    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-feedback:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
