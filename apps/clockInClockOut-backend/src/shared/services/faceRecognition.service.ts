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
    try {
      logger.info({ url: `${this.baseUrl}/api/v1/attendance/challenge` }, "Requesting Face Recognition challenge token");
      const response = await fetch(`${this.baseUrl}/api/v1/attendance/challenge`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errMsg = errorData?.detail || errorData?.error || "Failed to issue liveness challenge.";
        throw new AppError(errMsg, response.status, "ERR_FACE_CHALLENGE_FAILED");
      }

      return (await response.json()) as ChallengeData;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message }, "Error fetching Face Recognition challenge token");
      throw new AppError(
        `Face recognition challenge service unavailable: ${err.message}`,
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

    try {
      console.log("\n=======================================================");
      console.log("📤 [FACE-RECOGNITION] SENDING BURST REQUEST TO main.py...");
      console.log(`  • URL:              ${this.baseUrl}/api/v1/attendance/mark-burst`);
      console.log(`  • Baseline size:    ${params.baselineBuffer.length} bytes`);
      console.log(`  • Burst frames:     ${params.captureBuffers.length}`);
      console.log(`  • Challenge token:  ${params.challengeToken.substring(0, 16)}...`);
      console.log("=======================================================");

      logger.info({ url: `${this.baseUrl}/api/v1/attendance/mark-burst`, frames: params.captureBuffers.length }, "Calling Face Recognition mark-burst API");

      const response = await fetch(`${this.baseUrl}/api/v1/attendance/mark-burst`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("\n❌ [FACE-RECOGNITION] ERROR RESPONSE FROM main.py (Port 8000):");
        console.error(`  • HTTP Status:      ${response.status}`);
        console.error("  • Details:         ", JSON.stringify(errorData, null, 2));
        console.error("=======================================================\n");

        const errMsg = errorData?.detail || errorData?.error || errorData?.message || "Face burst verification failed.";
        logger.warn({ status: response.status, errorData }, "Face Recognition mark-burst API returned non-200");
        throw new AppError(
          typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
          response.status === 422 ? 400 : response.status,
          "ERR_FACE_VERIFICATION_FAILED"
        );
      }

      const data = await response.json();

      // High-visibility terminal logging
      console.log("\n=======================================================");
      console.log("📸 [FACE-RECOGNITION] BURST RESPONSE RECEIVED FROM main.py:");
      console.log(JSON.stringify(data, null, 2));
      console.log("-------------------------------------------------------");
      console.log(`  • Status:           ${data.status}`);
      console.log(`  • Is Match:         ${data.is_match}`);
      console.log(`  • Match Confidence: ${(Number(data.match_confidence || 0) * 100).toFixed(2)}%`);
      console.log(`  • Cosine Distance:  ${data.distance}`);
      console.log(`  • Liveness Passed:  ${data.liveness?.is_live}`);
      console.log(`  • Liveness Score:   ${data.liveness?.liveness_score}`);
      console.log(`  • Blink Detected:   ${data.liveness?.blink_detected}`);
      console.log(`  • Motion OK:        ${data.liveness?.motion_ok}`);
      console.log(`  • Challenge OK:     ${data.liveness?.challenge_ok}`);
      console.log(`  • Screen Detected:  ${data.liveness?.screen_detected}`);
      if (data.liveness?.reasons?.length > 0) {
        console.log(`  • Spoof Flags:      ${data.liveness.reasons.join(", ")}`);
      }
      console.log(`  • Message:          ${data.message}`);
      console.log("=======================================================\n");

      logger.info({ data }, "Face Recognition API burst response received");

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
      console.error("\n❌ [FACE-RECOGNITION] EXCEPTION CONNECTING TO main.py:", err.message);
      logger.error({ err: err.message }, "Error connecting to Face Recognition API");
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
