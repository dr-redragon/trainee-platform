import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API = "https://api.resend.com/emails";
const FROM_EMAIL = "HST Training Hub <onboarding@resend.dev>";

interface EmailPayload {
  type: "submission_confirmation" | "new_request_alert" | "approved" | "rejected";
  applicant_email: string;
  applicant_name: string;
  specialty_name?: string;
  training_grade?: string;
  review_note?: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error [${res.status}]: ${body}`);
  }
  return res.json();
}

function submissionConfirmationHtml(name: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1a1a2e;margin-bottom:16px">Request Received</h2>
      <p style="color:#4a4a5a;line-height:1.6">Hi ${name},</p>
      <p style="color:#4a4a5a;line-height:1.6">
        Thank you for requesting access to the <strong>HST Training Hub</strong>.
        Your application has been received and will be reviewed by an administrator.
      </p>
      <p style="color:#4a4a5a;line-height:1.6">
        You'll receive another email once your request has been reviewed.
      </p>
      <p style="color:#8a8a9a;font-size:13px;margin-top:32px">— HST Training Hub</p>
    </div>`;
}

function newRequestAlertHtml(name: string, email: string, specialty: string, grade?: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1a1a2e;margin-bottom:16px">New Access Request</h2>
      <p style="color:#4a4a5a;line-height:1.6">A new access request has been submitted:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px 12px;color:#8a8a9a;font-size:13px">Name</td><td style="padding:8px 12px;color:#1a1a2e;font-weight:600">${name}</td></tr>
        <tr style="background:#f8f8fc"><td style="padding:8px 12px;color:#8a8a9a;font-size:13px">Email</td><td style="padding:8px 12px;color:#1a1a2e">${email}</td></tr>
        <tr><td style="padding:8px 12px;color:#8a8a9a;font-size:13px">Specialty</td><td style="padding:8px 12px;color:#1a1a2e">${specialty}</td></tr>
        ${grade ? `<tr style="background:#f8f8fc"><td style="padding:8px 12px;color:#8a8a9a;font-size:13px">Grade</td><td style="padding:8px 12px;color:#1a1a2e">${grade}</td></tr>` : ""}
      </table>
      <p style="color:#4a4a5a;line-height:1.6">Please log in to the Admin Panel to review this request.</p>
      <p style="color:#8a8a9a;font-size:13px;margin-top:32px">— HST Training Hub</p>
    </div>`;
}

function approvedHtml(name: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1a1a2e;margin-bottom:16px">Access Approved ✅</h2>
      <p style="color:#4a4a5a;line-height:1.6">Hi ${name},</p>
      <p style="color:#4a4a5a;line-height:1.6">
        Great news! Your access request for the <strong>HST Training Hub</strong> has been approved.
      </p>
      <p style="color:#4a4a5a;line-height:1.6">
        You should receive a separate email with your login credentials shortly.
        If you don't receive it, please contact your specialty facilitator.
      </p>
      <p style="color:#8a8a9a;font-size:13px;margin-top:32px">— HST Training Hub</p>
    </div>`;
}

function rejectedHtml(name: string, note?: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1a1a2e;margin-bottom:16px">Access Request Update</h2>
      <p style="color:#4a4a5a;line-height:1.6">Hi ${name},</p>
      <p style="color:#4a4a5a;line-height:1.6">
        Unfortunately, your access request for the HST Training Hub was not approved at this time.
      </p>
      ${note ? `<p style="color:#4a4a5a;line-height:1.6;background:#f8f8fc;padding:12px 16px;border-radius:8px;border-left:3px solid #ccc"><em>${note}</em></p>` : ""}
      <p style="color:#4a4a5a;line-height:1.6">
        If you believe this was in error, please contact your training programme director.
      </p>
      <p style="color:#8a8a9a;font-size:13px;margin-top:32px">— HST Training Hub</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { type, applicant_email, applicant_name } = payload;

    if (type === "submission_confirmation") {
      // Send confirmation to applicant
      await sendEmail(applicant_email, "Access Request Received — HST Training Hub", submissionConfirmationHtml(applicant_name));

      // Also notify admins + facilitators for the chosen specialty
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Get admin user IDs
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminIds = adminRoles?.map((r: any) => r.user_id) ?? [];

      // Get facilitator user IDs for the chosen specialty
      let facilitatorIds: string[] = [];
      if (payload.specialty_name && payload.specialty_name !== "General") {
        // Look up specialty ID by name
        const { data: specs } = await supabaseAdmin
          .from("specialties")
          .select("id")
          .eq("short_name", payload.specialty_name);
        if (specs && specs.length > 0) {
          const { data: facRoles } = await supabaseAdmin
            .from("facilitator_specialties")
            .select("user_id")
            .eq("specialty_id", specs[0].id);
          facilitatorIds = facRoles?.map((r: any) => r.user_id) ?? [];
        }
      }

      // Combine unique user IDs
      const notifyIds = [...new Set([...adminIds, ...facilitatorIds])];

      // Get their emails from profiles
      if (notifyIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .in("user_id", notifyIds);

        const emails = profiles?.map((p: any) => p.email).filter(Boolean) ?? [];
        const alertHtml = newRequestAlertHtml(
          applicant_name,
          applicant_email,
          payload.specialty_name || "General",
          payload.training_grade,
        );

        // Send to each admin/facilitator individually (Resend test domain limitation)
        for (const email of emails) {
          try {
            await sendEmail(email, `New Access Request: ${applicant_name}`, alertHtml);
          } catch (e) {
            console.error(`Failed to notify ${email}:`, e);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "approved") {
      await sendEmail(applicant_email, "Access Approved — HST Training Hub", approvedHtml(applicant_name));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "rejected") {
      await sendEmail(applicant_email, "Access Request Update — HST Training Hub", rejectedHtml(applicant_name, payload.review_note));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown email type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
