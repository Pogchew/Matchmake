import { supabase } from "@/lib/supabase";

const ALLOWED_EVENTS = new Set([
  "signup_completed",
  "scrim_posted",
  "extraction_completed",
  "extraction_failed",
]);

const ALLOWED_STATUSES = new Set(["success", "failed", "pending", "open"]);

function compactMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

export async function trackLaunchAnalyticsEvent({
  eventName,
  status = "success",
  targetLabel = "Launch analytics",
  entityId = null,
  details = "",
  metadata = {},
} = {}) {
  if (!ALLOWED_EVENTS.has(eventName)) return;

  const eventStatus = ALLOWED_STATUSES.has(status) ? status : "success";

  try {
    const { error } = await supabase.rpc("track_matchmake_analytics_event", {
      event_name: eventName,
      event_status: eventStatus,
      target_label: targetLabel,
      entity_id: entityId,
      event_details: details,
      event_metadata: compactMetadata(metadata),
    });

    if (error && process.env.NODE_ENV === "development") {
      console.warn("Launch analytics event was not recorded", error);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Launch analytics event failed", error);
    }
  }
}

export function classifyExtractionFailure(error) {
  const message = error?.message || "";
  if (/too large/i.test(message)) return "upload_too_large";
  if (/timed out|too long/i.test(message)) return "timeout";
  if (/overloaded/i.test(message)) return "model_overloaded";
  if (/messy data|clearer|cropped/i.test(message)) return "parse_failed";
  if (/quota/i.test(message)) return "quota_exhausted";
  return "unknown";
}
