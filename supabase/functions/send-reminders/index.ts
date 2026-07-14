import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import webpush from "npm:web-push@3.6.7";

type ClaimedReminder = {
  delivery_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  subscription_auth: string;
  task_id: string;
  task_text: string;
  scheduled_for: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: jsonHeaders, status });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("Authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: "Missing server secrets" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc("claim_due_push_reminders");
  if (error) return jsonResponse({ error: error.message }, 500);

  const reminders = (data ?? []) as ClaimedReminder[];
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let delivered = 0;
  let expired = 0;
  let retrying = 0;

  await Promise.all(reminders.map(async (reminder) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: reminder.endpoint,
          keys: {
            auth: reminder.subscription_auth,
            p256dh: reminder.p256dh,
          },
        },
        JSON.stringify({
          title: "Lili · Recordatorio",
          body: reminder.task_text,
          tag: `task-${reminder.task_id}`,
          url: "/",
        }),
        {
          TTL: 21_600,
          topic: reminder.task_id.replaceAll("-", "").slice(0, 32),
          urgency: "normal",
        },
      );

      await admin
        .from("push_reminder_deliveries")
        .update({ delivered_at: new Date().toISOString() })
        .eq("id", reminder.delivery_id);
      delivered += 1;
    } catch (caughtError) {
      const statusCode = typeof caughtError === "object" && caughtError
        && "statusCode" in caughtError
        ? Number(caughtError.statusCode)
        : 0;

      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", reminder.subscription_id);
        expired += 1;
      } else {
        await admin.from("push_reminder_deliveries").delete().eq("id", reminder.delivery_id);
        retrying += 1;
      }
    }
  }));

  return jsonResponse({ claimed: reminders.length, delivered, expired, retrying });
});
