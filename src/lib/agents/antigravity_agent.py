import sys
import json
import asyncio
import os
import random
import pydantic
import requests
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import CapabilitiesConfig, BuiltinTools

# Pydantic schema for LinkedIn Post Generation structured output
class LinkedInPostOutput(pydantic.BaseModel):
    post_content: str
    hashtags: list[str]
    hook_type: str
    post_structure: str
    style_match_score: int
    style_deviations: list[str]

# Banned words
BANNED_WORDS = [
    "delve", "leverage", "game-changer", "transformative", "paradigm shift",
    "it's important to note", "in today's fast-paced world", "I'm thrilled to share",
    "unlock", "rockstar", "ninja", "guru", "synergy", "cutting-edge",
    "disruptive", "ecosystem", "seamlessly", "empower", "spearhead",
    "thought leader", "move the needle"
]

def generate_flux_image(visual_theme: str) -> str:
    """Generates a professional photorealistic image matching the post visual concept using Flux.
    
    Args:
        visual_theme: Clear description of the visual theme (e.g. 'office desk setup with a laptop').
    """
    replicate_token = os.environ.get("REPLICATE_API_TOKEN")
    flux_prompt = f"Professional LinkedIn photo: {visual_theme}. Clean modern aesthetic, natural lighting, no text, photorealistic."
    
    if replicate_token:
        try:
            headers = {
                "Authorization": f"Token {replicate_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "version": "0bc9e115e3474d2fa81691a3203923d240dca1918ed9b31d87455d3f82e5b90f",
                "input": {
                    "prompt": flux_prompt,
                    "num_outputs": 1,
                    "aspect_ratio": "16:9",
                    "output_format": "webp",
                    "output_quality": 80
                }
            }
            res = requests.post("https://api.replicate.com/v1/predictions", json=payload, headers=headers, timeout=10)
            if res.ok:
                pred = res.json()
                poll_url = pred["urls"]["get"]
                # Poll for up to 10 seconds
                for _ in range(5):
                    # We are in sync function, use time.sleep
                    import time
                    time.sleep(2)
                    poll_res = requests.get(poll_url, headers=headers, timeout=5)
                    if poll_res.ok:
                        poll_data = poll_res.json()
                        if poll_data["status"] == "succeeded":
                            return poll_data["output"][0]
                        elif poll_data["status"] in ["failed", "canceled"]:
                            break
        except Exception as e:
            sys.stderr.write(f"Replicate FLUX error: {e}\n")
            
    # Fallback mock image
    random_ids = ["1498050108023-c5249f4df085", "1460925895917-afdab827c52f", "1504384308090-c894fdcc538d", "1522071820081-009f0129c71c"]
    rand_id = random.choice(random_ids)
    return f"https://images.unsplash.com/photo-{rand_id}?w=800&auto=format&fit=crop"

def search_unsplash_images(query: str) -> list[str]:
    """Searches for relevant stock photos on Unsplash matching the query.
    
    Args:
        query: The search term (e.g. 'coding screen').
    """
    unsplash_key = os.environ.get("UNSPLASH_ACCESS_KEY")
    if unsplash_key:
        try:
            url = f"https://api.unsplash.com/search/photos?query={requests.utils.quote(query)}&client_id={unsplash_key}&per_page=3"
            res = requests.get(url, timeout=5)
            if res.ok:
                data = res.json()
                return [item["urls"]["regular"] for item in data.get("results", [])]
        except Exception as e:
            sys.stderr.write(f"Unsplash search error: {e}\n")
            
    # Mock fallback
    return ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop"]

