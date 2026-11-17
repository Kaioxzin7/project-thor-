let THREE = null;
const HDRI_TEXTURE = 'assets/thor-bg.webp';

function parseCameraOrbit(orbitString, radiusDefault = 8) {
  const match = orbitString.match(/([\-\d.]+)deg\s+([\-\d.]+)deg\s+([\-\d.]+)m/);
  if (!match) {
    return { x: 0, y: 0, z: radiusDefault };
  }
  const azimuth = THREE.MathUtils.degToRad(parseFloat(match[1]));
  const elevation = THREE.MathUtils.degToRad(parseFloat(match[2]));
  const radius = parseFloat(match[3]);
  const phi = THREE.MathUtils.degToRad(90 - parseFloat(match[2]));
  const theta = azimuth;
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta)
  };
}

function initThreeViewer(container, environmentTexture, gltfLoader) {
  const scene = new THREE.Scene();
  scene.environment = environmentTexture;
  scene.background = null;

  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const containerBounds = container.getBoundingClientRect();
  const camera = new THREE.PerspectiveCamera(35, containerBounds.width / containerBounds.height, 0.1, 100);
  const orbit = parseCameraOrbit(container.dataset.orbit || '0deg 75deg 8m');
  camera.position.set(orbit.x, orbit.y, orbit.z);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(containerBounds.width, containerBounds.height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  const modelSrc = container.dataset.modelSrc || 'assets/martelo.glb';
  gltfLoader.load(modelSrc,
    (gltf) => {
      const model = gltf.scene;
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.rotation.set(-0.17, 0.35, 0);
      model.scale.setScalar(1.05);
      sceneGroup.add(model);
    },
    undefined,
    (error) => {
      console.error('Erro ao carregar o modelo 3D:', error);
    }
  );

  const resizeScene = () => {
    const rect = container.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  };

  window.addEventListener('resize', resizeScene);

  const clock = new THREE.Clock();
  const animate = () => {
    const delta = clock.getDelta();
    sceneGroup.rotation.y += delta * 0.3;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
}

async function initThreeMjolnirScenes() {
  const containers = Array.from(document.querySelectorAll('.mjolnir-viewer'));
  if (!containers.length) {
    return;
  }

  try {
    const [threeModule, gltfModule, dracoModule] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.179.0/build/three.module.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/GLTFLoader.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.179.0/examples/jsm/loaders/DRACOLoader.js')
    ]);

    THREE = threeModule;
    const GLTFLoader = gltfModule.GLTFLoader;
    const DRACOLoader = dracoModule.DRACOLoader;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(HDRI_TEXTURE,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.encoding = THREE.sRGBEncoding;
        containers.forEach(container => initThreeViewer(container, texture, gltfLoader));
      },
      undefined,
      (error) => {
        console.warn('Erro ao carregar a textura HDRI:', error);
        containers.forEach(container => initThreeViewer(container, null, gltfLoader));
      }
    );
  } catch (error) {
    console.warn('Falha ao carregar Three.js ou loaders dinamicamente:', error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  /**
   * Helper function to load and play background videos asynchronously.
   * This prevents heavy video assets from blocking the initial page render.
   */
  const initAsyncBackgroundVideo = (videoId, videoSrc) => {
    const videoEl = document.getElementById(videoId);
    if (!videoEl) return;

    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("preload", "auto");

    const sourceEl = videoEl.querySelector('source');
    if (sourceEl) {
      sourceEl.src = videoSrc;
    } else {
      videoEl.src = videoSrc;
    }
    videoEl.load();

    const showVideo = () => {
      videoEl.style.visibility = 'visible';
      videoEl.style.opacity = "1";
      videoEl.play().catch(err => {
        videoEl.style.opacity = "1";
        console.warn(`Autoplay background video [${videoId}] failed or was prevented:`, err);
      });
    };

    const onVideoReady = () => {
      videoEl.removeEventListener('canplay', onVideoReady);
      videoEl.removeEventListener('loadeddata', onVideoReady);
      videoEl.removeEventListener('loadedmetadata', onVideoReady);
      showVideo();
    };

    if (videoEl.readyState >= 3) {
      showVideo();
    } else {
      videoEl.addEventListener('canplay', onVideoReady, { once: true });
      videoEl.addEventListener('loadeddata', onVideoReady, { once: true });
      videoEl.addEventListener('loadedmetadata', onVideoReady, { once: true });
      window.setTimeout(showVideo, 1500);
    }

    videoEl.addEventListener('error', () => {
      console.warn(`Falha ao carregar o vídeo [${videoId}]: ${videoSrc}`);
      videoEl.style.visibility = 'visible';
      videoEl.style.opacity = "1";
    }, { once: true });
  };

  // Load Hero and Footer background videos asynchronously
  initAsyncBackgroundVideo("hero-video", "assets/video-hero.mp4");
  initAsyncBackgroundVideo("footer-video", "assets/video-footer.mp4");

  /**
   * Trailer playback controls.
   * The video starts playing automatically, muted.
   * Clicking the video restarts it, unmutes the audio, hides the play button,
   * and enables native video controls.
   */
  const trailerVideo = document.getElementById("trailer-video");
  const trailerOverlay = document.getElementById("trailer-overlay");
  const trailerWrapper = document.getElementById("trailer-wrapper");
  const navbar = document.getElementById("navbar");

  if (trailerVideo && trailerOverlay && trailerWrapper) {
    let hasBeenUnmuted = false;

    // Handle play-to-unmute transition on click
    const handleTrailerActivation = (e) => {
      e.stopPropagation(); // Prevent duplicate trigger

      if (!hasBeenUnmuted) {
        // Return to start
        trailerVideo.currentTime = 0;
        // Unmute audio
        trailerVideo.muted = false;
        // Turn off loop for conscious playback
        trailerVideo.loop = false;
        
        trailerVideo.play()
          .then(() => {
            // Hide the visual play overlay
            trailerOverlay.classList.add("hidden");
            // Show standard video controls for volume/scrubbing
            trailerVideo.controls = true;
            hasBeenUnmuted = true;
          })
          .catch(err => {
            console.error("Failed to play trailer with sound:", err);
          });
      }
    };

    // Attach click events to the video, overlay, and wrapper
    trailerWrapper.addEventListener("click", handleTrailerActivation);
  }

  // Smooth scroll links hookup
  const setupSmoothScroll = () => {
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    scrollLinks.forEach(link => {
      link.addEventListener("click", function(e) {
        const targetId = this.getAttribute("href");
        if (targetId === "#") return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          // Adjust scroll position: scroll to 0 for hero/top, else subtract fixed navbar height
          let targetPosition;
          if (targetId === "#hero") {
            targetPosition = 0;
          } else {
            const navbarHeight = navbar ? navbar.offsetHeight : 80;
            targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
          }
          window.scrollTo({
            top: targetPosition,
            behavior: "smooth"
          });
        }
      });
    });
  };

  // Add scroll handler to toggle navbar states
  const initNavbarScroll = () => {
    const handleNavbarScroll = () => {
      if (window.scrollY > 30) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };
    handleNavbarScroll();
    window.addEventListener("scroll", handleNavbarScroll);
  };

  // Stagger letters of the hero title
  const initHeroTitleAnimation = () => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      const text = heroTitle.textContent.trim();
      heroTitle.innerHTML = '';
      [...text].forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.animationDelay = `${index * 0.07}s`;
        span.classList.add('animate-char');
        heroTitle.appendChild(span);
      });
    }
  };

  // Intersection Observer for scroll entrance animations
  const setupScrollAnimations = () => {
    const animatedElements = document.querySelectorAll('.reveal-on-scroll');
    
    const observerOptions = {
      root: null,
      rootMargin: "-50px 0px",
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    animatedElements.forEach(el => observer.observe(el));
  };

  const preloader = document.getElementById("preloader");
  const preloaderPercent = document.getElementById("preloader-percent");
  let preloaderValue = 0;
  let preloaderInterval = null;
  let preloaderHidden = false;
  const preloaderStart = Date.now();
  const PRELOADER_MIN_TIME = 900; // 20 seconds

  const removePreloader = () => {
    if (!preloader || !preloader.parentNode) return;
    preloader.parentNode.removeChild(preloader);
  };

  const hidePreloader = () => {
    if (preloaderHidden || !preloader) return;
    preloaderHidden = true;

    if (preloaderPercent) {
      preloaderValue = 100;
      preloaderPercent.textContent = `100%`;
    }
    if (preloaderInterval !== null) {
      window.clearInterval(preloaderInterval);
      preloaderInterval = null;
    }

    const elapsed = Date.now() - preloaderStart;
    const delay = Math.max(0, PRELOADER_MIN_TIME - elapsed);

    window.setTimeout(() => {
      preloader.classList.add("fade-out");
      window.setTimeout(removePreloader, 100);
    }, delay);
  };

  const startPreloaderCounter = () => {
    if (!preloaderPercent) return;
    preloaderPercent.textContent = `0%`;
    preloaderInterval = window.setInterval(() => {
      if (preloaderValue >= 99) return;
      preloaderValue = Math.min(99, preloaderValue + 1);
      preloaderPercent.textContent = `${preloaderValue}%`;
    }, 2200);
  };

  startPreloaderCounter();

  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener("load", hidePreloader);
    window.addEventListener('error', hidePreloader);
    window.setTimeout(hidePreloader, PRELOADER_MIN_TIME + 3000);
  }

  // Enable progressive enhancement animate-in features
  document.documentElement.classList.add('js-enabled');

  // Launch initializers
  initNavbarScroll();
  initHeroTitleAnimation();
  setupSmoothScroll();
  setupScrollAnimations();
  initThreeMjolnirScenes();
});
