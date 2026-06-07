import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2023-10-16" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } else {
      // Local dev/standalone mode fallback
      const body = JSON.parse(payload);
      event = body as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Stripe signature validation failed:", err.message);
    return NextResponse.json({ error: "Webhook Error: " + err.message }, { status: 400 });
  }

  // 1. Return 200 within 2s limit
  const response = NextResponse.json({ received: true }, { status: 200 });

  // 2. Process event asynchronously (unawaited)
  processStripeEventAsync(event).catch((err) => {
    console.error("Error processing Stripe event async:", err);
  });

  return response;
}

async function processStripeEventAsync(event: Stripe.Event) {
  const db = getServiceSupabase();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const stripeCustomerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;

      // Map Stripe Price IDs to internal plan tiers
      const plan = mapPriceIdToPlan(priceId);
      const limits = getLimitsForPlan(plan);

      // Fetch user by customer ID or email
      const { data: user } = await db
        .from("users")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (user) {
        await db.from("users").update({
          plan: plan,
          posts_limit_weekly: limits.posts_limit_weekly,
          posts_limit_monthly: limits.posts_limit_monthly,
          ai_images_limit_weekly: limits.ai_images_limit_weekly,
          plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
          plan_interval: subscription.items.data[0]?.price.recurring?.interval || "month",
          // Reset usage counters on plan update/billing anniversary
          posts_used_this_week: 0,
          posts_used_this_month: 0,
          ai_images_used_this_week: 0,
          ai_images_used_this_month: 0,
          month_reset_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", user.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const stripeCustomerId = subscription.customer as string;

      // Downgrade to free tier
      const { data: user } = await db
        .from("users")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (user) {
        await db.from("users").update({
          plan: "free",
          posts_limit_weekly: 3,
          posts_limit_monthly: 0,
          ai_images_limit_weekly: 3,
          plan_expires_at: null,
          plan_interval: null,
        }).eq("id", user.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      // In a production app, we would log this, trigger in-app payment warning banners,
      // and optionally send a notification email to the customer.
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`Payment failed for invoice ${invoice.id} of customer ${invoice.customer}`);
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}

function mapPriceIdToPlan(priceId: string): "free" | "starter" | "pro" | "agency" {
  if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_YEARLY_PRICE_ID) {
    return "starter";
  }
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    return "pro";
  }
  if (priceId === process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_AGENCY_YEARLY_PRICE_ID) {
    return "agency";
  }
  return "free";
}

function getLimitsForPlan(plan: "free" | "starter" | "pro" | "agency") {
  switch (plan) {
    case "starter":
      return { posts_limit_weekly: 0, posts_limit_monthly: 15, ai_images_limit_weekly: 10 };
    case "pro":
      return { posts_limit_weekly: 0, posts_limit_monthly: 60, ai_images_limit_weekly: 60 };
    case "agency":
      return { posts_limit_weekly: 0, posts_limit_monthly: 999999, ai_images_limit_weekly: 999999 };
    case "free":
    default:
      return { posts_limit_weekly: 3, posts_limit_monthly: 0, ai_images_limit_weekly: 3 };
  }
}