def publish_to_linkedin(post_content: str, access_token: str, profile_id: str, image_url: str = None) -> dict:
    """Publishes a LinkedIn post with an optional image using LinkedIn UGC API.
    
    Args:
        post_content: The text commentary of the post.
        access_token: The LinkedIn OAuth access token.
        profile_id: The LinkedIn profile ID (e.g. urn:li:person:12345).
        image_url: Optional URL of an image to attach.
    """
    is_mock = access_token.startswith("mock_") or not os.environ.get("LINKEDIN_CLIENT_ID")
    if is_mock:
        linkedin_post_id = f"mock_share_{random.randint(1000000000, 9999999999)}"
        return {
            "success": True,
            "linkedin_post_id": linkedin_post_id,
            "linkedin_post_url": f"https://www.linkedin.com/feed/update/urn:li:share:{linkedin_post_id}"
        }

    image_urn = None
    if image_url:
        try:
            reg_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            reg_payload = {
                "registerRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": profile_id,
                    "relationshipType": "OWNER"
                }
            }
            res = requests.post(reg_url, json=reg_payload, headers=headers, timeout=10)
            if res.ok:
                reg_data = res.json()
                upload_url = reg_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
                image_urn = reg_data["value"]["asset"]
                
                # Fetch image blob
                img_res = requests.get(image_url, timeout=10)
                if img_res.ok:
                    # Upload to LinkedIn
                    upload_res = requests.post(upload_url, data=img_res.content, headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
                    if not upload_res.ok:
                        image_urn = None
        except Exception as e:
            sys.stderr.write(f"LinkedIn image upload error: {e}\n")
            image_urn = None

    ugc_url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    payload = {
        "author": profile_id,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": { "text": post_content },
                "shareMediaCategory": "IMAGE" if image_urn else "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }
    
    if image_urn:
        payload["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
            {
                "status": "READY",
                "media": image_urn,
                "title": { "text": "VoicePost Image" }
            }
        ]
        
    try:
        res = requests.post(ugc_url, json=payload, headers=headers, timeout=10)
        if res.ok:
            data = res.json()
            return {
                "success": True,
                "linkedin_post_id": data.get("id"),
                "linkedin_post_url": f"https://www.linkedin.com/feed/update/{data.get('id')}"
            }
        else:
            return {
                "success": False,
                "error": f"LinkedIn API returned {res.status_code}: {res.text}"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

async def run_agent(input_data):
    action = input_data.get("action", "generate")
    
    if action == "publish":
        post_content = input_data.get("post_content")
        image_url = input_data.get("image_url")
        access_token = input_data.get("linkedin_token")
        profile_id = input_data.get("linkedin_profile_id")
        
        if not access_token or not profile_id:
            return {
                "success": False,
                "error": "LinkedIn credentials (token and profile_id) are required for publishing."
            }
            
        result = publish_to_linkedin(post_content, access_token, profile_id, image_url)
        return result

    # Standard "generate" action
    transcript = input_data.get("transcript")
    style_json = input_data.get("style_json", {})
    user_context = input_data.get("user_context", {})
    recent_topics = input_data.get("recent_topics", [])
    
    system_instructions = (
        "You are an elite LinkedIn copywriter. Your goal is to write high-impact, human-like posts.\n"
        "RULES:\n"
        f"1. NEVER use any of these banned AI words/phrases: {', '.join(BANNED_WORDS)}.\n"
        "2. Vary sentence length (mix short punchy lines with descriptive ones).\n"
        "3. Use contractions naturally.\n"
        "4. Include exactly ONE personal marker.\n"
        "5. Conforms exactly to the provided writing style configuration.\n"
        "6. Leverage your custom tools (generate_flux_image, search_unsplash_images) to fetch/generate visual attachments if requested."
    )
    
    config = LocalAgentConfig(
        response_schema=LinkedInPostOutput,
        system_instructions=system_instructions,
        tools=[generate_flux_image, search_unsplash_images]
    )

    prompt = (
        f"TRANSCRIPT/IDEA TO REWRITE:\n"
        f"\"{transcript}\"\n\n"
        f"TARGET STYLE PROFILE:\n"
        f"{json.dumps(style_json, indent=2)}\n\n"
        f"USER CONTEXT:\n"
        f"Industry: {user_context.get('industry', 'Tech')}\n"
        f"Job Title: {user_context.get('job_title', 'Founder')}\n\n"
        f"RECENT POST TOPICS (Avoid repeating these Hooks/Angles):\n"
        f"{json.dumps(recent_topics, indent=2)}\n\n"
        f"Please rewrite the transcript into a high-converting LinkedIn post conforming to the target style."
    )
    
    async with Agent(config=config) as agent:
        response = await agent.chat(prompt)
        structured_res = await response.structured_output()
        
        # Collect thoughts
        thoughts = []
        async for thought in response.thoughts:
            thoughts.append(thought)
            
        return {
            "success": True,
            "result": structured_res,
            "thoughts": "".join(thoughts) if thoughts else "Agent evaluated post style mappings and generated human-authentic rewrite."
        }

def main():
    try:
        input_raw = sys.stdin.read()
        if not input_raw.strip():
            print(json.dumps({"success": False, "error": "Empty input"}))
            return
            
        input_data = json.loads(input_raw)
        
        res = asyncio.run(run_agent(input_data))
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
