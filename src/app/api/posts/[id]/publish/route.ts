import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { runAntigravityAgent } from "@/lib/agents/antigravity";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

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

  try {
    // 1. Fetch post details
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const userId = post.user_id;

    // 2. Fetch user to check limits
    const { data: user, error: userErr } = await db
      .from("users")
      .select("plan, posts_used_this_week, posts_limit_weekly, posts_used_this_month, posts_limit_monthly")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Gatekeeper check before final publish
    if (user.plan === "free" && user.posts_used_this_week >= (user.posts_limit_weekly || 3)) {
      return NextResponse.json({
        limit_hit: true,
        title: "You've hit your limit",
        body: "Upgrade to keep creating posts without interruption.",
      }, { status: 403 });
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

    let linkedinPostId = `mock_share_${Math.random().toString(36).substring(2, 12)}`;
    let permalink = `https://www.linkedin.com/feed/update/urn:li:share:${linkedinPostId}`;

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
        } else {
          console.warn("Antigravity Agent publishing failed. Falling back to standard route logic. Error:", agentResponse.error);
        }
      } catch (err) {
        console.error("Antigravity Agent publishing exception. Falling back to standard route logic. Error:", err);
      }
    }

    const isMock = account.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    // Real LinkedIn publication flow
    if (!isMock && !isPublished) {
      try {
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
            },
            body: JSON.stringify({
              registerRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-document"],
                owner: account.linkedin_profile_id,
                relationshipType: "OWNER",
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
                },
                body: JSON.stringify({
                  registerRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
                    owner: account.linkedin_profile_id,
                    relationshipType: "OWNER",
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
                const vidRes = await fetch(selectedImage.url);
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
                },
                body: JSON.stringify({
                  registerRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    owner: account.linkedin_profile_id,
                    relationshipType: "OWNER",
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

              // Fetch and upload image blob
              const imgBlobRes = await fetch(selectedImage.url);
              const imgBlob = await imgBlobRes.blob();

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

        // Post content UGC
        const commentary = isCarousel
          ? `${carouselTitle}\n\n${post.hashtags?.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ") || ""}`
          : `${post.post_content}\n\n${post.hashtags?.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ") || ""}`;

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

        const ugcData = await ugcResponse.json();
        linkedinPostId = ugcData.id;
        permalink = `https://www.linkedin.com/feed/update/${linkedinPostId}`;

      } catch (err: any) {
        console.error("LinkedIn OAuth publishing error:", err.message);
        // Fallback action sheet support if API review pending
        return NextResponse.json({
          success: false,
          pending_review: true,
          post_content: isCarousel ? carouselTextContent : post.post_content,
          hashtags: post.hashtags,
          message: "VoicePost's LinkedIn API integration is currently in sandbox mode (pending official review). Your post content and hashtags have been copied to your clipboard so you can paste them directly on LinkedIn.",
        });
      }
    }

    // 4. Update post status
    await db
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        linkedin_post_id: linkedinPostId,
        linkedin_post_url: permalink,
      })
      .eq("id", id);

    // 5. Update user limits
    await db
      .from("users")
      .update({
        posts_used_this_week: user.posts_used_this_week + 1,
        posts_used_this_month: user.posts_used_this_month + 1,
      })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      published_at: new Date().toISOString(),
      linkedin_post_url: permalink,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
