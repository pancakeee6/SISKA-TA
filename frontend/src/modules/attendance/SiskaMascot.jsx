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
  const prevCameraEnabledRef = useRef(isCameraEnabled);
  const currentFaceDetectedRef = useRef(faceDetected);

  const activeBlendRef = useRef(null); // { id, prevName }

  const stopActiveBlend = useCallback(() => {
    if (activeBlendRef.current) {
      clearTimeout(activeBlendRef.current.id);
      if (rive && activeBlendRef.current.prevName) {
        try {
          rive.stop(activeBlendRef.current.prevName);
        } catch { /* abaikan error */ }
      }
      activeBlendRef.current = null;
    }
  }, [rive]);

  const clearAllTimeouts = useRef(() => {
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current = [];
    if (activeBlendRef.current) {
      clearTimeout(activeBlendRef.current.id);
      if (rive && activeBlendRef.current.prevName) {
        try { rive.stop(activeBlendRef.current.prevName); } catch { /* abaikan */ }
      }
      activeBlendRef.current = null;
    }
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

    // Pastikan Rive canvas melanjutkan render loop jika sebelumnya di-pause saat tidur
    try {
      if (rive.isPlaying === false || rive.isPaused) {
        rive.play();
      }
    } catch { /* abaikan error */ }

    if (currentPlayingRef.current === name) return; // Lewati jika sama

    try {
      console.log(`[SISKA RIVE] Play smooth blend (600ms): ${currentPlayingRef.current} -> ${name}`);
      const prevName = currentPlayingRef.current;
      currentPlayingRef.current = name;

      // Hentikan blend sebelumnya jika masih ada agar tidak bertumpuk
      stopActiveBlend();

      // Putar animasi baru
      rive.play(name);

      // Beri overlap 600ms agar pergerakan tulang/wajah berpindah secara halus dan organik (crossfade)
      if (prevName && prevName !== name) {
        const id = setTimeout(() => {
          if (isMountedRef.current && rive) {
            try {
              rive.stop(prevName);
            } catch { /* abaikan error */ }
          }
          activeBlendRef.current = null;
        }, 600);

        activeBlendRef.current = { id, prevName };
      }
    } catch (e) {
      console.error(`[SISKA RIVE] Failed to play animation ${name}:`, e);
    }
  }, [rive, stopActiveBlend]);

  const goToSleepSequence = useCallback(() => {
    if (!rive || !isMountedRef.current) return;
    clearAllTimeouts.current();
    isTransitioningRef.current = true; // Kunci transisi menuju tidur agar smooth & tidak terganggu
    idleCounterRef.current = 15;
    playAnimationSmooth('idle sleepy');

    addTimeout.current(() => {
      if (isMountedRef.current) {
        isTransitioningRef.current = false;
        playAnimationSmooth('sleep');

        // Optimasi STB ARM / Spesifikasi Rendah:
        // Setelah masuk pose tidur stabil (1.5 detik), pause Rive canvas untuk menghentikan
        // loop render 60 FPS dan menurunkan beban CPU/GPU compositing secara drastis.
        addTimeout.current(() => {
          if (isMountedRef.current && rive && currentPlayingRef.current === 'sleep') {
            try {
              console.log('[SISKA RIVE OPTIMIZATION] Pausing 60fps canvas loop during sleep');
              rive.pause();
            } catch (e) {
              console.error(e);
            }
          }
        }, 1500);
      }
    }, 2500);
  }, [rive, playAnimationSmooth]);

  const setInputOrPlay = useCallback((val, animationName) => {
    if (animationName && val) {
      playAnimationSmooth(animationName);
    }
  }, [playAnimationSmooth]);

  // Reaksi terhadap status kamera (aktif / nonaktif)
  useEffect(() => {
    if (!rive || !isMountedRef.current) return;

    const prev = prevCameraEnabledRef.current;
    prevCameraEnabledRef.current = isCameraEnabled;

    if (!isCameraEnabled) {
      // Kamera dimatikan -> Jika sedang transisi gerakan penting, biarkan selesai dulu baru masuk tidur
      if (!isTransitioningRef.current) {
        goToSleepSequence();
      }
    } else if (prev === false && isCameraEnabled) {
      // Kamera dihidupkan kembali -> Selalu mainkan animasi wake up terlebih dahulu
      clearAllTimeouts.current();
      isTransitioningRef.current = true;
      idleCounterRef.current = 0;
      playAnimationSmooth('wake up');

      addTimeout.current(() => {
        isTransitioningRef.current = false;
        if (!prevCameraEnabledRef.current) {
          goToSleepSequence();
          return;
        }
        if (currentFaceDetectedRef.current || prevResultRef.current === 'scanning') {
          playAnimationSmooth('scanning');
        } else {
          playAnimationSmooth('idle normal');
        }
      }, 2000);
    }
  }, [isCameraEnabled, rive, playAnimationSmooth, goToSleepSequence]);

  // Idle timer logic
  useEffect(() => {
    if (idleTimerIntervalRef.current) {
      clearInterval(idleTimerIntervalRef.current);
    }

    if (!isCameraEnabled) return; // Optimasi: jangan jalankan timer interval saat kamera mati

    idleTimerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      if (faceDetected) return;
      if (isTransitioningRef.current) return;

      idleCounterRef.current += 1;
      if (idleCounterRef.current >= 15) {
        if (currentPlayingRef.current !== 'sleep') {
          playAnimationSmooth('sleep');
          addTimeout.current(() => {
            if (isMountedRef.current && rive && currentPlayingRef.current === 'sleep') {
              try {
                console.log('[SISKA RIVE OPTIMIZATION] Pausing 60fps canvas loop during idle timer sleep');
                rive.pause();
              } catch (e) {
                console.error(e);
              }
            }
          }, 1500);
        }
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
  }, [faceDetected, playAnimationSmooth, isCameraEnabled, rive]);

  // Reaksi terhadap faceDetected
  useEffect(() => {
    if (!rive || !isMountedRef.current || !isCameraEnabled) return;

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
          isTransitioningRef.current = false; // Buka kunci setelah gerakan wake up selesai penuh (2 detik)
          if (!prevCameraEnabledRef.current) {
            goToSleepSequence();
            return;
          }
          const latestResult = prevResultRef.current;
          if (latestResult === 'success') {
            isTransitioningRef.current = true;
            setInputOrPlay(true, 'success');
            addTimeout.current(() => {
              isTransitioningRef.current = false;
              if (!prevCameraEnabledRef.current) {
                goToSleepSequence();
              } else {
                setInputOrPlay(true, 'idle normal');
              }
            }, 3000);
          } else if (latestResult === 'failed') {
            isTransitioningRef.current = true;
            setInputOrPlay(true, 'not recognized');
            addTimeout.current(() => {
              isTransitioningRef.current = false;
              if (!prevCameraEnabledRef.current) {
                goToSleepSequence();
              } else {
                setInputOrPlay(true, 'idle normal');
              }
            }, 3000);
          } else if (latestResult === 'scanning') {
            setInputOrPlay(true, 'scanning');
          } else {
            setInputOrPlay(true, 'idle normal');
          }
        }, 2000);
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
  }, [faceDetected, rive, setInputOrPlay, goToSleepSequence, isCameraEnabled]);

  // Reaksi terhadap attendanceResult
  useEffect(() => {
    if (!rive || !isMountedRef.current || !isCameraEnabled) return;

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
      if (currentPlayingRef.current === 'wake up' && isTransitioningRef.current) {
        // Biarkan wake up selesai, penanganan dilanjutkan oleh addTimeout di useEffect faceDetected
        return;
      }
      clearAllTimeouts.current();
      isTransitioningRef.current = true;
      idleCounterRef.current = 0;

      setInputOrPlay(true, 'success');

      addTimeout.current(() => {
        isTransitioningRef.current = false;
        if (!prevCameraEnabledRef.current) {
          goToSleepSequence();
        } else {
          setInputOrPlay(true, 'idle normal');
        }
      }, 3000);

    } else if (normalizedResult === 'failed' && prev !== 'failed') {
      if (currentPlayingRef.current === 'wake up' && isTransitioningRef.current) {
        return;
      }
      clearAllTimeouts.current();
      isTransitioningRef.current = true;
      idleCounterRef.current = 0;

      setInputOrPlay(true, 'not recognized');

      addTimeout.current(() => {
        isTransitioningRef.current = false;
        if (!prevCameraEnabledRef.current) {
          goToSleepSequence();
        } else {
          setInputOrPlay(true, 'idle normal');
        }
      }, 3000);
    } else if (normalizedResult === 'idle') {
      if (!isTransitioningRef.current) {
        if (currentFaceDetectedRef.current) {
          setInputOrPlay(true, 'idle normal');
        }
      }
    }
  }, [attendanceResult, rive, setInputOrPlay, goToSleepSequence, isCameraEnabled]);

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
