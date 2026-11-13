import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { runAntigravityAgent } from "@/lib/agents/antigravity";
import { getAuthenticatedUserId } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { safeFetch } from "@/lib/safe-fetch";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  // Parse body ONCE — req.json() can only be called once per request
  let backend = "waterfall";
  let carouselPdf = "";
  try {
    const body = await req.json();
    backend = body.backend || "waterfall";
    carouselPdf = body.carousel_pdf || "";
  } catch (e) {
    // Request body may be empty
  }

  let prevStatus = "approved";
  let claimed = false;
  let quotaTaken = false;
  let finalized = false;
  // Set as soon as LinkedIn has accepted the post. From then on we must never
  // restore the old status or refund the quota, or the user could post it twice.
  let liveOnLinkedIn = false;
  // Hoisted so the catch below can still record them once the post is live.
  let linkedinPostId: string | null = null;
  let permalink = "";

  try {
    // 1. Fetch post details and verify ownership
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    if (post.status === "published" || post.status === "publishing") {
      return NextResponse.json(
        { error: post.status === "published" ? "This post is already published." : "This post is already being published." },
        { status: 409 }
      );
    }
    prevStatus = post.status || "approved";

    if (post.content_type === "article") {
      try {
        await db
          .from("posts")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            linkedin_post_id: `mock_article_${Math.random().toString(36).substring(2, 12)}`,
            linkedin_post_url: "https://www.linkedin.com/post/new/",
          })
          .eq("id", id);
      } catch (dbErr) {
        console.error("Failed to update article status to published:", dbErr);
      }

      return NextResponse.json({
        success: false,
        pending_review: true,
        post_content: post.post_content,
        hashtags: post.hashtags || [],
        redirect_url: "https://www.linkedin.com/post/new/",
        message: "Your article content and hashtags have been copied to your clipboard. Since LinkedIn does not support publishing articles programmatically, we are redirecting you to LinkedIn's article editor where you can paste it.",
      });
    }



    // 2. Fetch user to check limits
    const { data: user, error: userErr } = await db
      .from("users")
      .select("plan, posts_used_this_week, posts_limit_weekly, posts_used_this_month, posts_limit_monthly")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Fetch connected LinkedIn account
    const { data: accounts } = await db
      .from("linkedin_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No LinkedIn account connected. Please link your account first." }, { status: 400 });
    }

    const account = accounts[0];

    // Claim the post so a double-click / retry cannot publish twice.
    const { data: claimedRows } = await db
      .from("posts")
      .update({ status: "publishing" })
      .eq("id", id)
      .eq("user_id", userId)
      .not("status", "in", "(published,publishing)")
      .select("id");
    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: "This post is already being published." }, { status: 409 });
    }
    claimed = true;

    // Atomic quota check + increment for ALL plans (refunded below if publishing fails).
    const { data: quotaOk, error: quotaErr } = await db.rpc("consume_post_quota", { p_user: userId });
    if (quotaErr || typeof quotaOk !== "boolean") {
      // Fail closed: if the quota cannot be checked, do not publish.
      console.error("[publish] consume_post_quota failed:", quotaErr?.message || quotaOk);
      return NextResponse.json(
        { error: "We couldn't verify your posting quota. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (quotaOk === false) {
      return NextResponse.json({
        limit_hit: true,
        title: "You've hit your limit",
        body: "Upgrade to keep creating posts without interruption.",
      }, { status: 403 });
    }
    quotaTaken = true;

    linkedinPostId = `mock_share_${Math.random().toString(36).substring(2, 12)}`;
    permalink = `https://www.linkedin.com/feed/update/urn:li:share:${linkedinPostId}`;

    let isPublished = false;

    let isCarousel = false;
    let carouselTitle = "VoicePost Carousel";
    let carouselTextContent = "";
    try {
      const parsed = JSON.parse(post.post_content || "");
      if (parsed.type === "carousel" || parsed.slides) {
        isCarousel = true;
        carouselTitle = parsed.title || "VoicePost Carousel";
        carouselTextContent = `${carouselTitle}\n\n` + parsed.slides.map((s: any, idx: number) => `Slide ${idx + 1}: ${s.title || ""}\n${s.body || ""}`).join("\n\n");
      }
    } catch (e) {
      // Not a carousel
    }

    if (backend === "antigravity" && !isCarousel) {
      try {
        const { data: postImages } = await db
          .from("post_images")
          .select("url")
          .eq("post_id", id)
          .eq("is_selected", true)
          .limit(1);

        const imageUrl = postImages?.[0]?.url || null;

        const agentResponse = await runAntigravityAgent({
          action: "publish",
          post_content: `${post.post_content}\n\n${post.hashtags?.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ") || ""}`,
          image_url: imageUrl,
          linkedin_token: account.access_token,
          linkedin_profile_id: account.linkedin_profile_id,
        });

        if (agentResponse.success && agentResponse.linkedin_post_id) {
          linkedinPostId = agentResponse.linkedin_post_id;
          permalink = agentResponse.linkedin_post_url || `https://www.linkedin.com/feed/update/${linkedinPostId}`;
          isPublished = true;
          liveOnLinkedIn = true;
        } else {
          console.warn("Antigravity Agent publishing failed. Falling back to standard route logic. Error:", agentResponse.error);
        }
      } catch (err) {
        console.error("Antigravity Agent publishing exception. Falling back to standard route logic. Error:", err);
      }
    }

    const isMock = account.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    let finalPostContent = "";

    // Real LinkedIn publication flow
    if (!isMock && !isPublished) {
      try {
        if (
          !account.refresh_token &&
          account.token_expires_at &&
          new Date(account.token_expires_at).getTime() < Date.now()
        ) {
          await db.from("linkedin_accounts").update({ scraping_status: "token_expired" }).eq("id", account.id);
          return NextResponse.json({ token_expired: true, error: "LinkedIn session expired. Please reconnect your account." }, { status: 401 });
        }

        // Auto-refresh token only if expires in less than 7 days AND refresh_token exists
        if (
          account.refresh_token &&
          account.token_expires_at &&
          new Date(account.token_expires_at).getTime() - Date.now() < 7 * 86400 * 1000
        ) {
          // Token refresh flow using LinkedIn OAuth refresh token
          const refreshRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: account.refresh_token || "",
              client_id: process.env.LINKEDIN_CLIENT_ID || "",
              client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
            }),
          });
          
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            await db.from("linkedin_accounts").update({
              access_token: refreshData.access_token,
              token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            }).eq("id", account.id);
            account.access_token = refreshData.access_token;
          }
        }

        let mediaUrn = "";
        let mediaCategory = "NONE";

        if (isCarousel) {
          // 1. Check if carouselPdf is set
          if (!carouselPdf) {
            return NextResponse.json({ error: "Carousel PDF data is required for publishing." }, { status: 400 });
          }

          // 2. Decode base64 PDF
          const base64Content = carouselPdf.split(";base64,").pop();
          if (!base64Content) {
            return NextResponse.json({ error: "Invalid PDF data format." }, { status: 400 });
          }
          const pdfBuffer = Buffer.from(base64Content, "base64");

          // 3. Register document on LinkedIn
          const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-document"],
                owner: account.linkedin_profile_id,
                serviceRelationships: [
                  {
                    identifier: "urn:li:userGeneratedContent",
                    relationshipType: "OWNER",
                  },
                ],
              },
            }),
          });

          if (!registerResponse.ok) {
            throw new Error(`Failed to register document asset on LinkedIn: ${registerResponse.statusText}`);
          }

          const registerData = await registerResponse.json();
          const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
          mediaUrn = registerData.value.asset;
          mediaCategory = "DOCUMENT";

          // 4. Upload binary PDF buffer
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
            body: pdfBuffer,
          });

          if (!uploadRes.ok) {
            throw new Error(`Failed to upload PDF binary to LinkedIn: ${uploadRes.statusText}`);
          }
        } else {
          // Standard image or video check
          const { data: postImages } = await db
            .from("post_images")
            .select("url")
            .eq("post_id", id)
            .eq("is_selected", true)
            .limit(1);
          
          const selectedImage = postImages?.[0];

          if (selectedImage) {
            const isVideoAsset = selectedImage.url.startsWith("data:video/") || selectedImage.url.match(/\.(mp4|webm|ogg|mov|avi)($|\?)/i);

            if (isVideoAsset) {
              // Register video upload
              const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                  "Content-Type": "application/json",
                  "X-Restli-Protocol-Version": "2.0.0",
                },
                body: JSON.stringify({
                  registerUploadRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
                    owner: account.linkedin_profile_id,
                    serviceRelationships: [
                      {
                        identifier: "urn:li:userGeneratedContent",
                        relationshipType: "OWNER",
                      },
                    ],
                  },
                }),
              });

              if (!registerResponse.ok) {
                if (registerResponse.status === 401) {
                  await db.from("linkedin_accounts").update({ scraping_status: "token_expired" }).eq("id", account.id);
                  return NextResponse.json({ token_expired: true, error: "LinkedIn session expired. Please reconnect." }, { status: 401 });
                }
                throw new Error(`Failed to register video asset on LinkedIn: ${registerResponse.status} ${registerResponse.statusText}`);
              }

              const registerData = await registerResponse.json();
              const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
              mediaUrn = registerData.value.asset;
              mediaCategory = "VIDEO";

              // Decode base64 or fetch remote video
              let videoBuffer: Buffer;
              if (selectedImage.url.startsWith("data:")) {
                const base64Content = selectedImage.url.split(";base64,").pop();
                videoBuffer = Buffer.from(base64Content!, "base64");
              } else {
                const vidRes = await safeFetch(selectedImage.url, {}, { timeoutMs: 30_000 }); // videos are large
                const arrayBuffer = await vidRes.arrayBuffer();
                videoBuffer = Buffer.from(arrayBuffer);
              }

              const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                },
                body: videoBuffer as any,
              });

              if (!uploadRes.ok) {
                throw new Error(`Failed to upload video binary to LinkedIn: ${uploadRes.statusText}`);
              }
            } else {
              // Register image upload
              const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                  "Content-Type": "application/json",
                  "X-Restli-Protocol-Version": "2.0.0",
                },
                body: JSON.stringify({
                  registerUploadRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    owner: account.linkedin_profile_id,
                    serviceRelationships: [
                      {
                        identifier: "urn:li:userGeneratedContent",
                        relationshipType: "OWNER",
                      },
                    ],
                  },
                }),
              });

              if (!registerResponse.ok) {
                if (registerResponse.status === 401) {
                  await db.from("linkedin_accounts").update({ scraping_status: "token_expired" }).eq("id", account.id);
                  return NextResponse.json({ token_expired: true, error: "LinkedIn session expired. Please reconnect." }, { status: 401 });
                }
                throw new Error(`Failed to register image asset on LinkedIn: ${registerResponse.status} ${registerResponse.statusText}`);
              }

              const registerData = await registerResponse.json();
              const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
              mediaUrn = registerData.value.asset;
              mediaCategory = "IMAGE";

              // Fetch and upload image blob (decode manually if it is a base64 data URL)
              let imgBlob;
              if (selectedImage.url.startsWith("data:")) {
                const parts = selectedImage.url.split(",");
                const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
                const base64 = parts[1];
                const buf = Buffer.from(base64, "base64");
                imgBlob = new Blob([buf], { type: mime });
              } else {
                const imgBlobRes = await safeFetch(selectedImage.url, {}, { timeoutMs: 20_000 }); // AI images can be generated on first fetch
                if (!imgBlobRes.ok) {
                  throw new Error(`Could not download the selected image (${imgBlobRes.status}). It may have expired - please pick or regenerate it.`);
                }
                imgBlob = await imgBlobRes.blob();
              }

              const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                },
                body: imgBlob,
              });

              if (!uploadRes.ok) {
                throw new Error(`Failed to upload image binary to LinkedIn: ${uploadRes.statusText}`);
              }
            }
          }
        }

        finalPostContent = post.post_content || "";
        if (post.parent_post_id) {
          try {
            const { data: parent } = await db
              .from("posts")
              .select("linkedin_post_url")
              .eq("id", post.parent_post_id)
              .single();
            const parentUrl = parent?.linkedin_post_url || "https://www.linkedin.com/post/new/";
            finalPostContent = finalPostContent.replace(/{article_url}/g, parentUrl);
          } catch (parentErr) {
            console.error("Failed to fetch parent post for placeholder replacement:", parentErr);
          }
        }

        // Post content UGC
        const commentary = isCarousel
          ? `${carouselTitle}\n\n${post.hashtags?.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ") || ""}`
          : `${finalPostContent}\n\n${post.hashtags?.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ") || ""}`;

        const payload: any = {
          author: account.linkedin_profile_id,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: commentary },
              shareMediaCategory: mediaCategory,
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        };

        if (mediaUrn) {
          payload.specificContent["com.linkedin.ugc.ShareContent"].media = [
            {
              status: "READY",
              media: mediaUrn,
              title: { text: isCarousel ? carouselTitle : mediaCategory === "VIDEO" ? "VoicePost Video" : "VoicePost Image" },
            },
          ];
        }

        const ugcResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify(payload),
        });

        if (!ugcResponse.ok) {
          if (ugcResponse.status === 401) {
            // Token expired mid-session
            await db.from("linkedin_accounts").update({ scraping_status: "token_expired" }).eq("id", account.id);
            return NextResponse.json({ token_expired: true, error: "LinkedIn session expired. Please reconnect." }, { status: 401 });
          }
          throw new Error(`LinkedIn API returned ${ugcResponse.status} ${ugcResponse.statusText}`);
        }

        // LinkedIn accepted the post: it is live, whatever happens next.
        liveOnLinkedIn = true;
        let ugcId: string | null = ugcResponse.headers.get("x-restli-id");
        if (!ugcId) {
          try {
            ugcId = (await ugcResponse.json())?.id || null;
          } catch (parseErr) {
            console.error("[publish] could not parse ugcPosts response:", parseErr);
          }
        }
        // null (not a placeholder string) so engagement sync never queries LinkedIn with it.
        linkedinPostId = ugcId;
        permalink = ugcId
          ? `https://www.linkedin.com/feed/update/${ugcId}`
          : "https://www.linkedin.com/in/me/recent-activity/all/";

      } catch (err: any) {
        if (liveOnLinkedIn) throw err; // already live: handled by the outer finalize below
        console.error("LinkedIn OAuth publishing error:", err.message);
        // The post was NOT published. Leave it unpublished (status is restored in `finally`),
        // so no fake LinkedIn id / permalink is stored. The client can still offer a
        // copy-to-clipboard manual publish from this response.
        await logAuditEvent({
          userId,
          action: "POST_PUBLISH_FAILED",
          targetType: "post",
          targetId: id,
          details: {
            content_type: post.content_type,
            is_carousel: isCarousel,
            error: String(err.message || err).slice(0, 300),
          },
          ipAddress,
          userAgent,
        });

        return NextResponse.json({
          success: false,
          pending_review: true,
          publish_error: String(err.message || err).slice(0, 300),
          post_content: isCarousel ? carouselTextContent : finalPostContent || post.post_content,
          hashtags: post.hashtags || [],
          message: "We couldn't publish to LinkedIn automatically, so nothing was posted. Your post content and hashtags have been copied to your clipboard so you can paste them directly on LinkedIn.",
        }, { status: 502 });
      }
    }

    // 4. Update post status (retry once; the post is already live on LinkedIn)
    const publishedRow = {
      status: "published",
      published_at: new Date().toISOString(),
      linkedin_post_id: linkedinPostId,
      linkedin_post_url: permalink,
    };
    let { error: finalizeErr } = await db.from("posts").update(publishedRow).eq("id", id);
    if (finalizeErr) {
      ({ error: finalizeErr } = await db.from("posts").update(publishedRow).eq("id", id));
    }
    if (finalizeErr && !liveOnLinkedIn) {
      // Nothing reached LinkedIn (demo/mock publish): unwind the lock and quota in `finally`.
      throw new Error(`Could not record publish: ${finalizeErr.message}`);
    }
    finalized = true;
    if (finalizeErr) {
      // Live on LinkedIn but not recorded. Leave the row locked in 'publishing' so it
      // cannot be published again, keep the quota charged, and tell the user.
      console.error("[publish] post is live but DB update failed:", finalizeErr.message);
      await logAuditEvent({
        userId,
        action: "POST_PUBLISHED_UNRECORDED",
        targetType: "post",
        targetId: id,
        details: { linkedin_post_id: linkedinPostId, error: String(finalizeErr.message).slice(0, 300) },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({
        success: true,
        warning: "Your post is live on LinkedIn, but we couldn't update its status here yet.",
        linkedin_post_url: permalink,
      });
    }

    // Log successful publish audit event
    await logAuditEvent({
      userId,
      action: "POST_PUBLISHED",
      targetType: "post",
      targetId: id,
      details: {
        content_type: post.content_type,
        sandbox: false,
        is_carousel: isCarousel,
        linkedin_post_id: linkedinPostId,
        linkedin_post_url: permalink,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      published_at: new Date().toISOString(),
      linkedin_post_url: permalink,
    });

  } catch (error: any) {
    if (liveOnLinkedIn && !finalized) {
      // LinkedIn has the post; record it as published rather than unwinding.
      try {
        const { error: recErr } = await db
          .from("posts")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            linkedin_post_id: linkedinPostId,
            linkedin_post_url: permalink || null,
          })
          .eq("id", id);
        if (recErr) console.error("[publish] post is live but DB update failed:", recErr.message);
      } catch (e) {
        console.error("[publish] post is live but DB update threw:", e);
      }
      finalized = true;
      return NextResponse.json({
        success: true,
        warning: "Your post is live on LinkedIn, but some details could not be saved.",
        linkedin_post_url: permalink || undefined,
      });
    }
    console.error("[publish] unexpected error:", error);
    return NextResponse.json({ error: "Publishing failed. Please try again." }, { status: 500 });
  } finally {
    // Unwind the lock and the quota slot only if the post never reached LinkedIn.
    if (!finalized && !liveOnLinkedIn) {
      try {
        if (claimed) {
          await db.from("posts").update({ status: prevStatus }).eq("id", id).eq("status", "publishing");
        }
        if (quotaTaken) {
          await db.rpc("refund_post_quota", { p_user: userId });
        }
      } catch (e) {
        console.error("Failed to unwind publish lock/quota:", e);
      }
    }
  }
}
