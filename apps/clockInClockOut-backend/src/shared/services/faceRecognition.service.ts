import { env } from "../../config/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "./logger.js";

export interface FaceMatchResult {
  matched: boolean;
  similarity: number;
  livenessPassed: boolean;
  status: "marked" | "rejected" | "spoof_suspected";
  message: string;
}

export class FaceRecognitionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (env as any).faceRecognitionApiUrl || process.env.FACE_RECOGNITION_API_URL || "http://127.0.0.1:8000";
  }

  async verifyFace(params: {
    baselineBuffer: Buffer;
    baselineFilename: string;
    captureBuffer: Buffer;
    captureFilename: string;
  }): Promise<FaceMatchResult> {
    const formData = new FormData();

    // Attach baseline registered portrait as profile_image
    formData.append(
      "profile_image",
      new Blob([new Uint8Array(params.baselineBuffer)], { type: "image/jpeg" }),
      params.baselineFilename || "profile.jpg"
    );

    // Attach live camera capture selfie as capture_image
    formData.append(
      "capture_image",
      new Blob([new Uint8Array(params.captureBuffer)], { type: "image/jpeg" }),
      params.captureFilename || "capture.jpg"
    );

    try {
      console.log("\n=======================================================");
      console.log("📤 [FACE-RECOGNITION] SENDING REQUEST TO main.py...");
      console.log(`  • URL:              ${this.baseUrl}/api/v1/attendance/mark`);
      console.log(`  • Baseline size:    ${params.baselineBuffer.length} bytes`);
      console.log(`  • Capture size:     ${params.captureBuffer.length} bytes`);
      console.log("=======================================================");

      logger.info({ url: `${this.baseUrl}/api/v1/attendance/mark` }, "Calling Face Recognition API");

      const response = await fetch(`${this.baseUrl}/api/v1/attendance/mark`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("\n❌ [FACE-RECOGNITION] ERROR RESPONSE FROM main.py (Port 8000):");
        console.error(`  • HTTP Status:      ${response.status}`);
        console.error("  • Details:         ", JSON.stringify(errorData, null, 2));
        console.error("=======================================================\n");

        const errMsg = errorData?.detail || errorData?.error || errorData?.message || "Face recognition verification failed.";
        logger.warn({ status: response.status, errorData }, "Face Recognition API returned non-200");
        throw new AppError(
          typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
          response.status === 422 ? 400 : response.status,
          "ERR_FACE_VERIFICATION_FAILED"
        );
      }

      const data = await response.json();

      // High-visibility terminal logging
      console.log("\n=======================================================");
      console.log("📸 [FACE-RECOGNITION] RESPONSE RECEIVED FROM main.py:");
      console.log(JSON.stringify(data, null, 2));
      console.log("-------------------------------------------------------");
      console.log(`  • Status:           ${data.status}`);
      console.log(`  • Is Match:         ${data.is_match}`);
      console.log(`  • Match Confidence: ${(Number(data.match_confidence || 0) * 100).toFixed(2)}%`);
      console.log(`  • Cosine Distance:  ${data.distance}`);
      console.log(`  • Liveness Passed:  ${data.liveness?.is_live}`);
      console.log(`  • Liveness Score:   ${data.liveness?.liveness_score}`);
      if (data.liveness?.reasons?.length > 0) {
        console.log(`  • Spoof Flags:      ${data.liveness.reasons.join(", ")}`);
      }
      console.log(`  • Message:          ${data.message}`);
      console.log("=======================================================\n");

      logger.info({ data }, "Face Recognition API response received");

      const isMatch = Boolean(data.is_match ?? data.matched);
      const isLive = Boolean(data.liveness?.is_live ?? data.liveness_passed ?? true);
      const confidence = Number(data.match_confidence ?? data.similarity ?? 0);

      return {
        matched: isMatch,
        similarity: confidence,
        livenessPassed: isLive,
        status: data.status || (isMatch && isLive ? "marked" : !isLive ? "spoof_suspected" : "rejected"),
        message: data.message || "",
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error("\n❌ [FACE-RECOGNITION] EXCEPTION CONNECTING TO main.py:", err.message);
      logger.error({ err: err.message }, "Error connecting to Face Recognition API");
      throw new AppError(
        `Face recognition service unavailable: ${err.message}`,
        503,
        "ERR_AI_SERVICE_UNAVAILABLE"
      );
    }
  }
}

export const faceRecognitionService = new FaceRecognitionService();
