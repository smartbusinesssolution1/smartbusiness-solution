import { env } from "../../config/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "./logger.js";

export interface BurstLivenessDetail {
  is_live: boolean;
  liveness_score: number;
  blink_detected: boolean;
  motion_ok: boolean;
  challenge_ok: boolean;
  screen_detected: boolean;
  reasons: string[];
  per_frame_scores: number[];
}

export interface FaceMatchResult {
  matched: boolean;
  similarity: number;
  livenessPassed: boolean;
  status: "marked" | "rejected" | "spoof_suspected";
  message: string;
  distance?: number;
  liveness?: BurstLivenessDetail;
}

export interface ChallengeData {
  challenge_token: string;
  steps: string[];
  expires_in: number;
  frontal_max: number;
  turn_min: number;
  left_yaw_sign: number;
  blink_step: boolean;
  blink_closed_ratio: number;
  blink_open_ratio: number;
  pre_frontal_frames: number;
  expected_frames: number;
}

export class FaceRecognitionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (env as any).faceRecognitionApiUrl || process.env.FACE_RECOGNITION_API_URL || "http://127.0.0.1:8000";
  }

  /**
   * Request a fresh, signed, single-use active liveness challenge token
   * from the face-recognition microservice.
   */
  async getChallenge(): Promise<ChallengeData> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/api/v1/attendance/challenge`;
    try {
      logger.info({ url: endpoint }, "Requesting Face Recognition challenge token");

      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
                logger.warn({ status: response.status, durationMs, errorData }, "Challenge request failed");
        const errMsg = errorData?.detail || errorData?.error || "Failed to issue liveness challenge.";
        throw new AppError(errMsg, response.status, "ERR_FACE_CHALLENGE_FAILED");
      }

      const data = (await response.json()) as ChallengeData;
            logger.info({ steps: data.steps, durationMs }, "Challenge token received successfully");
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      const durationMs = Date.now() - startTime;
            logger.error({ err: err.message, durationMs }, "AI Face Recognition challenge service is unavailable");
      throw new AppError(
        "AI Face Recognition microservice is unavailable. Please ensure the AI service is running on port 8000.",
        503,
        "ERR_AI_SERVICE_UNAVAILABLE"
      );
    }
  }

  /**
   * Primary attendance verification: Compares registered baseline portrait against
   * a multi-frame live capture burst while validating the server's signed challenge token.
   */
  async verifyFaceBurst(params: {
    baselineBuffer: Buffer;
    baselineFilename: string;
    captureBuffers: Buffer[];
    captureFilenames?: string[];
    challengeToken: string;
  }): Promise<FaceMatchResult> {
    if (params.challengeToken?.startsWith("srv_fallback_")) {
      throw new AppError(
        "Face verification rejected: Fallback challenge tokens are invalid. AI microservice must be running.",
        503,
        "ERR_AI_SERVICE_UNAVAILABLE"
      );
    }

    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/api/v1/attendance/mark-burst`;
    const totalCaptureBytes = params.captureBuffers.reduce((sum, b) => sum + b.length, 0);

    const formData = new FormData();

    // Attach baseline registered portrait
    formData.append(
      "profile_image",
      new Blob([new Uint8Array(params.baselineBuffer)], { type: "image/jpeg" }),
      params.baselineFilename || "profile.jpg"
    );

    // Attach burst frames in capture order
    params.captureBuffers.forEach((buffer, index) => {
      const filename = params.captureFilenames?.[index] || `frame_${index}.jpg`;
      formData.append(
        "capture_images",
        new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
        filename
      );
    });

    // Attach signed single-use challenge token
    formData.append("challenge_token", params.challengeToken);

    
    logger.info(
      {
        url: endpoint,
        baselineSize: params.baselineBuffer.length,
        frameCount: params.captureBuffers.length,
        totalCaptureBytes,
        challengeToken: params.challengeToken.substring(0, 20) + "...",
      },
      "Calling Face Recognition mark-burst API"
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30000), // 30-second AI processing timeout
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("\n=======================================================");
        console.error(`❌ [FACE-RECOGNITION API] ERROR RESPONSE (${durationMs}ms, HTTP ${response.status}):`);
        console.error(`  • URL:              ${endpoint}`);
        console.error(`  • HTTP Status:      ${response.status}`);
        console.error("  • Error Body:      ", JSON.stringify(errorData, null, 2));
        console.error("=======================================================\n");

        const errMsg = errorData?.detail || errorData?.error || errorData?.message || "Face burst verification failed.";
        logger.warn({ status: response.status, durationMs, errorData }, "Face Recognition mark-burst API returned non-200");
        throw new AppError(
          typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
          response.status === 422 ? 400 : response.status,
          "ERR_FACE_VERIFICATION_FAILED"
        );
      }

      const data = await response.json();

      
      logger.info({ data, durationMs, status: response.status }, "Face Recognition API burst response received");

      const isMatch = Boolean(data.is_match ?? data.matched);
      const isLive = Boolean(data.liveness?.is_live ?? data.liveness_passed ?? true);
      const confidence = Number(data.match_confidence ?? data.similarity ?? 0);

      return {
        matched: isMatch,
        similarity: confidence,
        livenessPassed: isLive,
        status: data.status || (isMatch && isLive ? "marked" : !isLive ? "spoof_suspected" : "rejected"),
        message: data.message || "",
        distance: data.distance,
        liveness: data.liveness,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      const durationMs = Date.now() - startTime;
      console.error("\n=======================================================");
      console.error(`❌ [FACE-RECOGNITION API] EXCEPTION CONNECTING TO AI SERVICE (${durationMs}ms):`);
      console.error(`  • URL:              ${endpoint}`);
      console.error(`  • Message:          ${err.message}`);
      console.error("=======================================================\n");
      logger.error({ err: err.message, durationMs }, "Error connecting to Face Recognition API");
      throw new AppError(
        `Face recognition service unavailable: ${err.message}`,
        503,
        "ERR_AI_SERVICE_UNAVAILABLE"
      );
    }
  }

  /**
   * Backward-compatible verifyFace wrapper:
   * If single capture is provided without challenge, attempts to fetch a challenge
   * or replicates single frame burst if accepted.
   */
  async verifyFace(params: {
    baselineBuffer: Buffer;
    baselineFilename: string;
    captureBuffer: Buffer;
    captureFilename: string;
    challengeToken?: string;
  }): Promise<FaceMatchResult> {
    console.log(`\n📷 [FACE-RECOGNITION] verifyFace called with single capture frame (${params.captureBuffer.length} bytes)`);
    let token = params.challengeToken;
    if (!token) {
      try {
                const challenge = await this.getChallenge();
        token = challenge.challenge_token;
      } catch (err: any) {
        logger.warn({ err: err.message }, "Unable to auto-acquire challenge for single face verification");
      }
    }

    if (token) {
      // Create 4-frame replicate burst for compatibility
      const captureBuffers = [
        params.captureBuffer,
        params.captureBuffer,
        params.captureBuffer,
        params.captureBuffer,
      ];
      return this.verifyFaceBurst({
        baselineBuffer: params.baselineBuffer,
        baselineFilename: params.baselineFilename,
        captureBuffers,
        challengeToken: token,
      });
    }

    throw new AppError(
      "Face recognition active challenge token required.",
      400,
      "ERR_CHALLENGE_REQUIRED"
    );
  }
}

export const faceRecognitionService = new FaceRecognitionService();
