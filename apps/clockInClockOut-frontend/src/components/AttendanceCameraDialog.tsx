import React, { useState, useRef, useCallback, useEffect } from 'react';
import WebcamComponent from 'react-webcam';
const Webcam = WebcamComponent as any;
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  Refresh as RetakeIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Face as FaceIcon,
  CameraEnhance as CameraEnhanceIcon,
} from '@mui/icons-material';
import { attendanceService } from '../services/attendanceService';

interface AttendanceCameraDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  onSuccess: () => void;
}

export const AttendanceCameraDialog: React.FC<AttendanceCameraDialogProps> = ({
  open,
  onClose,
  employeeId,
  employeeName,
  latitude,
  longitude,
  accuracy,
  onSuccess,
}) => {
  const webcamRef = useRef<WebcamComponent>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Verification states
  const [selectedAngle, setSelectedAngle] = useState<string>('0');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<boolean>(false);

  // Burst and eye tracking states
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [faceMeshLoaded, setFaceMeshLoaded] = useState<boolean>(false);
  const [blinkStatus, setBlinkStatus] = useState<string>('Initializing eye tracker...');
  const [blinkStatusClass, setBlinkStatusClass] = useState<'pending' | 'ok' | 'fail'>('pending');
  const [burstHadBlink, setBurstHadBlink] = useState<boolean>(false);
  const [calibrated, setCalibrated] = useState<boolean>(false);

  // References for live tracking to prevent React state stale enclosure in callbacks
  const faceMeshRef = useRef<any>(null);
  const livePollActiveRef = useRef<boolean>(false);
  const sendBusyRef = useRef<boolean>(false);
  const earHistoryRef = useRef<number[]>([]);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationStartTsRef = useRef<number>(0);
  const lastFaceSeenTsRef = useRef<number>(0);
  const earOpenThreshRef = useRef<number>(0.24);
  const earClosedThreshRef = useRef<number>(0.19);
  const liveEarOpenSeenRef = useRef<boolean>(false);
  const liveEarClosedSeenRef = useRef<boolean>(false);
  const burstHadBlinkRef = useRef<boolean>(false);
  const isAutoCapturingRef = useRef<boolean>(false);
  const calibratedRef = useRef<boolean>(false);

  const LEFT_EYE = [33, 160, 158, 133, 153, 144];
  const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
  const CALIBRATION_MS = 800;
  const SMOOTHING_WINDOW = 3;
  const NO_FACE_TIMEOUT_MS = 1500;

  // Video constraints for preferring the front camera
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  // Helper to convert base64 dataURI to a File object
  const dataURItoFile = (dataURI: string, filename: string): File => {
    const parts = dataURI.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];
    
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([ab], { type: mimeString });
    return new File([blob], filename, { type: mimeString });
  };

  const ear = (landmarks: any[], idxs: number[]) => {
    const p = idxs.map(i => landmarks[i]);
    const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
    const v1 = dist(p[1], p[5]);
    const v2 = dist(p[2], p[4]);
    const h = dist(p[0], p[3]);
    return h === 0 ? 0.3 : (v1 + v2) / (2 * h);
  };

  const triggerAutoCapture = async () => {
    if (isAutoCapturingRef.current) return;
    isAutoCapturingRef.current = true;
    
    stopLivePolling();
    setBlinkStatus('Blink detected ✓ — Capturing burst...');
    setBlinkStatusClass('ok');
    
    const frames: File[] = [];
    const numFrames = 4;
    const intervalMs = 120;

    for (let i = 0; i < numFrames; i++) {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const file = dataURItoFile(imageSrc, `frame_${i}.jpg`);
          frames.push(file);
        }
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    if (frames.length > 0) {
      setCapturedFiles(frames);
      const previewUrl = URL.createObjectURL(frames[frames.length - 1]);
      setCapturedImage(previewUrl);
      setBlinkStatus(`Captured ${frames.length} frames ✓`);
      setBlinkStatusClass('ok');
    } else {
      setVerificationError('Failed to capture burst frames.');
    }
    isAutoCapturingRef.current = false;
  };

  const onFaceMeshResults = useCallback((results: any) => {
    const now = performance.now();

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (!calibratedRef.current || (now - lastFaceSeenTsRef.current) > NO_FACE_TIMEOUT_MS) {
        setBlinkStatus('No face detected — center your face in the circle');
        setBlinkStatusClass('fail');
      }
      return;
    }
    lastFaceSeenTsRef.current = now;

    const lm = results.multiFaceLandmarks[0];
    const rawEar = (ear(lm, LEFT_EYE) + ear(lm, RIGHT_EYE)) / 2;
    
    const history = earHistoryRef.current;
    history.push(rawEar);
    if (history.length > SMOOTHING_WINDOW) history.shift();
    const avgEar = history.reduce((a, b) => a + b, 0) / history.length;

    if (!calibratedRef.current) {
      calibrationSamplesRef.current.push(avgEar);
      const elapsed = now - calibrationStartTsRef.current;
      const secondsLeft = Math.max(0, Math.ceil((CALIBRATION_MS - elapsed) / 100) / 10);
      setBlinkStatus(`Calibrating... keep your eyes open (${secondsLeft}s)`);
      setBlinkStatusClass('pending');

      if (elapsed >= CALIBRATION_MS && calibrationSamplesRef.current.length >= 5) {
        const baseline = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
        earOpenThreshRef.current = baseline * 0.88;
        earClosedThreshRef.current = baseline * 0.76;
        calibratedRef.current = true;
        setCalibrated(true);
        setBlinkStatus('Ready — please blink naturally');
        setBlinkStatusClass('pending');
      }
      return;
    }

    if (avgEar >= earOpenThreshRef.current) {
      if (liveEarClosedSeenRef.current && !burstHadBlinkRef.current) {
        burstHadBlinkRef.current = true;
        setBurstHadBlink(true);
        setBlinkStatus('Blink detected ✓ — Capturing burst...');
        setBlinkStatusClass('ok');
        triggerAutoCapture();
      }
      liveEarOpenSeenRef.current = true;
    } else if (avgEar <= earClosedThreshRef.current && liveEarOpenSeenRef.current) {
      liveEarClosedSeenRef.current = true;
    }

    if (!burstHadBlinkRef.current) {
      setBlinkStatus(`Waiting for a blink... (EAR: ${avgEar.toFixed(3)}, closed < ${earClosedThreshRef.current.toFixed(3)}, open > ${earOpenThreshRef.current.toFixed(3)})`);
    }
  }, []);

  const initFaceMesh = async () => {
    if (faceMeshRef.current) return;
    try {
      const FaceMeshGlobal = (window as any).FaceMesh;
      if (!FaceMeshGlobal) return;

      const fm = new FaceMeshGlobal({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults(onFaceMeshResults);

      const warm = document.createElement('canvas');
      warm.width = 64;
      warm.height = 64;
      await fm.send({ image: warm });

      faceMeshRef.current = fm;
      setFaceMeshLoaded(true);
    } catch (e) {
      console.error('FaceMesh init failed:', e);
    }
  };

  const livePollLoop = () => {
    if (!livePollActiveRef.current) return;

    const videoEl = webcamRef.current?.video;
    if (videoEl && !sendBusyRef.current && videoEl.readyState >= 2) {
      sendBusyRef.current = true;
      faceMeshRef.current.send({ image: videoEl })
        .then(() => {
          sendBusyRef.current = false;
        })
        .catch((e: any) => {
          console.warn('faceMesh.send error (skipping frame):', e);
          sendBusyRef.current = false;
        });
    }
    requestAnimationFrame(livePollLoop);
  };

  const startLivePolling = () => {
    stopLivePolling();
    livePollActiveRef.current = true;
    requestAnimationFrame(livePollLoop);
  };

  const stopLivePolling = () => {
    livePollActiveRef.current = false;
  };

  const resetBlinkState = () => {
    liveEarOpenSeenRef.current = false;
    liveEarClosedSeenRef.current = false;
    burstHadBlinkRef.current = false;
    setBurstHadBlink(false);
    earHistoryRef.current = [];
    calibrationSamplesRef.current = [];
    calibrationStartTsRef.current = performance.now();
    calibratedRef.current = false;
    setCalibrated(false);
    setBlinkStatus('Calibrating...');
    setBlinkStatusClass('pending');
  };

  useEffect(() => {
    if (open && !capturedImage && !cameraError) {
      const run = async () => {
        if (!(window as any).FaceMesh) {
          setBlinkStatus('Loading face mesh library...');
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js";
          script.crossOrigin = "anonymous";
          script.async = true;
          script.onload = async () => {
            console.log('MediaPipe FaceMesh script loaded.');
            await initFaceMesh();
            resetBlinkState();
            startLivePolling();
          };
          script.onerror = () => {
            setBlinkStatus('Failed to load eye tracking library.');
            setBlinkStatusClass('fail');
          };
          document.head.appendChild(script);
        } else {
          await initFaceMesh();
          resetBlinkState();
          startLivePolling();
        }
      };
      run();
    }
    return () => {
      stopLivePolling();
    };
  }, [open, capturedImage, cameraError]);

  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        stopLivePolling();
        setCapturedImage(imageSrc);
        setVerificationError(null);
      } else {
        setCameraError('Failed to capture image. Please try again.');
      }
    }
  }, [webcamRef]);

  const handleRetake = () => {
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedFiles([]);
    setCameraError(null);
    setVerificationError(null);
    setVerificationSuccess(false);
    resetBlinkState();
    startLivePolling();
  };

  const handleUseSimulated = () => {
    // Generate beautiful high-fidelity simulated face verification capture
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#1e293b"/>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="640" height="480" fill="url(#grid)"/>
        
        <path d="M 40 80 L 40 40 L 80 40" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
        <path d="M 560 80 L 560 40 L 520 40" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
        <path d="M 40 400 L 40 440 L 80 440" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
        <path d="M 560 400 L 560 440 L 520 440" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
        
        <g transform="rotate(${selectedAngle}, 320, 240)">
          <circle cx="320" cy="240" r="100" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="10, 5"/>
          <line x1="320" y1="110" x2="320" y2="370" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5, 5" />
          <line x1="190" y1="240" x2="450" y2="240" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5, 5" />
          
          <circle cx="320" cy="200" r="45" fill="#475569" stroke="#f59e0b" stroke-width="3"/>
          <path d="M 260 330 C 260 280, 380 280, 380 330 Z" fill="#475569" stroke="#f59e0b" stroke-width="3"/>
        </g>
        
        <rect x="170" y="390" width="300" height="40" rx="20" fill="#f59e0b" />
        <text x="320" y="415" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">
          POSE ALIGNED TO ${selectedAngle}° ANGLE
        </text>
      </svg>
    `;
    const base64Svg = btoa(unescape(encodeURIComponent(svgString.trim())));
    const dataUri = `data:image/svg+xml;base64,${base64Svg}`;
    setCapturedImage(dataUri);
    setCapturedFiles([]);
    setCameraError(null);
    setVerificationError(null);
  };

  const handleSubmit = async () => {
    if (capturedFiles.length === 0 && !capturedImage) return;

    if (latitude === null || longitude === null) {
      setVerificationError('GPS location coordinates are required for attendance check-in. Please ensure location services are enabled.');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const formData = new FormData();
      formData.append('employeeId', employeeId);
      formData.append('employeeName', employeeName);
      formData.append('angle', selectedAngle);
      formData.append('latitude', String(latitude));
      formData.append('longitude', String(longitude));
      if (accuracy !== null) formData.append('accuracy', String(accuracy));

      // Choose primary punch photo
      const punchFile = capturedFiles.length > 0
        ? capturedFiles[capturedFiles.length - 1]
        : (capturedImage ? dataURItoFile(capturedImage, 'selfie.jpg') : null);

      if (punchFile) {
        formData.append('selfie', punchFile);
      }

      // Also append burst frames under 'selfies' if present
      if (capturedFiles.length > 0) {
        capturedFiles.forEach(file => {
          formData.append('selfies', file);
        });
      }

      // Call background face recognition API
      await attendanceService.checkIn(formData);

      setVerificationSuccess(true);
      onSuccess();
      
      // Auto close dialog after success message displays
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('Biometric verification error:', err);
      const errMessage =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Biometric Face Match Mismatch. Please align properly.';
      setVerificationError(errMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedFiles([]);
    setCameraError(null);
    setVerificationError(null);
    setVerificationSuccess(false);
    setIsVerifying(false);
    stopLivePolling();
    onClose();
  };

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera access error:', error);
    const errStr = typeof error === 'string' ? error : error.message || error.toString() || '';
    if (
      errStr.includes('device not found') || 
      errStr.includes('NotFoundError') || 
      errStr.includes('devices not found') || 
      errStr.includes('Requested device not found')
    ) {
      setCameraError(
        'No physical camera/webcam was detected on your system. Please click the "Simulate" button below to generate a high-fidelity biometric pose verification capture and complete your check-in.'
      );
    } else {
      setCameraError(
        'Could not access the camera. Please check your browser permissions and ensure no other application is using it, or click "Simulate" below.'
      );
    }
  }, []);

  const handleAngleChange = (
    event: React.MouseEvent<HTMLElement>,
    newAngle: string | null
  ) => {
    if (newAngle !== null) {
      setSelectedAngle(newAngle);
      // Retake or adjust visual overlay
      if (capturedImage) {
        handleRetake();
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isVerifying ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {verificationSuccess ? 'Check-in Complete' : isVerifying ? 'Face Matching Pipeline' : capturedImage ? 'Verify Biometrics' : 'Capture Attendance Selfie'}
        </Typography>
        {!isVerifying && (
          <IconButton aria-label="close" onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 2, pb: 1 }}>
        {/* Angle Selecter Guide */}
        {!verificationSuccess && !isVerifying && (
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              STEP 1: SELECT HEAD-TILT ALIGNMENT ANGLE
            </Typography>
            <ToggleButtonGroup
              value={selectedAngle}
              exclusive
              onChange={handleAngleChange}
              size="small"
              fullWidth
              color="primary"
            >
              <ToggleButton value="0" sx={{ fontWeight: 600, borderRadius: 2 }}>
                Front (0°)
              </ToggleButton>
              <ToggleButton value="-15" sx={{ fontWeight: 600 }}>
                Left Tilt (-15°)
              </ToggleButton>
              <ToggleButton value="15" sx={{ fontWeight: 600, borderRadius: 2 }}>
                Right Tilt (+15°)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Display Error Alerts */}
        {cameraError && !capturedImage && (
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {cameraError}
            </Alert>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleUseSimulated}
              fullWidth
              size="small"
              sx={{ borderRadius: 2, mt: 0.5 }}
            >
              Generate Simulated Pose Selfie
            </Button>
          </Box>
        )}

        {verificationError && (
          <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
            {verificationError}
          </Alert>
        )}

        {/* Dynamic Blink/Calibration Alert */}
        {!verificationSuccess && !isVerifying && !capturedImage && !cameraError && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity={blinkStatusClass === 'ok' ? 'success' : blinkStatusClass === 'fail' ? 'error' : 'info'}
              sx={{ borderRadius: 2 }}
            >
              {blinkStatus}
            </Alert>
          </Box>
        )}

        {/* Camera Container and Overlay Grid */}
        <Box
          sx={{
            width: '100%',
            aspectRatio: '4/3',
            bgcolor: 'black',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: verificationSuccess ? '4px solid #10b981' : isVerifying ? '4px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)',
          }}
        >
          {verificationSuccess ? (
            <Box sx={{ textAlign: 'center', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <SuccessIcon color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>
                Face Match Verified!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selfie deleted. Attendance logged in Atlas DB.
              </Typography>
            </Box>
          ) : isVerifying ? (
            <Box sx={{ textAlign: 'center', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={56} thickness={4} />
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Processing Background Face Match...
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '80%' }}>
                Comparing temporary capture with your secure registered avatar inside Atlas.
              </Typography>
            </Box>
          ) : capturedImage ? (
            // Captured preview
            <Box
              component="img"
              src={capturedImage}
              alt="Selfie Preview"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror
              }}
            />
          ) : (
            // Webcam stream
            <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={handleUserMediaError}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirror
                }}
              />

              {/* Dynamic Overlay HUD Grid */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {/* HUD Overlay graphics */}
                <svg width="100%" height="100%" viewBox="0 0 400 300" style={{ position: 'absolute' }}>
                  {/* Outer crop corners */}
                  <path d="M 20 40 L 20 20 L 40 20" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M 380 40 L 380 20 L 360 20" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M 20 260 L 20 280 L 40 280" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M 380 260 L 380 280 L 360 280" fill="none" stroke="#3b82f6" strokeWidth="2" />

                  {/* Rotatable alignment guides */}
                  <g transform={`rotate(${selectedAngle}, 200, 150)`}>
                    {/* Ellipse target */}
                    <ellipse
                      cx="200"
                      cy="140"
                      rx="60"
                      ry="85"
                      fill="none"
                      stroke={burstHadBlink ? '#10b981' : '#f59e0b'}
                      strokeWidth="2"
                      strokeDasharray={burstHadBlink ? 'none' : '5,3'}
                    />
                    
                    {/* Center crosshair */}
                    <line
                      x1="200"
                      y1="35"
                      x2="200"
                      y2="245"
                      stroke={burstHadBlink ? '#10b981' : '#f59e0b'}
                      strokeWidth="1"
                      strokeDasharray="5,5"
                      opacity="0.7"
                    />
                    <line
                      x1="120"
                      y1="140"
                      x2="280"
                      y2="140"
                      stroke={burstHadBlink ? '#10b981' : '#f59e0b'}
                      strokeWidth="1"
                      strokeDasharray="5,5"
                      opacity="0.7"
                    />
                  </g>
                </svg>

                {/* Guidelines textual helper */}
                <Box sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.7)', px: 2, py: 0.5, borderRadius: 5 }}>
                  <Typography variant="caption" sx={{ color: selectedAngle !== '0' ? '#f59e0b' : '#10b981', fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FaceIcon fontSize="inherit" />
                    {selectedAngle === '0' && 'Frontal: Keep head straight'}
                    {selectedAngle === '-15' && 'Left Tilt: Tilt head left by 15°'}
                    {selectedAngle === '15' && 'Right Tilt: Tilt head right by 15°'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
        
        {!verificationSuccess && !isVerifying && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'center', fontWeight: 500 }}>
            {capturedImage
              ? 'Verify pose alignment, then submit for background Face Matching'
              : 'Position your face within the dynamic HUD grid lines'}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
        {!verificationSuccess && !isVerifying && (
          capturedImage ? (
            <>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RetakeIcon />}
                onClick={handleRetake}
                fullWidth
                sx={{ borderRadius: 2, py: 1 }}
              >
                Retake
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                fullWidth
                sx={{ borderRadius: 2, py: 1, fontWeight: 700 }}
              >
                Verify & Submit
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleClose}
                color="inherit"
                variant="outlined"
                fullWidth
                sx={{ borderRadius: 2, py: 1 }}
              >
                Cancel
              </Button>
              {cameraError ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUseSimulated}
                  fullWidth
                  sx={{ borderRadius: 2, py: 1, fontWeight: 700 }}
                >
                  Simulate
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleUseSimulated}
                    sx={{ borderRadius: 2, py: 1, flex: 1 }}
                  >
                    Simulate
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCapture}
                    sx={{ borderRadius: 2, py: 1, fontWeight: 700, flex: 2 }}
                  >
                    Capture Manually
                  </Button>
                </Box>
              )}
            </>
          )
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AttendanceCameraDialog;
