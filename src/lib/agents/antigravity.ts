import { spawn } from "child_process";
import path from "path";

export interface AntigravityAgentInput {
  action: "generate" | "publish";
  transcript?: string;
  style_json?: any;
  user_context?: {
    industry?: string;
    job_title?: string;
  };
  recent_topics?: string[];
  linkedin_token?: string;
  linkedin_profile_id?: string;
  post_content?: string;
  image_url?: string;
}

export interface AntigravityAgentResponse {
  success: boolean;
  result?: {
    post_content: string;
    hashtags: string[];
    hook_type: string;
    post_structure: string;
    style_match_score: number;
    style_deviations: string[];
  };
  thoughts?: string;
  error?: string;
  linkedin_post_id?: string;
  linkedin_post_url?: string;
}

export function runAntigravityAgent(input: AntigravityAgentInput): Promise<AntigravityAgentResponse> {
  return new Promise((resolve) => {
    const workspaceRoot = process.cwd();
    const pythonPath = path.join(workspaceRoot, ".venv", "bin", "python");
    const scriptPath = path.join(workspaceRoot, "src", "lib", "agents", "antigravity_agent.py");

    const env = {
      ...process.env,
      // Map Gemini key from environment
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    };

    const pyProcess = spawn(pythonPath, [scriptPath], { env });

    let stdout = "";
    let stderr = "";

    pyProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pyProcess.on("close", (code) => {
      if (stderr) {
        console.warn("Python agent stderr:", stderr);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        console.error("Failed to parse Python agent output:", stdout);
        resolve({
          success: false,
          error: `Agent execution failed (code ${code}): ${stderr || "Invalid JSON output"}`
        });
      }
    });

    // Write input JSON to stdin
    pyProcess.stdin.write(JSON.stringify(input));
    pyProcess.stdin.end();
  });
}
