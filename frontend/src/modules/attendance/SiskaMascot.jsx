import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import siskaRivUrl from '@/assets/siska.riv?url';

export default function SiskaMascot({
  faceDetected: propFaceDetected,
  isCapturing,
  attendanceResult: propAttendanceResult,
  status,
  isCameraEnabled = true
}) {
  const faceDetected = useMemo(
    () => propFaceDetected ?? isCapturing ?? false,
    [propFaceDetected, isCapturing]
  );
  const attendanceResult = useMemo(
    () => propAttendanceResult ?? status ?? 'idle',
    [propAttendanceResult, status]
  );

  const riveLayout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    []
  );

  const { rive, RiveComponent } = useRive({
    src: siskaRivUrl,
    artboard: 'SISKA',
    autoplay: true,
    layout: riveLayout,
  });

  const currentPlayingRef = useRef('idle normal');

  useEffect(() => {
    if (rive) {
      try {
        console.log('[SISKA AVAILABLE ANIMATIONS]', rive.animationNames);
        currentPlayingRef.current = 'idle normal';
        rive.animationNames.forEach(anim => {
          if (anim !== 'idle normal') {
            try { rive.stop(anim); } catch { /* abaikan error stop animasi awal */ }
          }
        });
        rive.play('idle normal');
      } catch (e) {
        console.error(e);
      }
    }
  }, [rive]);

  const isTransitioningRef   = useRef(false);
  const hasFiredMotionRef    = useRef(false);
  const timeoutRefs          = useRef([]);
  const idleTimerIntervalRef = useRef(null);
  const idleCounterRef       = useRef(0);
  const isMountedRef         = useRef(true);

  const prevFaceDetectedRef  = useRef(false);
  const prevResultRef        = useRef('idle');
  const currentFaceDetectedRef = useRef(faceDetected);

  const clearAllTimeouts = useRef(() => {
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current = [];
  });

  const addTimeout = useRef((callback, delay) => {
    const id = setTimeout(() => {
      if (isMountedRef.current) callback();
    }, delay);
    timeoutRefs.current.push(id);
    return id;
  });

  // Cleanup wajib
  useEffect(() => {
    isMountedRef.current = true;
    const clearFn = clearAllTimeouts.current;
    return () => {
      isMountedRef.current = false;
      if (idleTimerIntervalRef.current) {
        clearInterval(idleTimerIntervalRef.current);
      }
      clearFn();
    };
  }, []);

  const playAnimationSmooth = useCallback((name) => {
    if (!rive) return;
    if (currentPlayingRef.current === name) return; // Lewati jika sama

    try {
      console.log(`[SISKA RIVE] Play smooth blend: ${currentPlayingRef.current} -> ${name}`);
      const prevName = currentPlayingRef.current;
      currentPlayingRef.current = name;

      // Putar animasi baru terlebih dahulu
      rive.play(name);

      // Stop animasi lama setelah overlap sangat singkat (120ms) agar transisi natural & tidak merusak kacamata
      const tid = setTimeout(() => {
        if (isMountedRef.current && rive) {
          try {
            rive.stop(prevName);
          } catch { /* abaikan error stop animasi */ }
        }
      }, 120);
      timeoutRefs.current.push(tid);
    } catch (e) {
      console.error(`[SISKA RIVE] Failed to play smooth animation ${name}:`, e);
    }
  }, [rive]);

  const setInputOrPlay = useCallback((val, animationName) => {
    if (animationName && val) {
      playAnimationSmooth(animationName);
    }
  }, [playAnimationSmooth]);

  // Force sleep immediately if camera is disabled
  useEffect(() => {
    if (!isCameraEnabled && rive && isMountedRef.current) {
      idleCounterRef.current = 15;
      playAnimationSmooth('sleep');
    }
  }, [isCameraEnabled, rive, playAnimationSmooth]);

  // Idle timer logic
  useEffect(() => {
    if (idleTimerIntervalRef.current) {
      clearInterval(idleTimerIntervalRef.current);
    }

    idleTimerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      if (!isCameraEnabled) return; // Stay asleep if camera is disabled
      if (faceDetected) return;
      if (isTransitioningRef.current) return;

      idleCounterRef.current += 1;
      if (idleCounterRef.current >= 15) {
        playAnimationSmooth('sleep');
      } else if (idleCounterRef.current >= 12) {
        playAnimationSmooth('idle sleepy');
      } else {
        playAnimationSmooth('idle normal');
      }
    }, 1000);

    return () => {
      if (idleTimerIntervalRef.current) {
        clearInterval(idleTimerIntervalRef.current);
      }
    };
  }, [faceDetected, playAnimationSmooth]);

  // Reaksi terhadap faceDetected
  useEffect(() => {
    if (!rive || !isMountedRef.current) return;

    currentFaceDetectedRef.current = faceDetected;
    const prev = prevFaceDetectedRef.current;
    prevFaceDetectedRef.current = faceDetected;

    if (!prev && faceDetected) {
      // false -> true (wajah terdeteksi)
      const wasAsleep = (currentPlayingRef.current === 'sleep' || currentPlayingRef.current === 'idle sleepy');
      idleCounterRef.current = 0;

      if (wasAsleep) {
        isTransitioningRef.current = true; // Kunci transisi agar gerakan wake up selesai utuh
        setInputOrPlay(true, 'wake up');
        hasFiredMotionRef.current = true;

        addTimeout.current(() => {
          isTransitioningRef.current = false; // Buka kunci setelah gerakan selesai (1.5 detik)
          setInputOrPlay(true, 'scanning');
        }, 1500);
      } else {
        const latestResult = prevResultRef.current;
        if (latestResult === 'scanning') {
          setInputOrPlay(true, 'scanning');
        } else {
          setInputOrPlay(true, 'idle normal');
        }
      }

    } else if (prev && !faceDetected) {
      // true -> false
      if (!isTransitioningRef.current) {
        setInputOrPlay(true, 'idle normal');
      }
      hasFiredMotionRef.current = false;
    }
  }, [faceDetected, rive, setInputOrPlay]);

  // Reaksi terhadap attendanceResult
  useEffect(() => {
    if (!rive || !isMountedRef.current) return;

    const normalizedResult = 
      (attendanceResult === 'recognized' || attendanceResult === 'success') ? 'success' :
      (attendanceResult === 'unrecognized' || attendanceResult === 'error' || attendanceResult === 'failed') ? 'failed' :
      (attendanceResult === 'scanning') ? 'scanning' :
      'idle';

    const prev = prevResultRef.current;
    prevResultRef.current = normalizedResult;

    if (normalizedResult === 'scanning') {
      if (!isTransitioningRef.current) {
        idleCounterRef.current = 0;
        setInputOrPlay(true, 'scanning');
      }
    } else if (normalizedResult === 'success' && prev !== 'success') {
      clearAllTimeouts.current();
      isTransitioningRef.current = true;
      idleCounterRef.current = 0;

      setInputOrPlay(true, 'success');

      addTimeout.current(() => {
        isTransitioningRef.current = false;
        setInputOrPlay(true, 'idle normal');
      }, 3000);

    } else if (normalizedResult === 'failed' && prev !== 'failed') {
      clearAllTimeouts.current();
      isTransitioningRef.current = true;
      idleCounterRef.current = 0;

      setInputOrPlay(true, 'not recognized');

      addTimeout.current(() => {
        isTransitioningRef.current = false;
        setInputOrPlay(true, 'idle normal');
      }, 3000);
    } else if (normalizedResult === 'idle') {
      if (!isTransitioningRef.current) {
        if (currentFaceDetectedRef.current) {
          setInputOrPlay(true, 'idle normal');
        }
      }
    }
  }, [attendanceResult, rive, setInputOrPlay]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '400px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
