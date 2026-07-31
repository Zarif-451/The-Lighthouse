document.addEventListener('DOMContentLoaded', async () => {
  const inFlow = () => new URLSearchParams(window.location.search).get('flow') === '1';
  
  if (inFlow()) {
    document.getElementById('flowBanner').hidden = false;
  }

  const videoFeed = document.getElementById('videoFeed');
  const photoCanvas = document.getElementById('photoCanvas');
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraMessage = document.getElementById('cameraMessage');
  const scanningOverlay = document.getElementById('scanningOverlay');
  
  const captureBtn = document.getElementById('captureBtn');
  const skipBtn = document.getElementById('skipBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const saveContinueBtn = document.getElementById('saveContinueBtn');
  
  const cameraControls = document.getElementById('cameraControls');
  const resultCard = document.getElementById('resultCard');
  
  const resultEmoji = document.getElementById('resultEmoji');
  const resultTitle = document.getElementById('resultTitle');
  const detailsToggle = document.getElementById('detailsToggle');
  const detailsPanel = document.getElementById('detailsPanel');
  
  let stream = null;
  let modelsLoaded = false;
  let capturedData = null;

  const EXPRESSION_MAP = {
    happy: { emoji: '😊', text: 'Mostly Happy' },
    neutral: { emoji: '😐', text: 'Mostly Neutral' },
    surprised: { emoji: '😮', text: 'Slightly Surprised' },
    sad: { emoji: '😔', text: 'Somewhat Down' },
    angry: { emoji: '😠', text: 'Intense or Focused' },
    fearful: { emoji: '😟', text: 'Concerned' },
    disgusted: { emoji: '😕', text: 'Unsettled' }
  };

  async function loadModels() {
    try {
      if (typeof faceapi === 'undefined') {
        throw new Error('face-api.js library not loaded. Check CDN connection.');
      }
      // Wait for TensorFlow.js backend (wasm) to be fully initialized
      await faceapi.tf.ready();
      const MODEL_URL = '/assets/models/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      modelsLoaded = true;
      startCamera();
    } catch (e) {
      console.error('Model load error:', e);
      cameraMessage.textContent = 'Error: ' + e.message;
      cameraMessage.style.color = '#ff6b6b';
      cameraMessage.style.display = 'block';
      skipBtn.style.display = 'block';
    }
  }

  async function startCamera() {
    cameraMessage.textContent = 'Requesting camera access...';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      videoFeed.srcObject = stream;
      videoFeed.play();
      videoFeed.addEventListener('loadeddata', () => {
        cameraMessage.style.display = 'none';
        videoFeed.style.display = 'block';
        photoCanvas.style.display = 'none';
        captureBtn.disabled = false;
        
        photoCanvas.width = videoFeed.videoWidth;
        photoCanvas.height = videoFeed.videoHeight;
      });
    } catch (err) {
      console.error('Camera access denied:', err);
      cameraMessage.textContent = 'Camera access denied or no camera found. You can skip this step.';
      cameraMessage.style.display = 'block';
      captureBtn.disabled = true;
      skipBtn.style.display = 'block';
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }

  captureBtn.addEventListener('click', async () => {
    if (!modelsLoaded) return;
    
    // 1. Freeze & Preview
    photoCanvas.width = videoFeed.videoWidth;
    photoCanvas.height = videoFeed.videoHeight;
    const ctx = photoCanvas.getContext('2d');
    ctx.drawImage(videoFeed, 0, 0, photoCanvas.width, photoCanvas.height);
    
    videoFeed.style.display = 'none';
    photoCanvas.style.display = 'block';
    
    stopCamera();
    
    captureBtn.disabled = true;
    cameraControls.style.display = 'none';
    
    // 2. Scanning Animation
    scanningOverlay.style.display = 'block';
    
    // 3. Run Inference
    try {
      const detections = await faceapi.detectSingleFace(photoCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
      
      scanningOverlay.style.display = 'none';
      
      if (!detections) {
        cameraMessage.textContent = 'No face detected. Please try again with better lighting.';
        cameraMessage.style.display = 'block';
        setTimeout(() => {
          resetToCamera();
        }, 3000);
        return;
      }
      
      cameraContainer.style.display = 'none';
      
      const expressions = detections.expressions;
      let dominant = 'neutral';
      let maxScore = 0;
      
      const detailsHTML = [];
      
      // Sort expressions by score
      const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
      
      for (const [expr, score] of sorted) {
        if (score > maxScore) {
          maxScore = score;
          dominant = expr;
        }
        detailsHTML.push(`
          <div class="detail-row">
            <span>${expr.charAt(0).toUpperCase() + expr.slice(1)}</span>
            <span>${Math.round(score * 100)}%</span>
          </div>
        `);
      }
      
      capturedData = {
        dominant,
        scores: expressions
      };
      
      // Use "Calm Expression" if confidence is low, else map
      if (maxScore < 0.4) {
        resultEmoji.textContent = '🙂';
        resultTitle.textContent = 'Calm Expression';
      } else {
        const mapped = EXPRESSION_MAP[dominant] || { emoji: '🙂', text: 'Calm Expression' };
        resultEmoji.textContent = mapped.emoji;
        resultTitle.textContent = mapped.text;
      }
      
      detailsPanel.innerHTML = detailsHTML.join('');
      resultCard.style.display = 'block';
      
    } catch (e) {
      console.error('Inference error:', e);
      scanningOverlay.style.display = 'none';
      cameraMessage.textContent = 'Analysis failed. You can skip this step.';
      cameraMessage.style.display = 'block';
      setTimeout(() => {
        resetToCamera();
      }, 3000);
    }
  });

  function resetToCamera() {
    resultCard.style.display = 'none';
    cameraContainer.style.display = 'flex';
    cameraControls.style.display = 'flex';
    cameraMessage.style.display = 'none';
    startCamera();
  }

  retakeBtn.addEventListener('click', resetToCamera);

  detailsToggle.addEventListener('click', () => {
    detailsPanel.classList.toggle('show');
    detailsToggle.textContent = detailsPanel.classList.contains('show') 
      ? 'Hide confidence details' 
      : 'Show confidence details';
  });

  saveContinueBtn.addEventListener('click', async () => {
    saveContinueBtn.disabled = true;
    saveContinueBtn.textContent = 'Saving...';
    try {
      // Convert face-api's Float32Array-backed expressions to a plain JSON object
      const plainScores = {};
      Object.entries(capturedData.scores).forEach(([k, v]) => {
        plainScores[k] = Math.round(Number(v) * 1000) / 1000;
      });

      await window.Lighthouse.saveActivityResult('face_check', {
        dominant: capturedData.dominant,
        scores: plainScores
      });
      if (inFlow()) {
        window.LighthouseJourney.showTransitionThen('face_check', window.LighthouseJourney.hrefFor('scenario_1'), { force: true });
      } else {
        window.Lighthouse.showToast('Face Check saved.');
        setTimeout(() => { window.location.href = window.LighthouseJourney.hrefFor('dashboard'); }, 1500);
      }
    } catch (e) {
      console.error('Save error:', e);
      saveContinueBtn.disabled = false;
      saveContinueBtn.textContent = 'Save & Continue';
      // Show toast if available, fall back to alert
      if (window.LighthouseShell && window.LighthouseShell.showToast) {
        window.LighthouseShell.showToast((e && e.message) || 'Failed to save result.');
      } else {
        alert((e && e.message) || 'Failed to save result.');
      }
    }
  });

  skipBtn.addEventListener('click', () => {
    stopCamera();
    if (inFlow()) {
      window.LighthouseJourney.showTransitionThen('face_check', window.LighthouseJourney.hrefFor('scenario_1'), { force: true });
    } else {
      window.location.href = window.LighthouseJourney.hrefFor('dashboard');
    }
  });

  // Init
  loadModels();
});
