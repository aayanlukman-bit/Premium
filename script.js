// script.js - Complete version with enhanced filters

document.addEventListener('DOMContentLoaded', function () {
    const DEBOUNCE_DELAY = 500;
    const SCENES_PER_PAGE = 25;
    const PERFORMERS_PER_PAGE = 25;
    const STUDIOS_PER_PAGE = 25;
    const SEARCH_PER_PAGE = 25;
    let currentSeeAllMode = null;

    window.currentRequestController = null;

    let apiKey = localStorage.getItem('stashApiKey');
    if (!apiKey) {
        apiKey =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJTdGFzaFZhdWx0Iiwic3ViIjoiQVBJS2V5IiwiaWF0IjoxNzU0OTc4OTU0fQ.TwpkeOcc0ra1bY5GIQma_Ii8aBckX20eun4mT8Rn6co';
        localStorage.setItem('stashApiKey', apiKey);
    }
    StashAPI.init('http://localhost:9999/graphql', apiKey);

    const domCache = {
        dashboardContent: document.getElementById('dashboard-content'),
        homeBtn: document.querySelector('.home-btn'),
        moviesBtn: document.querySelector('.movies-btn'),
        performersBtn: document.querySelector('.performers-btn'),
        studiosBtn: document.querySelector('.studios-btn'),
        scenesGrid: document.getElementById('scenes-grid'),
        scenesCarousel: document.getElementById('scenes-carousel'),
        scenesTitle: document.getElementById('scenes-title'),
        globalLoader: document.getElementById('global-loader'),
        blurToggleBtn: document.getElementById('blur-toggle-btn'),
        searchInput: document.querySelector('.prime-search-input'),
        paginationContainer: document.createElement('div'),
        sceneDetailContainer: document.getElementById('scene-detail-container'),
        sceneDetailTitle: document.getElementById('scene-detail-title'),
        sceneDetailRating: document.getElementById('scene-detail-rating'),
        sceneDetailStudio: document.getElementById('scene-detail-studio'),
        sceneDetailPerformers: document.getElementById('scene-detail-performers'),
        sceneDetailDate: document.getElementById('scene-detail-date'),
        sceneDetailTags: document.getElementById('scene-detail-tags'),
        sceneDetailDescription: document.getElementById('scene-detail-description'),
        videoPlayer: document.getElementById('scene-video-player'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        progressBar: document.getElementById('progress-bar'),
        timeDisplay: document.getElementById('time-display'),
        muteBtn: document.getElementById('mute-btn'),
        volumeControl: document.getElementById('volume-control'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        backToDashboardBtn: document.querySelector('.back-to-dashboard'),
        continueWatchingGrid: document.getElementById('continue-watching-grid'),
        primeCarouselContainer: document.querySelector('.prime-carousel .carousel-container'),
        profileBtn: document.getElementById('profile-btn'),
        profileDropdown: document.getElementById('profile-menu-dropdown'),
        performerDetailContainer: document.getElementById('performer-detail-container'),
        studioDetailContainer: document.getElementById('studio-detail-container'),
    };

    const dataCache = {
        scenes: null,
        lastUpdated: null,
        performers: null,
        studios: null,
        tags: null,
    };

    const paginationState = {
        scenes: { page: 1, total: 0, mode: '' },
        performers: { page: 1, total: 0, mode: 'performers' },
        studios: { page: 1, total: 0, mode: 'studios' },
    };

    let isBlurEnabled = true;

    let heroCarouselSlides = [];

    // Ambient background video
    let ambientScenes = [];
    let ambientIndex = 0;
    let ambientVideo = null;

    let heroCurrentSlide = 0;
    let heroCarouselInterval;

    domCache.paginationContainer.className = 'pagination-container';

    // Enhanced filterState with more options
    const filterState = {
        alphabet: '',
        ageRange: '',
        sceneCount: '',
        sortBy: 'name-asc',
        ratingRange: '',
        durationRange: '',
        tags: [],
        performerCount: '',
        dateRange: {
            start: '',
            end: '',
        },
        studio: '',
    };

    let currentMode = '';
    let currentQuery = '';

    function animateTransition(callback) {
        const transitionOverlay = document.getElementById('transition-overlay');
        transitionOverlay.classList.add('active');
        setTimeout(() => {
            if (callback) callback();
            setTimeout(() => {
                transitionOverlay.classList.remove('active');
            }, 300);
        }, 150);
    }

    function getRandomVideoStart(duration) {
        if (!duration || duration < 30) return 0;
        const minStart = duration * 0.2;
        const maxStart = duration * 0.7;
        return Math.random() * (maxStart - minStart) + minStart;
    }

    function toggleHeroCarousel(show) {
        const heroCarousel = document.querySelector('.prime-carousel');
        if (heroCarousel) {
            if (show) {
                heroCarousel.style.display = 'block';
                setTimeout(() => {
                    heroCarousel.style.opacity = '1';
                    heroCarousel.style.transform = 'translateY(0)';
                }, 10);
            } else {
                heroCarousel.style.opacity = '0';
                heroCarousel.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    heroCarousel.style.display = 'none';
                }, 300);
            }
        }
    }

    function handleHeaderScroll() {
        const heroSection = document.querySelector('.prime-carousel');
        const header = document.querySelector('.prime-header');
        const heroContents = document.querySelectorAll('.prime-carousel .carousel-content');

        if (!heroSection || !header || !heroContents.length) return;

        const heroHeight = heroSection.offsetHeight;
        const scrollPosition = window.scrollY;

        if (scrollPosition > heroHeight - 120) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        const fadeStart = 20;
        const fadeEnd = heroHeight * 0.4;
        let opacity = 1;

        if (scrollPosition > fadeStart) {
            opacity = Math.max(0, 1 - (scrollPosition - fadeStart) / (fadeEnd - fadeStart));
        }

        heroContents.forEach((content) => {
            content.style.opacity = opacity;
            if (opacity <= 0.02) {
                content.classList.add('fade-out');
            } else {
                content.classList.remove('fade-out');
            }
        });
    }

    function truncateWords(text, maxWords) {
        if (!text) return '';
        const words = text.split(' ');
        if (words.length <= maxWords) return text;
        return words.slice(0, maxWords).join(' ') + '....';
    }

    function setHeroAccentColor(video) {
        if (!video) return;

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = 64;
            canvas.height = 36;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            let r = 0,
                g = 0,
                b = 0,
                count = 0;

            for (let i = 0; i < imageData.length; i += 16) {
                r += imageData[i];
                g += imageData[i + 1];
                b += imageData[i + 2];
                count++;
            }

            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);

            const accent = `rgba(${r}, ${g}, ${b}, 0.6)`;
            document.documentElement.style.setProperty('--hero-accent', accent);
        } catch (e) {
            // Fail silently (CORS-safe)
        }
    }

    function initHeaderState() {
        const header = document.querySelector('.prime-header');
        if (window.scrollY > document.querySelector('.prime-carousel')?.offsetHeight - 100) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }
    }

    function logError(message, error) {
        console.error(`[StashVault] ${message}`, error);
        showError(`${message}: ${error.message || 'Unknown error'}`);
    }

    function showHeroSlide(index) {
        if (!heroCarouselSlides || heroCarouselSlides.length === 0) return;

        heroCarouselSlides.forEach((slide, i) => {
            const video = slide.querySelector('video');
            if (i === index) {
                slide.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                slide.style.opacity = '1';
                slide.style.transform = 'scale(1)';
                slide.style.zIndex = '2';
                slide.classList.add('active');

                if (video) {
                    if (isBlurEnabled) {
                        video.classList.add('blurred-video');
                    } else {
                        video.classList.remove('blurred-video');
                    }

                    video.load();

                    const playVideo = () => {
                        if (video.duration && video.duration > 0) {
                            const randomStart = getRandomVideoStart(video.duration);
                            video.currentTime = randomStart;
                        }

                        video.play().catch((e) => {
                            console.warn(
                                'Autoplay was prevented for hero carousel slide',
                                index,
                                e
                            );
                        });
                    };

                    if (video.readyState >= 2) {
                        setTimeout(playVideo, 100);
                    } else {
                        video.addEventListener(
                            'loadeddata',
                            () => {
                                setTimeout(playVideo, 100);
                            },
                            { once: true }
                        );
                    }

                    setHeroAccentColor(video);
                }
            } else {
                slide.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                slide.style.opacity = '0';
                slide.style.transform = 'scale(1.05)';
                slide.style.zIndex = '1';
                slide.classList.remove('active');

                if (video) {
                    video.pause();
                    video.currentTime = 0;
                    if (isBlurEnabled) {
                        video.classList.add('blurred-video');
                    } else {
                        video.classList.remove('blurred-video');
                    }
                }
            }
        });

        heroCurrentSlide = index;
    }

    function nextHeroSlide() {
        if (!heroCarouselSlides || heroCarouselSlides.length === 0) return;
        heroCurrentSlide = (heroCurrentSlide + 1) % heroCarouselSlides.length;
        showHeroSlide(heroCurrentSlide);
    }

    function prevHeroSlide() {
        if (!heroCarouselSlides || heroCarouselSlides.length === 0) return;
        heroCurrentSlide =
            (heroCurrentSlide - 1 + heroCarouselSlides.length) % heroCarouselSlides.length;
        showHeroSlide(heroCurrentSlide);
    }

    function updateHeroCarouselBlur() {
        const heroVideos = document.querySelectorAll('.carousel-slide video');
        heroVideos.forEach((video) => {
            if (isBlurEnabled) {
                video.classList.add('blurred-video');
            } else {
                video.classList.remove('blurred-video');
            }
        });
    }

    async function initializeHeroCarousel() {
        try {
            const allScenes = await StashAPI.getAllScenes();
            if (!allScenes || allScenes.length === 0) {
                console.warn('No scenes found for hero carousel.');
                return;
            }

            let randomScenes = [...allScenes].sort(() => Math.random() - 0.5).slice(0, 5);

            if (randomScenes.length === 0) return;

            const prevBtn = domCache.primeCarouselContainer.querySelector('.carousel-prev');
            const nextBtn = domCache.primeCarouselContainer.querySelector('.carousel-next');
            domCache.primeCarouselContainer.innerHTML = '';

            if (prevBtn) {
                const prevClone = prevBtn.cloneNode(true);
                prevClone.addEventListener('click', () => {
                    prevHeroSlide();
                    resetHeroInterval();
                });
                domCache.primeCarouselContainer.appendChild(prevClone);
            }

            if (nextBtn) {
                const nextClone = nextBtn.cloneNode(true);
                nextClone.addEventListener('click', () => {
                    nextHeroSlide();
                    resetHeroInterval();
                });
                domCache.primeCarouselContainer.appendChild(nextClone);
            }

            randomScenes.forEach((scene) => {
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';

                let videoUrl = '';
                if (scene.stream) {
                    videoUrl = scene.stream.startsWith('http')
                        ? scene.stream
                        : `http://localhost:9999${scene.stream}`;
                }

                if (videoUrl) {
                    const video = document.createElement('video');
                    video.src = videoUrl;
                    video.muted = true;
                    video.loop = true;
                    video.playbackRate = 2.0;
                    video.preload = 'auto';
                    video.setAttribute('playsinline', '');

                    video.classList.add('blurred-video');

                    video.load();

                    video.addEventListener('canplay', function () {
                        if (!slide.classList.contains('active')) {
                            video.pause();
                            video.currentTime = 0;
                            video.classList.add('blurred-video');
                        }
                    });

                    slide.appendChild(video);
                }

                const content = document.createElement('div');
                content.className = 'carousel-content';
                const description = scene.details?.trim()
                    ? scene.details
                    : scene.studio?.name
                    ? `From Studio ${scene.studio.name}`
                    : '';
                const truncatedDescription = truncateWords(description, 30);

                content.innerHTML = `
                    <h2>${scene.title}</h2>
                    <p>${truncatedDescription}</p>
                    <button class="carousel-btn scene-item" data-scene-id="${scene.id}">
                        <i class="fas fa-play"></i> Watch Now
                    </button>
                `;
                slide.appendChild(content);

                domCache.primeCarouselContainer.insertBefore(
                    slide,
                    domCache.primeCarouselContainer.querySelector('.carousel-next')
                );
            });

            heroCarouselSlides =
                domCache.primeCarouselContainer.querySelectorAll('.carousel-slide');

            if (heroCarouselSlides.length > 0) {
                setTimeout(() => {
                    showHeroSlide(0);
                    resetHeroInterval();
                }, 300);
            }
        } catch (error) {
            logError('Failed to initialize hero carousel', error);
        }
    }

    function resetHeroInterval() {
        clearInterval(heroCarouselInterval);
        heroCarouselInterval = setInterval(nextHeroSlide, 6000);
    }

    function toggleImageBlur(enable) {
        const body = document.body;
        isBlurEnabled = enable;

        if (enable) {
            body.classList.remove('no-blur');
        } else {
            body.classList.add('no-blur');
        }

        updateHeroCarouselBlur();

        document
            .querySelectorAll('.carousel-image, .scene-poster, .performer-image, .studio-image')
            .forEach((img) => {
                if (enable) {
                    img.classList.add('blurred-image');
                } else {
                    img.classList.remove('blurred-image');
                }
            });
    }

    if (domCache.blurToggleBtn) {
        domCache.blurToggleBtn.addEventListener('click', function () {
            isBlurEnabled = !isBlurEnabled;
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye-slash', isBlurEnabled);
            icon.classList.toggle('fa-eye', !isBlurEnabled);
            toggleImageBlur(isBlurEnabled);
        });
    }

    function initializeCarousels() {
        setupCarouselControls('top-scenes-carousel', {
            element: document.getElementById('top-scenes-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('scenes-carousel', {
            element: document.getElementById('scenes-grid'),
            position: 0,
            visibleItems: SCENES_PER_PAGE,
        });
        setupCarouselControls('continue-watching-carousel', {
            element: document.getElementById('continue-watching-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('under-25-carousel', {
            element: document.getElementById('under-25-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('bukkake-carousel', {
            element: document.getElementById('bukkake-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('recommended-carousel', {
            element: document.getElementById('recommended-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('recently-added-carousel', {
            element: document.getElementById('recently-added-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
        setupCarouselControls('studio-highlights-carousel', {
            element: document.getElementById('studio-highlights-grid'),
            position: 0,
            itemWidth: 304,
            visibleItems: 4,
        });
    }

    function setupCarouselControls(carouselId, carousel) {
        const container = document.getElementById(carouselId);
        if (!container) return;

        const prevBtn = container.querySelector('.carousel-prev');
        const nextBtn = container.querySelector('.carousel-next');

        if (carouselId === 'scenes-carousel') {
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (paginationState.scenes.page > 1) {
                        paginationState.scenes.page--;
                        refreshScenesWithFilters();
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (
                        paginationState.scenes.page * SCENES_PER_PAGE <
                        paginationState.scenes.total
                    ) {
                        paginationState.scenes.page++;
                        refreshScenesWithFilters();
                    }
                });
            }
        } else {
            if (prevBtn) prevBtn.addEventListener('click', () => moveCarousel(carousel, 'prev'));
            if (nextBtn) nextBtn.addEventListener('click', () => moveCarousel(carousel, 'next'));
        }
    }

    function moveCarousel(carousel, direction) {
        const items = carousel.element.children;
        const itemCount = items.length;

        if (direction === 'next') {
            carousel.position = Math.min(carousel.position + 1, itemCount - carousel.visibleItems);
        } else {
            carousel.position = Math.max(carousel.position - 1, 0);
        }

        carousel.element.style.transform = `translateX(-${
            carousel.position * carousel.itemWidth
        }px)`;
    }

    function cleanupPreviousView() {
        console.log('Cleaning up previous view');

        if (window.currentRequestController) {
            window.currentRequestController.abort();
        }

        if (domCache.videoPlayer && !domCache.videoPlayer.paused) {
            domCache.videoPlayer.pause();
            domCache.videoPlayer.currentTime = 0;
        }

        if (domCache.searchInput) {
            domCache.searchInput.value = '';
        }

        domCache.sceneDetailContainer.style.display = 'none';
        domCache.performerDetailContainer.style.display = 'none';
        domCache.studioDetailContainer.style.display = 'none';

        const filterUI = document.querySelector('.filter-sort-container');
        if (filterUI) {
            filterUI.remove();
        }

        const quickFilters = document.querySelector('.quick-filters');
        if (quickFilters) {
            quickFilters.remove();
        }

        if (domCache.scenesGrid) {
            domCache.scenesGrid.innerHTML = '';
        }

        currentQuery = '';
        paginationState.scenes.page = 1;
    }

    function setupConsistentBackBehavior() {
        const backButtons = document.querySelectorAll('.back-to-dashboard');
        backButtons.forEach((btn) => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                animateTransition(() => handleBackToDashboard());
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                animateTransition(() => handleBackToDashboard());
            }
        });
    }

    function enhanceImageLoading() {
        document.addEventListener(
            'error',
            function (e) {
                if (
                    e.target.classList.contains('carousel-image') ||
                    e.target.classList.contains('scene-poster') ||
                    e.target.classList.contains('performer-image') ||
                    e.target.classList.contains('studio-image')
                ) {
                    const img = e.target;
                    if (img.classList.contains('performer-image')) {
                        img.src = 'fallback.jpg';
                    } else if (img.classList.contains('studio-image')) {
                        img.src = 'studio-placeholder.jpg';
                    } else {
                        img.src = 'scene-placeholder.jpg';
                    }

                    if (isBlurEnabled) {
                        img.classList.add('blurred-image');
                    }
                }
            },
            true
        );
    }

    function createFilterPanel(mode) {
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-sort-container';

        const alphabetSection = createAlphabetSection(mode);
        let specificFilters = '';

        if (mode === 'performers') {
            specificFilters = createPerformerFilters();
        } else if (mode === 'studios') {
            specificFilters = createStudioFilters();
        } else if (mode === 'movies') {
            specificFilters = createSceneFilters();
        }

        const sortSection = createSortSection(mode);

        filterContainer.innerHTML = `
            <div class="filter-header">
                <h3 style="margin: 0; color: var(--text-primary); font-size: 16px;">
                    <i class="fas fa-filter"></i> Browse
                    <span style="color: var(--text-secondary); font-size: 14px; margin-left: 10px;">
                    </span>
                </h3>
            </div>
            <div class="filter-content">
                ${alphabetSection}${specificFilters}${sortSection}
            </div>
        `;

        filterContainer.addEventListener('click', function (e) {
            if (
                !e.target.classList.contains('filter-btn') &&
                !e.target.closest('.filter-btn') &&
                !e.target.classList.contains('filter-section') &&
                !e.target.classList.contains('date-input') &&
                !e.target.classList.contains('tag-search-input') &&
                !e.target.classList.contains('tag-cloud-item') &&
                !e.target.closest('.selected-tag')
            ) {
                this.classList.toggle('expanded');
            }
        });

        setupFilterEventListeners(filterContainer, mode);

        // Initialize tag cloud for scenes
        if (mode === 'movies') {
            setTimeout(() => initializeTagCloud(), 100);
        }

        return filterContainer;
    }

    function createAlphabetSection(mode) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const alphabetButtons = alphabet
            .map(
                (letter) =>
                    `<button class="filter-btn alphabet-btn ${
                        filterState.alphabet === letter ? 'active' : ''
                    }" 
                    data-filter="alphabet" data-value="${letter}">${letter}</button>`
            )
            .join('');

        const clearButton = `<button class="filter-btn" data-filter="alphabet" data-value="">Clear</button>`;

        return `
            <div class="filter-section">
                <h3>${getAlphabetTitle(mode)}</h3>
                <div class="filter-row alphabet-row">
                    ${alphabetButtons}
                    ${clearButton}
                </div>
            </div>
        `;
    }

    function getAlphabetTitle(mode) {
        switch (mode) {
            case 'movies':
                return 'Filter by Title';
            case 'performers':
                return 'Filter by Name';
            case 'studios':
                return 'Filter by Name';
            default:
                return 'Filter';
        }
    }

    function createPerformerFilters() {
        const ageRanges = [
            { value: '18-24', label: '18-24' },
            { value: '25-34', label: '25-34' },
            { value: '35-plus', label: '35+' },
        ];

        const sceneCounts = [
            { value: '1', label: '1 Scene' },
            { value: '2-5', label: '2-5 Scenes' },
            { value: '6-plus', label: '6+ Scenes' },
        ];

        const ageButtons = ageRanges
            .map(
                (range) =>
                    `<button class="filter-btn ${
                        filterState.ageRange === range.value ? 'active' : ''
                    }" 
                    data-filter="age" data-value="${range.value}">${range.label}</button>`
            )
            .join('');

        const sceneButtons = sceneCounts
            .map(
                (count) =>
                    `<button class="filter-btn ${
                        filterState.sceneCount === count.value ? 'active' : ''
                    }" 
                    data-filter="sceneCount" data-value="${count.value}">${count.label}</button>`
            )
            .join('');

        return `
            <div class="filter-section">
                <h3>Age Range</h3>
                <div class="filter-row age-filter">
                    ${ageButtons}
                    <button class="filter-btn" data-filter="age" data-value="">Clear</button>
                </div>
            </div>
            <div class="filter-section">
                <h3>Scene Count</h3>
                <div class="filter-row scene-count-filter">
                    ${sceneButtons}
                    <button class="filter-btn" data-filter="sceneCount" data-value="">Clear</button>
                </div>
            </div>
        `;
    }

    function createStudioFilters() {
        const sceneCounts = [
            { value: '1-5', label: '1-5 Scenes' },
            { value: '6-20', label: '6-20 Scenes' },
            { value: '21-plus', label: '21+ Scenes' },
        ];

        const sceneButtons = sceneCounts
            .map(
                (count) =>
                    `<button class="filter-btn ${
                        filterState.sceneCount === count.value ? 'active' : ''
                    }" 
                    data-filter="sceneCount" data-value="${count.value}">${count.label}</button>`
            )
            .join('');

        return `
            <div class="filter-section">
                <h3>Scene Count</h3>
                <div class="filter-row scene-count-filter">
                    ${sceneButtons}
                    <button class="filter-btn" data-filter="sceneCount" data-value="">Clear</button>
                </div>
            </div>
        `;
    }

    function createSceneFilters() {
        const ratingRanges = [
            { value: '90-100', label: '★★★★★ (90-100)' },
            { value: '80-89', label: '★★★★☆ (80-89)' },
            { value: '70-79', label: '★★★☆☆ (70-79)' },
            { value: '60-69', label: '★★☆☆☆ (60-69)' },
            { value: '0-59', label: '★☆☆☆☆ (0-59)' },
            { value: 'unrated', label: 'Unrated' },
        ];

        const durationRanges = [
            { value: 'short', label: 'Short (<10 min)' },
            { value: 'medium', label: 'Medium (10-30 min)' },
            { value: 'long', label: 'Long (>30 min)' },
        ];

        const performerCounts = [
            { value: '1', label: 'Solo' },
            { value: '2', label: 'Duo' },
            { value: '3', label: 'Trio' },
            { value: '4-plus', label: '4+ Performers' },
        ];

        const ratingButtons = ratingRanges
            .map(
                (range) =>
                    `<button class="filter-btn ${
                        filterState.ratingRange === range.value ? 'active' : ''
                    }" 
                    data-filter="ratingRange" data-value="${range.value}">${range.label}</button>`
            )
            .join('');

        const durationButtons = durationRanges
            .map(
                (duration) =>
                    `<button class="filter-btn ${
                        filterState.durationRange === duration.value ? 'active' : ''
                    }" 
                    data-filter="durationRange" data-value="${duration.value}">${
                        duration.label
                    }</button>`
            )
            .join('');

        const performerCountButtons = performerCounts
            .map(
                (count) =>
                    `<button class="filter-btn ${
                        filterState.performerCount === count.value ? 'active' : ''
                    }" 
                    data-filter="performerCount" data-value="${count.value}">${
                        count.label
                    }</button>`
            )
            .join('');

        // Date range picker
        const dateRangeHTML = `
            <div class="date-range-picker">
                <input type="date" id="date-start" class="date-input" placeholder="Start date" 
                       value="${filterState.dateRange.start}">
                <span class="date-separator">to</span>
                <input type="date" id="date-end" class="date-input" placeholder="End date" 
                       value="${filterState.dateRange.end}">
                <button class="filter-btn clear-date" data-filter="dateRange" data-value="clear">
                    <i class="fas fa-times"></i> Clear
                </button>
            </div>
        `;

        // Tag cloud filter
        const tagCloudHTML = `
            <div class="tag-cloud-filter">
                <input type="text" id="tag-search" class="tag-search-input" 
                       placeholder="Search tags...">
                <div class="selected-tags" id="selected-tags"></div>
                <div class="tag-cloud" id="tag-cloud"></div>
            </div>
        `;

        return `
            <div class="filter-section">
                <h3>Rating</h3>
                <div class="filter-row rating-filter">
                    ${ratingButtons}
                    <button class="filter-btn" data-filter="ratingRange" data-value="">Clear</button>
                </div>
            </div>
            <div class="filter-section">
                <h3>Duration</h3>
                <div class="filter-row duration-filter">
                    ${durationButtons}
                    <button class="filter-btn" data-filter="durationRange" data-value="">Clear</button>
                </div>
            </div>
            <div class="filter-section">
                <h3>Performer Count</h3>
                <div class="filter-row performer-count-filter">
                    ${performerCountButtons}
                    <button class="filter-btn" data-filter="performerCount" data-value="">Clear</button>
                </div>
            </div>
            <div class="filter-section">
                <h3>Date Range</h3>
                ${dateRangeHTML}
            </div>
            <div class="filter-section">
                <h3>Tags</h3>
                ${tagCloudHTML}
            </div>
        `;
    }

    function createSortSection(mode) {
        const sortOptions = getSortOptions(mode);
        const sortButtons = sortOptions
            .map(
                (option) =>
                    `<button class="filter-btn ${
                        filterState.sortBy === option.value ? 'active' : ''
                    }" 
                    data-filter="sort" data-value="${option.value}">${option.label}</button>`
            )
            .join('');

        // Add clear all filters button
        const clearAllBtn = `<button class="filter-btn clear-all-btn" id="clear-all-filters">
            <i class="fas fa-broom"></i> Clear All Filters
        </button>`;

        return `
            <div class="filter-section">
                <h3>Sort By</h3>
                <div class="filter-row sort-options">
                    ${sortButtons}
                </div>
            </div>
            ${clearAllBtn}
        `;
    }

    function getSortOptions(mode) {
        const baseOptions = [
            { value: 'name-asc', label: 'Name A→Z' },
            { value: 'name-desc', label: 'Name Z→A' },
        ];

        if (mode === 'movies') {
            return [
                ...baseOptions,
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'rating-desc', label: 'Highest Rated' },
                { value: 'rating-asc', label: 'Lowest Rated' },
                { value: 'duration-desc', label: 'Longest First' },
                { value: 'duration-asc', label: 'Shortest First' },
                { value: 'age-asc', label: 'Youngest Performer' },
                { value: 'age-desc', label: 'Oldest Performer' },
                { value: 'random', label: 'Random' },
            ];
        } else if (mode === 'performers') {
            return [
                ...baseOptions,
                { value: 'scenes-desc', label: 'Most Scenes' },
                { value: 'scenes-asc', label: 'Least Scenes' },
                { value: 'age-asc', label: 'Youngest First' },
                { value: 'age-desc', label: 'Oldest First' },
                { value: 'recent-scenes', label: 'Recently Active' },
            ];
        } else {
            return [
                ...baseOptions,
                { value: 'scenes-desc', label: 'Most Scenes' },
                { value: 'scenes-asc', label: 'Least Scenes' },
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'performer-count', label: 'Most Performers' },
            ];
        }
    }

    function setupFilterEventListeners(container, mode) {
        const filterButtons = container.querySelectorAll('.filter-btn');
        filterButtons.forEach((button) => {
            button.addEventListener('click', function (e) {
                e.stopPropagation();
                const filterType = this.dataset.filter;
                const filterValue = this.dataset.value;

                if (filterType === 'dateRange' && filterValue === 'clear') {
                    filterState.dateRange = { start: '', end: '' };
                    const dateStart = document.getElementById('date-start');
                    const dateEnd = document.getElementById('date-end');
                    if (dateStart) dateStart.value = '';
                    if (dateEnd) dateEnd.value = '';
                } else if (filterType === 'clear-all') {
                    clearAllFilters();
                    return;
                } else {
                    filterState[filterType] = filterValue;
                }

                updateFilterButtonStates(container, filterType, filterValue);
                applyFilters(mode);
            });
        });

        // Date range listeners
        const dateStart = container.querySelector('#date-start');
        const dateEnd = container.querySelector('#date-end');

        if (dateStart) {
            dateStart.addEventListener('change', function () {
                filterState.dateRange.start = this.value;
                applyFilters(mode);
            });
        }

        if (dateEnd) {
            dateEnd.addEventListener('change', function () {
                filterState.dateRange.end = this.value;
                applyFilters(mode);
            });
        }

        // Clear all filters button
        const clearAllBtn = container.querySelector('#clear-all-filters');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                clearAllFilters();
            });
        }
    }

    function updateFilterButtonStates(container, filterType, activeValue) {
        const allButtons = container.querySelectorAll(`[data-filter="${filterType}"]`);
        allButtons.forEach((btn) => btn.classList.remove('active'));
        if (activeValue) {
            const activeButton = container.querySelector(
                `[data-filter="${filterType}"][data-value="${activeValue}"]`
            );
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
    }

    function clearAllFilters() {
        filterState.alphabet = '';
        filterState.ageRange = '';
        filterState.sceneCount = '';
        filterState.ratingRange = '';
        filterState.durationRange = '';
        filterState.performerCount = '';
        filterState.tags = [];
        filterState.dateRange = { start: '', end: '' };
        filterState.sortBy = 'name-asc';

        // Reset all filter buttons
        const allButtons = document.querySelectorAll('.filter-btn');
        allButtons.forEach((btn) => btn.classList.remove('active'));

        // Reset date inputs
        const dateStart = document.getElementById('date-start');
        const dateEnd = document.getElementById('date-end');
        if (dateStart) dateStart.value = '';
        if (dateEnd) dateEnd.value = '';

        // Clear selected tags
        const selectedTags = document.getElementById('selected-tags');
        if (selectedTags) selectedTags.innerHTML = '';

        // Reset quick filters
        const quickFilters = document.querySelectorAll('.quick-filter-chip');
        quickFilters.forEach((chip) => chip.classList.remove('active'));

        // Reapply filters
        if (currentMode === 'movies') applyFilters('movies');
        else if (currentMode === 'performers') applyFilters('performers');
        else if (currentMode === 'studios') applyFilters('studios');

        // Update filter count
        updateFilterCount();
    }

    function applyFilters(mode) {
        paginationState.scenes.page = 1;
        switch (mode) {
            case 'movies':
                refreshScenesWithFilters();
                break;
            case 'performers':
                refreshPerformersWithFilters();
                break;
            case 'studios':
                refreshStudiosWithFilters();
                break;
        }

        updateFilterCount();
        updateURLWithFilters();
    }

    async function refreshScenesWithFilters() {
        try {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'flex';
            let scenes = await StashAPI.getAllScenes();
            scenes = applySceneFilters(scenes);
            scenes = applySceneSorting(scenes);
            const totalScenes = scenes.length;
            const startIndex = (paginationState.scenes.page - 1) * SCENES_PER_PAGE;
            const endIndex = Math.min(startIndex + SCENES_PER_PAGE, scenes.length);
            const pageScenes = scenes.slice(startIndex, endIndex);
            paginationState.scenes.total = totalScenes;
            updateScenes(pageScenes, 'movies', totalScenes);
        } catch (error) {
            logError('Error refreshing scenes with filters', error);
            showError('Failed to load scenes. Please try again.');
            domCache.scenesGrid.innerHTML = '<div class="no-data">Error loading scenes.</div>';
        } finally {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'none';
        }
    }

    async function refreshPerformersWithFilters() {
        try {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'flex';
            if (!dataCache.performers) {
                dataCache.performers = await StashAPI.getAllPerformers();
            }
            let performers = [...dataCache.performers];
            performers = applyPerformerFilters(performers);
            performers = applyPerformerSorting(performers);
            const totalPerformers = performers.length;
            const startIndex = (paginationState.scenes.page - 1) * PERFORMERS_PER_PAGE;
            const endIndex = Math.min(startIndex + PERFORMERS_PER_PAGE, performers.length);
            const pagePerformers = performers.slice(startIndex, endIndex);
            paginationState.scenes.total = totalPerformers;
            updatePerformers(pagePerformers, totalPerformers);
        } catch (error) {
            logError('Error refreshing performers with filters', error);
            showError('Failed to load performers. Please try again.');
            domCache.scenesGrid.innerHTML = '<div class="no-data">Error loading performers.</div>';
        } finally {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'none';
        }
    }

    async function refreshStudiosWithFilters() {
        try {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'flex';

            if (!dataCache.studios) {
                dataCache.studios = await StashAPI.getAllStudios();
            }

            let filteredStudios = [...dataCache.studios];
            filteredStudios = applyStudioFilters(filteredStudios);
            filteredStudios = applyStudioSorting(filteredStudios);
            const totalStudios = filteredStudios.length;

            const studioTopPerformers = await StashAPI.getTopPerformersForAllStudios();

            const startIndex = (paginationState.scenes.page - 1) * STUDIOS_PER_PAGE;
            const endIndex = Math.min(startIndex + STUDIOS_PER_PAGE, filteredStudios.length);
            const pageStudios = filteredStudios.slice(startIndex, endIndex);

            const studiosWithPerformer = pageStudios.map((studio) => ({
                ...studio,
                topPerformer: studioTopPerformers[studio.name] || null,
            }));

            paginationState.scenes.total = totalStudios;
            updateStudios(studiosWithPerformer, totalStudios);
        } catch (error) {
            logError('Error refreshing studios with filters', error);
            showError('Failed to load studios. Please try again.');
            domCache.scenesGrid.innerHTML = '<div class="no-data">Error loading studios.</div>';
        } finally {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'none';
        }
    }

    function applySceneFilters(scenes) {
        let filtered = scenes.filter((scene) => {
            // Alphabet filter
            if (filterState.alphabet) {
                const firstLetter = scene.title?.charAt(0).toUpperCase();
                if (firstLetter !== filterState.alphabet) return false;
            }

            // Rating filter
            if (filterState.ratingRange) {
                const rating = scene.rating100 || 0;
                switch (filterState.ratingRange) {
                    case '90-100':
                        if (rating < 90 || rating > 100) return false;
                        break;
                    case '80-89':
                        if (rating < 80 || rating > 89) return false;
                        break;
                    case '70-79':
                        if (rating < 70 || rating > 79) return false;
                        break;
                    case '60-69':
                        if (rating < 60 || rating > 69) return false;
                        break;
                    case '0-59':
                        if (rating < 0 || rating > 59) return false;
                        break;
                    case 'unrated':
                        if (rating !== null && rating !== undefined && rating !== 0) return false;
                        break;
                }
            }

            // Duration filter
            if (filterState.durationRange) {
                const duration = scene.duration || scene.files?.[0]?.duration || 0;
                const minutes = Math.floor(duration / 60);

                switch (filterState.durationRange) {
                    case 'short':
                        if (minutes >= 10) return false;
                        break;
                    case 'medium':
                        if (minutes < 10 || minutes > 30) return false;
                        break;
                    case 'long':
                        if (minutes <= 30) return false;
                        break;
                }
            }

            // Performer count filter
            if (filterState.performerCount) {
                const performerCount = scene.performers?.length || 0;

                switch (filterState.performerCount) {
                    case '1':
                        if (performerCount !== 1) return false;
                        break;
                    case '2':
                        if (performerCount !== 2) return false;
                        break;
                    case '3':
                        if (performerCount !== 3) return false;
                        break;
                    case '4-plus':
                        if (performerCount < 4) return false;
                        break;
                }
            }

            // Date range filter
            if (filterState.dateRange.start || filterState.dateRange.end) {
                const sceneDate = scene.date ? new Date(scene.date) : null;

                if (sceneDate) {
                    if (filterState.dateRange.start) {
                        const startDate = new Date(filterState.dateRange.start);
                        if (sceneDate < startDate) return false;
                    }

                    if (filterState.dateRange.end) {
                        const endDate = new Date(filterState.dateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        if (sceneDate > endDate) return false;
                    }
                } else {
                    if (filterState.dateRange.start || filterState.dateRange.end) return false;
                }
            }

            // Tag filter
            if (filterState.tags && filterState.tags.length > 0) {
                const sceneTags = scene.tags || [];
                const hasAllTags = filterState.tags.every((tag) =>
                    sceneTags.some(
                        (sceneTag) => sceneTag && sceneTag.toLowerCase().includes(tag.toLowerCase())
                    )
                );
                if (!hasAllTags) return false;
            }

            return true;
        });

        return filtered;
    }

    function applyPerformerFilters(performers) {
        let filtered = performers.filter((performer) => {
            if (filterState.alphabet) {
                const firstLetter = performer.name?.charAt(0).toUpperCase();
                if (firstLetter !== filterState.alphabet) return false;
            }
            if (filterState.ageRange && performer.birthdate) {
                const age = calculateAge(performer.birthdate);
                if (age !== null) {
                    switch (filterState.ageRange) {
                        case '18-24':
                            if (age < 18 || age > 24) return false;
                            break;
                        case '25-34':
                            if (age < 25 || age > 34) return false;
                            break;
                        case '35-plus':
                            if (age < 35) return false;
                            break;
                    }
                } else return false;
            }
            if (filterState.sceneCount) {
                const sceneCount = performer.scene_count || 0;
                switch (filterState.sceneCount) {
                    case '1':
                        if (sceneCount !== 1) return false;
                        break;
                    case '2-5':
                        if (sceneCount < 2 || sceneCount > 5) return false;
                        break;
                    case '6-plus':
                        if (sceneCount < 6) return false;
                        break;
                }
            }
            return true;
        });
        return filtered;
    }

    function applyStudioFilters(studios) {
        let filtered = studios.filter((studio) => {
            if (filterState.alphabet) {
                const firstLetter = studio.name?.charAt(0).toUpperCase();
                if (firstLetter !== filterState.alphabet) return false;
            }
            if (filterState.sceneCount) {
                const sceneCount = studio.scene_count || 0;
                switch (filterState.sceneCount) {
                    case '1-5':
                        if (sceneCount < 1 || sceneCount > 5) return false;
                        break;
                    case '6-20':
                        if (sceneCount < 6 || sceneCount > 20) return false;
                        break;
                    case '21-plus':
                        if (sceneCount < 21) return false;
                        break;
                }
            }
            return true;
        });
        return filtered;
    }

    function applySceneSorting(scenes) {
        return scenes.sort((a, b) => {
            switch (filterState.sortBy) {
                case 'name-asc':
                    return (a.title || '').localeCompare(b.title || '');
                case 'name-desc':
                    return (b.title || '').localeCompare(a.title || '');
                case 'newest':
                    return new Date(b.date || 0) - new Date(a.date || 0);
                case 'oldest':
                    return new Date(a.date || 0) - new Date(b.date || 0);
                case 'rating-desc':
                    return (b.rating100 || 0) - (a.rating100 || 0);
                case 'rating-asc':
                    return (a.rating100 || 0) - (b.rating100 || 0);
                case 'duration-desc':
                    const durationA = a.duration || a.files?.[0]?.duration || 0;
                    const durationB = b.duration || b.files?.[0]?.duration || 0;
                    return durationB - durationA;
                case 'duration-asc':
                    const durA = a.duration || a.files?.[0]?.duration || 0;
                    const durB = b.duration || b.files?.[0]?.duration || 0;
                    return durA - durB;
                case 'age-asc':
                    const ageA = StashAPI.getYoungestFemalePerformerAge(a);
                    const ageB = StashAPI.getYoungestFemalePerformerAge(b);
                    return (ageA || 99) - (ageB || 99);
                case 'age-desc':
                    const ageA2 = StashAPI.getYoungestFemalePerformerAge(a);
                    const ageB2 = StashAPI.getYoungestFemalePerformerAge(b);
                    return (ageB2 || 0) - (ageA2 || 0);
                case 'random':
                    return Math.random() - 0.5;
                default:
                    return (a.title || '').localeCompare(b.title || '');
            }
        });
    }

    function applyPerformerSorting(performers) {
        return performers.sort((a, b) => {
            const ageA = a.birthdate ? calculateAge(a.birthdate) : null;
            const ageB = b.birthdate ? calculateAge(b.birthdate) : null;

            switch (filterState.sortBy) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'scenes-desc':
                    return (b.scene_count || 0) - (a.scene_count || 0);
                case 'scenes-asc':
                    return (a.scene_count || 0) - (b.scene_count || 0);
                case 'age-asc':
                    return (ageA || 99) - (ageB || 99);
                case 'age-desc':
                    return (ageB || 0) - (ageA || 0);
                case 'recent-scenes':
                    // For now, use scene count as proxy for recent activity
                    return (b.scene_count || 0) - (a.scene_count || 0);
                default:
                    return (a.name || '').localeCompare(b.name || '');
            }
        });
    }

    function applyStudioSorting(studios) {
        return studios.sort((a, b) => {
            switch (filterState.sortBy) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'scenes-desc':
                    return (b.scene_count || 0) - (a.scene_count || 0);
                case 'scenes-asc':
                    return (a.scene_count || 0) - (b.scene_count || 0);
                case 'newest':
                    return (b.scene_count || 0) - (a.scene_count || 0);
                case 'oldest':
                    return (a.scene_count || 0) - (b.scene_count || 0);
                case 'performer-count':
                    // This would need additional data, using scene count as proxy
                    return (b.scene_count || 0) - (a.scene_count || 0);
                default:
                    return (a.name || '').localeCompare(b.name || '');
            }
        });
    }

    async function calculatePerformerStudioCounts() {
        try {
            if (!dataCache.performers) {
                dataCache.performers = await StashAPI.getAllPerformers();
            }
            if (!dataCache.scenes) {
                dataCache.scenes = await StashAPI.getAllScenes();
            }

            dataCache.performers.forEach((performer) => {
                performer.studioScenes = {};
            });

            dataCache.scenes.forEach((scene) => {
                if (scene.studio?.name && scene.performers) {
                    scene.performers.forEach((performer) => {
                        const perf = dataCache.performers.find((p) => p.name === performer.name);
                        if (perf) {
                            perf.studioScenes[scene.studio.name] =
                                (perf.studioScenes[scene.studio.name] || 0) + 1;
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error calculating performer studio counts:', error);
        }
    }

    function initializeApp() {
        initHeaderState();
        window.addEventListener('scroll', handleHeaderScroll);

        // Parallax scroll movement for ambient background
        window.addEventListener('scroll', () => {
            if (!ambientVideo) return;
            ambientVideo.style.transform = `translateY(${window.scrollY * 0.15}px)`;
        });

        setupConsistentBackBehavior();
        enhanceImageLoading();

        toggleImageBlur(isBlurEnabled);

        initializeHeroCarousel();
        initAmbientBackground();
        initializeCarousels();

        if (domCache.homeBtn) {
            domCache.homeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                animateTransition(() => {
                    if (window.currentRequestController) window.currentRequestController.abort();
                    if (domCache.videoPlayer && !domCache.videoPlayer.paused) {
                        domCache.videoPlayer.pause();
                        domCache.videoPlayer.currentTime = 0;
                    }
                    if (domCache.searchInput) domCache.searchInput.value = '';
                    domCache.sceneDetailContainer.style.display = 'none';
                    domCache.performerDetailContainer.style.display = 'none';
                    domCache.studioDetailContainer.style.display = 'none';
                    dataCache.lastUpdated = null;
                    currentMode = 'home';
                    currentQuery = '';
                    paginationState.scenes = { page: 1, total: 0, mode: '' };
                    filterState.alphabet = '';
                    filterState.ageRange = '';
                    filterState.sceneCount = '';
                    filterState.sortBy = 'name-asc';
                    filterState.ratingRange = '';
                    filterState.durationRange = '';
                    filterState.performerCount = '';
                    filterState.tags = [];
                    filterState.dateRange = { start: '', end: '' };
                    const filterUI = document.querySelector('.filter-sort-container');
                    if (filterUI) filterUI.remove();
                    const quickFilters = document.querySelector('.quick-filters');
                    if (quickFilters) quickFilters.remove();
                    if (domCache.scenesGrid) domCache.scenesGrid.innerHTML = '';
                    if (domCache.scenesCarousel) domCache.scenesCarousel.style.display = 'none';
                    document.querySelector('.dashboard-container').style.display = 'block';
                    toggleHeroCarousel(true);
                    updateNavigationState('home');
                    const existingPagination = document.querySelector('.pagination-container');
                    if (existingPagination) existingPagination.remove();
                    showDefaultContent();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => {
                        refreshDashboard().catch((error) =>
                            console.warn('Dashboard refresh had minor issues:', error)
                        );
                    }, 100);
                    console.log('Navigation: Home - State reset complete');
                });
            });
        }

        if (domCache.moviesBtn)
            domCache.moviesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                animateTransition(() => navigateToListView('movies'));
            });
        if (domCache.performersBtn)
            domCache.performersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                animateTransition(() => navigateToListView('performers'));
            });
        if (domCache.studiosBtn)
            domCache.studiosBtn.addEventListener('click', (e) => {
                e.preventDefault();
                animateTransition(() => navigateToListView('studios'));
            });

        setTimeout(async () => {
            try {
                const [studios, performers] = await Promise.all([
                    StashAPI.getAllStudios(),
                    StashAPI.getAllPerformersWithImages(),
                ]);

                dataCache.studios = studios;
                dataCache.performers = performers;

                console.log('Pre-loaded studio and performer data for faster browsing');
            } catch (error) {
                console.warn('Background data loading failed:', error);
            }
        }, 2000);

        setupSearch();
        setupSceneClickHandlers();
        setupBackToDashboard();
        setupProfileMenu();
        refreshDashboard();
        showDefaultContent();

        setTimeout(async () => {
            try {
                await calculatePerformerStudioCounts();
            } catch (error) {
                console.warn('Performer studio count calculation failed:', error);
            }
        }, 3000);

        // Initialize filters from URL
        initializeFiltersFromURL();
    }

    function navigateToListView(mode) {
        cleanupPreviousView();
        toggleHeroCarousel(false);
        document.querySelector('.dashboard-container').style.display = 'block';
        document.querySelector('.dashboard-container').style.paddingTop = '30px';

        if (currentMode !== mode) {
            // Reset filter state when switching modes
            filterState.alphabet = '';
            filterState.ageRange = '';
            filterState.sceneCount = '';
            filterState.sortBy = 'name-asc';
            filterState.ratingRange = '';
            filterState.durationRange = '';
            filterState.performerCount = '';
            filterState.tags = [];
            filterState.dateRange = { start: '', end: '' };
        }

        currentMode = mode;
        paginationState.scenes = { page: 1, total: 0, mode: mode };
        showListViewWithFilters(getTitleForMode(mode), mode);

        // Add quick filters for scenes
        if (mode === 'movies') {
            addQuickFilters(mode);
        }

        switch (mode) {
            case 'movies':
                refreshScenesWithFilters();
                break;
            case 'performers':
                refreshPerformersWithFilters();
                break;
            case 'studios':
                refreshStudiosWithFilters();
                break;
        }

        updateNavigationState(mode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        console.log(`Navigation: ${getTitleForMode(mode)} - Clean transition`);

        const carouselsToHide = [
            'recommended-carousel',
            'continue-watching-carousel',
            'recently-added-carousel',
            'studio-highlights-carousel',
            'top-scenes-carousel',
            'under-25-carousel',
            'bukkake-carousel',
        ];

        carouselsToHide.forEach((carouselId) => {
            const carousel = document.getElementById(carouselId);
            if (carousel) carousel.style.display = 'none';
        });
    }

    function showListViewWithFilters(title, mode) {
        if (domCache.scenesCarousel) {
            domCache.scenesCarousel.style.display = 'block';
            domCache.scenesCarousel.style.marginTop = '40px';
            domCache.scenesCarousel.style.paddingTop = '20px';
        }
        if (domCache.scenesTitle) domCache.scenesTitle.textContent = title;
        const existingFilter = document.querySelector('.filter-sort-container');
        if (existingFilter) existingFilter.remove();
        const filterPanel = createFilterPanel(mode);
        filterPanel.style.marginTop = '15px';
        domCache.scenesCarousel.insertBefore(filterPanel, domCache.scenesCarousel.firstChild);
        const allNavButtons = document.querySelectorAll('.carousel-prev, .carousel-next');
        allNavButtons.forEach((button) => (button.style.display = 'none'));
        const carousels = document.querySelectorAll('.carousel');
        carousels.forEach((carousel) => {
            if (carousel.id !== 'scenes-carousel') carousel.style.display = 'none';
        });
    }

    function addQuickFilters(mode) {
        const existingQuickFilters = document.querySelector('.quick-filters');
        if (existingQuickFilters) existingQuickFilters.remove();

        if (mode !== 'movies') return;

        const quickFilters = document.createElement('div');
        quickFilters.className = 'quick-filters';

        const quickFilterChips = [
            { label: 'Top Rated', filter: { ratingRange: '90-100', sortBy: 'rating-desc' } },
            { label: 'Recently Added', filter: { sortBy: 'newest' } },
            { label: 'Short Clips', filter: { durationRange: 'short' } },
            { label: 'Solo', filter: { performerCount: '1' } },
            { label: 'Duo', filter: { performerCount: '2' } },
            { label: 'Young Performers', filter: { sortBy: 'age-asc' } },
            { label: 'Unrated', filter: { ratingRange: 'unrated' } },
            { label: 'Long Videos', filter: { durationRange: 'long' } },
        ];

        quickFilterChips.forEach((chip) => {
            const chipElement = document.createElement('div');
            chipElement.className = 'quick-filter-chip';
            chipElement.textContent = chip.label;

            chipElement.addEventListener('click', () => {
                // Apply quick filter
                Object.assign(filterState, chip.filter);
                applyFilters(mode);

                // Update UI
                document.querySelectorAll('.quick-filter-chip').forEach((c) => {
                    c.classList.remove('active');
                });
                chipElement.classList.add('active');

                // Update filter buttons
                const filterContainer = document.querySelector('.filter-sort-container');
                if (filterContainer) {
                    // Update rating filter if set
                    if (chip.filter.ratingRange) {
                        updateFilterButtonStates(
                            filterContainer,
                            'ratingRange',
                            chip.filter.ratingRange
                        );
                    }
                    // Update duration filter if set
                    if (chip.filter.durationRange) {
                        updateFilterButtonStates(
                            filterContainer,
                            'durationRange',
                            chip.filter.durationRange
                        );
                    }
                    // Update performer count filter if set
                    if (chip.filter.performerCount) {
                        updateFilterButtonStates(
                            filterContainer,
                            'performerCount',
                            chip.filter.performerCount
                        );
                    }
                    // Update sort if set
                    if (chip.filter.sortBy) {
                        updateFilterButtonStates(filterContainer, 'sort', chip.filter.sortBy);
                    }
                }
            });

            quickFilters.appendChild(chipElement);
        });

        // Add clear quick filter
        const clearChip = document.createElement('div');
        clearChip.className = 'quick-filter-chip';
        clearChip.innerHTML = '<i class="fas fa-times"></i> Clear';
        clearChip.addEventListener('click', () => {
            clearAllFilters();
            document.querySelectorAll('.quick-filter-chip').forEach((c) => {
                c.classList.remove('active');
            });
        });
        quickFilters.appendChild(clearChip);

        // Insert after filter container
        const filterContainer = document.querySelector('.filter-sort-container');
        if (filterContainer) {
            filterContainer.insertAdjacentElement('afterend', quickFilters);
        }
    }

    function setupProfileMenu() {
        if (domCache.profileBtn && domCache.profileDropdown) {
            domCache.profileBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                domCache.profileDropdown.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (
                    !domCache.profileDropdown.contains(e.target) &&
                    e.target !== domCache.profileBtn
                ) {
                    domCache.profileDropdown.classList.remove('show');
                }
            });
            const menuItems = domCache.profileDropdown.querySelectorAll('.profile-menu-item');
            menuItems.forEach((item) => {
                item.addEventListener('click', function (e) {
                    e.preventDefault();
                    const action = this.getAttribute('data-action');
                    if (action === 'watch-history') {
                        domCache.profileDropdown.classList.remove('show');
                        openSeeAll('watch-history');
                    }
                });
            });
        }
    }

    function setupSearch() {
        const debounce = (func, wait) => {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };
        if (domCache.searchInput) {
            domCache.searchInput.addEventListener(
                'input',
                debounce(function (e) {
                    const query = e.target.value.trim();
                    if (query.length === 0) {
                        showDefaultContent();
                        return;
                    }
                    currentMode = 'search';
                    currentQuery = query;
                    paginationState.scenes = { page: 1, total: 0, mode: 'search' };
                    searchScenes(query);
                }, DEBOUNCE_DELAY)
            );
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        document.body.appendChild(errorDiv);
        setTimeout(() => {
            errorDiv.classList.add('fade-out');
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
    }

    function createSceneItem(scene, options = {}) {
        const item = document.createElement('div');
        item.className = 'carousel-item scene-item';
        item.dataset.sceneId = scene.id;

        item.innerHTML = '<div class="skeleton-card"></div>';

        setTimeout(() => {
            loadSceneItemContent(item, scene, options);
        }, 50);

        return item;
    }

    async function loadSceneItemContent(item, scene, options) {
        item.innerHTML = '';

        const imgElement = document.createElement('img');
        imgElement.className = 'carousel-image scene-poster';
        if (isBlurEnabled) imgElement.classList.add('blurred-image');
        imgElement.alt = scene.title || 'Scene';

        let progressHtml = '';
        if (scene.progress !== undefined && scene.duration) {
            const progressPercent = (scene.progress / scene.duration) * 100;
            progressHtml = `<div class="scene-progress-bar"><div class="scene-progress" style="width: ${progressPercent}%"></div></div>`;
        }

        let leftBadgeHtml = '';
        if (options.leftBadge) {
            let badgeClass = 'left-badge ';
            let badgeContent = '';

            switch (options.leftBadge.type) {
                case 'age':
                    badgeClass += 'age-badge';
                    badgeContent = `${options.leftBadge.value}`;
                    break;
                case 'rating':
                    badgeClass += 'rating-badge';
                    badgeContent = `<i class="fas fa-star"></i> ${options.leftBadge.value}`;
                    break;
                case 'performer':
                    badgeClass += 'performer-name-badge';
                    badgeContent = options.leftBadge.value || 'N/A';
                    break;
            }

            leftBadgeHtml = `<div class="${badgeClass}">${badgeContent}</div>`;
        }

        let studioBadge = '';
        if (scene.studio?.name && options.showStudioBadge !== false) {
            const studioName =
                scene.studio.name.length > 8
                    ? scene.studio.name.substring(0, 6) + '...'
                    : scene.studio.name;
            studioBadge = `<div class="premium-badge" title="${scene.studio.name}">${studioName}</div>`;
        }

        let durationHtml = '';
        const duration = scene.duration || scene.files?.[0]?.duration;
        if (duration) {
            const minutes = Math.floor(duration / 60);
            if (minutes > 0) {
                durationHtml = `<div class="duration-badge"><i class="fas fa-clock"></i> ${minutes}m</div>`;
            }
        }

        const hoverInfo = document.createElement('div');
        hoverInfo.className = 'hover-info';
        const performersList =
            scene.performers && scene.performers.length > 0
                ? scene.performers
                      .map((p) => p.name)
                      .slice(0, 2)
                      .join(', ') + (scene.performers.length > 2 ? '...' : '')
                : 'No performers';

        let durationText = '';
        if (duration) {
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            durationText = `<span><i class="fas fa-clock"></i> ${minutes}:${seconds
                .toString()
                .padStart(2, '0')}</span>`;
        }

        let ageText = '';
        if (options.leftBadge?.type === 'age') {
            ageText = `<span><i class="fas fa-user"></i> ${options.leftBadge.value} years</span>`;
        }

        hoverInfo.innerHTML = `
            <div class="hover-title">${scene.title || 'Unknown'}</div>
            <div class="hover-details">${truncateWords(
                scene.details || 'No description available',
                15
            )}</div>
            <div class="hover-meta">
                <span><i class="fas fa-star"></i> ${scene.rating100 || 'NR'}</span>
                <span><i class="fas fa-building"></i> ${
                    scene.studio?.name || 'Unknown Studio'
                }</span>
                <span><i class="fas fa-users"></i> ${performersList}</span>
                ${durationText}
                ${ageText}
            </div>
        `;

        item.innerHTML = `
            ${progressHtml}
            ${durationHtml}
            ${leftBadgeHtml}
            ${studioBadge}
        `;

        item.insertBefore(imgElement, item.firstChild);
        item.appendChild(hoverInfo);

        if (scene.screenshot || scene.paths?.screenshot) {
            loadSceneImage(
                { ...scene, screenshot: scene.screenshot || scene.paths?.screenshot },
                imgElement
            );
        } else {
            imgElement.src = 'scene-placeholder.jpg';
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        }
    }

    function createPerformerItem(performer) {
        const item = document.createElement('div');
        item.className = 'carousel-item performer-item';
        item.dataset.performerName = performer.name;

        item.innerHTML = '<div class="skeleton-card"></div>';

        setTimeout(() => {
            loadPerformerItemContent(item, performer);
        }, 50);

        return item;
    }

    async function loadPerformerItemContent(item, performer) {
        item.innerHTML = '';

        const imgElement = document.createElement('img');
        imgElement.className = 'carousel-image';
        if (isBlurEnabled) imgElement.classList.add('blurred-image');
        imgElement.alt = performer.name || 'Performer';

        const currentAge = performer.birthdate ? calculateAge(performer.birthdate) : null;

        let ageBadge = null;
        if (currentAge) {
            ageBadge = document.createElement('div');
            ageBadge.className = 'left-badge performer-name-badge';
            ageBadge.textContent = `${currentAge}`;
            ageBadge.title = `Age: ${currentAge} years`;
        }

        let sceneCountBadge = null;
        if (performer.scene_count > 0) {
            sceneCountBadge = document.createElement('div');
            sceneCountBadge.className = 'studio-scene-count';
            sceneCountBadge.textContent = `${performer.scene_count}`;
            sceneCountBadge.title = `${performer.scene_count} scenes`;
        }

        const hoverInfo = document.createElement('div');
        hoverInfo.className = 'hover-info';
        hoverInfo.innerHTML = `
            <div class="hover-title">${performer.name || 'Unknown'}</div>
            <div class="hover-details">${truncateWords(
                performer.details || 'No biography available',
                15
            )}</div>
            <div class="hover-meta">
                <span><i class="fas fa-film"></i> ${performer.scene_count || '0'} scenes</span>
                ${
                    currentAge
                        ? `<span><i class="fas fa-birthday-cake"></i> ${currentAge} years</span>`
                        : ''
                }
            </div>
        `;

        item.innerHTML = '';
        item.insertBefore(imgElement, item.firstChild);

        if (ageBadge) {
            item.insertBefore(ageBadge, imgElement.nextSibling);
        }

        if (sceneCountBadge) {
            const insertAfter = ageBadge || imgElement;
            item.insertBefore(sceneCountBadge, insertAfter.nextSibling);
        }

        item.appendChild(hoverInfo);

        loadPerformerImage(performer, imgElement);
    }

    function createStudioItem(studio) {
        const item = document.createElement('div');
        item.className = 'carousel-item studio-item';
        item.dataset.studioName = studio.name;

        item.innerHTML = '<div class="skeleton-card"></div>';

        setTimeout(() => {
            loadStudioItemContent(item, studio);
        }, 100);

        return item;
    }

    async function loadStudioItemContent(item, studio) {
        item.innerHTML = '';

        const imgElement = document.createElement('img');
        imgElement.className = 'carousel-image';
        if (isBlurEnabled) imgElement.classList.add('blurred-image');
        imgElement.alt = studio.name || 'Studio';

        let topPerformer = studio.topPerformer;

        let performerBadge = null;
        if (topPerformer?.name) {
            const performerName =
                topPerformer.name.length > 8
                    ? topPerformer.name.substring(0, 6) + '...'
                    : topPerformer.name;
            performerBadge = document.createElement('div');
            performerBadge.className = 'left-badge performer-name-badge';
            performerBadge.textContent = performerName;
            performerBadge.title = `Top Performer: ${topPerformer.name}`;
        }

        let performerSceneBadge = null;
        if (topPerformer?.sceneCount) {
            performerSceneBadge = document.createElement('div');
            performerSceneBadge.className = 'premium-badge';
            performerSceneBadge.textContent = `${topPerformer.sceneCount}`;
            performerSceneBadge.title = `${topPerformer.name} has ${topPerformer.sceneCount} scenes for ${studio.name}`;
        } else if (topPerformer?.studioScenes?.[studio.name]) {
            const sceneCount = topPerformer.studioScenes[studio.name];
            performerSceneBadge = document.createElement('div');
            performerSceneBadge.className = 'premium-badge';
            performerSceneBadge.textContent = `${sceneCount}`;
            performerSceneBadge.title = `${topPerformer.name} has ${sceneCount} scenes for ${studio.name}`;
        }

        let studioSceneBadge = null;
        if (studio.scene_count) {
            studioSceneBadge = document.createElement('div');
            studioSceneBadge.className = 'studio-scene-count';
            studioSceneBadge.textContent = `${studio.scene_count}`;
            studioSceneBadge.title = `${studio.name} has ${studio.scene_count} total scenes`;
        }

        const hoverInfo = document.createElement('div');
        hoverInfo.className = 'hover-info';
        let hoverDetails = `${studio.scene_count || '0'} scenes in library`;
        if (topPerformer?.name) {
            const sceneCount = topPerformer.sceneCount || topPerformer.studioScenes?.[studio.name];
            hoverDetails += `<br>Top Performer: ${topPerformer.name}`;
            if (sceneCount) {
                hoverDetails += ` (${sceneCount} scenes)`;
            }
        }

        hoverInfo.innerHTML = `
            <div class="hover-title">${studio.name || 'Unknown Studio'}</div>
            <div class="hover-details">${hoverDetails}</div>
        `;

        item.innerHTML = '';
        item.insertBefore(imgElement, item.firstChild);

        if (performerBadge) {
            item.insertBefore(performerBadge, imgElement.nextSibling);
        }

        if (performerSceneBadge) {
            const insertAfter = performerBadge || imgElement;
            item.insertBefore(performerSceneBadge, insertAfter.nextSibling);
        }

        if (studioSceneBadge) {
            const insertAfter = performerSceneBadge || performerBadge || imgElement;
            item.insertBefore(studioSceneBadge, insertAfter.nextSibling);
        }

        item.appendChild(hoverInfo);

        if (topPerformer?.imagePath) {
            const performerForImage = {
                name: topPerformer.name,
                image_path: topPerformer.imagePath,
            };

            imgElement.onerror = () => {
                if (studio.image_path) {
                    loadStudioImage(studio, imgElement);
                } else {
                    imgElement.src = 'studio-placeholder.jpg';
                    if (isBlurEnabled) imgElement.classList.add('blurred-image');
                }
            };

            loadPerformerImage(performerForImage, imgElement);
        } else if (studio.image_path) {
            loadStudioImage(studio, imgElement);
        } else {
            imgElement.src = 'studio-placeholder.jpg';
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        }
    }

    function calculateAge(birthdate) {
        try {
            const currentDate = new Date();
            const birthDate = new Date(birthdate);
            let age = currentDate.getFullYear() - birthDate.getFullYear();
            if (
                currentDate.getMonth() < birthDate.getMonth() ||
                (currentDate.getMonth() === birthDate.getMonth() &&
                    currentDate.getDate() < birthDate.getDate())
            )
                age--;
            return age;
        } catch (e) {
            console.error('Error calculating age:', e);
            return null;
        }
    }

    function getTitleForMode(mode) {
        switch (mode) {
            case 'movies':
                return 'Movies';
            case 'performers':
                return 'Performers';
            case 'studios':
                return 'Studios';
            case 'search':
                return `Search Results for "${currentQuery}"`;
            default:
                return 'Content';
        }
    }

    async function refreshTopScenes() {
        try {
            const scenes = await StashAPI.getTopRatedScenes();
            const topScenesGrid = document.getElementById('top-scenes-grid');
            topScenesGrid.innerHTML = '';
            scenes?.forEach((scene) => {
                const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
                const options = {
                    leftBadge: youngestAge
                        ? {
                              type: 'age',
                              value: youngestAge,
                          }
                        : {
                              type: 'rating',
                              value: scene.rating100 || 'NR',
                          },
                    showStudioBadge: true,
                };
                topScenesGrid.appendChild(createSceneItem(scene, options));
            });
            if (!scenes || scenes.length === 0) {
                topScenesGrid.innerHTML =
                    '<div class="empty-state"><i class="fas fa-star"></i><h3>No top rated scenes</h3><p>Rate some scenes to see them here</p></div>';
            }
        } catch (error) {
            logError('Error refreshing top scenes', error);
            showError('Failed to load top scenes. Please try again.');
            document.getElementById('top-scenes-grid').innerHTML =
                '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading scenes</h3><p>Please try again later</p></div>';
        }
    }

    async function refreshUnder25Scenes() {
        try {
            const under25Scenes = await StashAPI.getScenesWithPerformersUnder25();
            updateUnder25Scenes(under25Scenes);
        } catch (error) {
            logError('Error refreshing under 25 scenes', error);
            showError('Failed to load under 25 scenes. Please try again.');
            if (document.getElementById('under-25-grid'))
                document.getElementById('under-25-grid').innerHTML =
                    '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading scenes</h3><p>Please try again later</p></div>';
        }
    }

    function updateUnder25Scenes(scenes) {
        const under25Grid = document.getElementById('under-25-grid');
        if (!under25Grid) return;
        under25Grid.innerHTML = '';
        scenes.forEach((scene) => {
            const options = {
                leftBadge: {
                    type: 'age',
                    value: scene.youngestAge || 'N/A',
                },
                showStudioBadge: true,
            };
            under25Grid.appendChild(createSceneItem(scene, options));
        });
        if (!scenes || scenes.length === 0) {
            under25Grid.innerHTML =
                '<div class="empty-state"><i class="fas fa-user-clock"></i><h3>No scenes available</h3><p>No scenes with performers under 25</p></div>';
        }
    }

    async function refreshBukkakeScenes() {
        try {
            const result = await StashAPI.searchScenes('Bukkake');
            const scenes = result.scenes || [];
            updateBukkakeScenes(scenes);
        } catch (error) {
            logError('Error refreshing Bukkake scenes', error);
            showError('Failed to load Bukkake scenes. Please try again.');
            if (document.getElementById('bukkake-grid'))
                document.getElementById('bukkake-grid').innerHTML =
                    '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading scenes</h3><p>Please try again later</p></div>';
        }
    }

    function updateBukkakeScenes(scenes) {
        const bukkakeGrid = document.getElementById('bukkake-grid');
        if (!bukkakeGrid) return;
        bukkakeGrid.innerHTML = '';
        scenes.forEach((scene) => {
            const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
            const options = {
                leftBadge: youngestAge
                    ? {
                          type: 'age',
                          value: youngestAge,
                      }
                    : null,
                showStudioBadge: true,
            };
            bukkakeGrid.appendChild(createSceneItem(scene, options));
        });
        if (!scenes || scenes.length === 0) {
            bukkakeGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-tag"></i><h3>No Bukkake scenes</h3><p>No scenes in this category</p></div>';
        }
    }

    async function getWatchHistoryScenes() {
        try {
            const allKeys = Object.keys(localStorage);
            const watchedScenes = [];
            for (const key of allKeys) {
                if (key.startsWith('lastWatched_')) {
                    const sceneId = key.replace('lastWatched_', '');
                    const lastWatched = localStorage.getItem(key);
                    const progressKey = `videoProgress_${sceneId}`;
                    const progress = localStorage.getItem(progressKey);
                    try {
                        const sceneDetails = await StashAPI.getSceneById(sceneId);
                        const duration = sceneDetails.files?.[0]?.duration || 0;
                        watchedScenes.push({
                            ...sceneDetails,
                            progress: parseFloat(progress || 0),
                            duration: duration,
                            lastWatched: parseInt(lastWatched),
                        });
                    } catch (error) {
                        localStorage.removeItem(key);
                        localStorage.removeItem(progressKey);
                    }
                }
            }
            return watchedScenes.sort((a, b) => b.lastWatched - a.lastWatched);
        } catch (error) {
            logError('Error getting watch history', error);
            return [];
        }
    }

    async function refreshRecommendedScenes() {
        try {
            const recommendedScenes = await StashAPI.getRecommendedScenes();
            const processedScenes = recommendedScenes.map((scene) => {
                const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
                return {
                    ...scene,
                    youngestAge: youngestAge,
                };
            });
            updateRecommendedScenes(processedScenes);
        } catch (error) {
            logError('Error refreshing recommended scenes', error);
            if (document.getElementById('recommended-grid'))
                document.getElementById('recommended-grid').innerHTML = '';
        }
    }

    function updateRecommendedScenes(scenes) {
        const recommendedGrid = document.getElementById('recommended-grid');
        if (!recommendedGrid) return;
        recommendedGrid.innerHTML = '';
        scenes.forEach((scene) => {
            const options = {
                leftBadge: scene.youngestAge
                    ? {
                          type: 'age',
                          value: scene.youngestAge,
                      }
                    : null,
                showStudioBadge: true,
            };
            recommendedGrid.appendChild(createSceneItem(scene, options));
        });
        if (!scenes || scenes.length === 0) {
            document.getElementById('recommended-carousel').style.display = 'none';
        } else {
            document.getElementById('recommended-carousel').style.display = 'block';
        }
    }

    async function searchScenes(query) {
        if (!query.trim()) {
            showDefaultContent();
            return;
        }
        try {
            const sceneResults = await StashAPI.searchScenes(
                query,
                paginationState.scenes.page,
                SEARCH_PER_PAGE
            );
            if (sceneResults.scenes.length > 0) {
                showListViewWithFilters(`Search Results for "${query}"`, 'search');
                const scenesWithPerformers = sceneResults.scenes.map((scene) => ({
                    ...scene,
                    performers: scene.performers || [],
                }));
                updateScenes(scenesWithPerformers, 'search', sceneResults.total);
            } else {
                domCache.scenesGrid.innerHTML =
                    '<div class="empty-state"><i class="fas fa-search"></i><h3>No results found</h3><p>Try different search terms</p></div>';
                showListViewWithFilters('No Results', 'search');
            }
        } catch (error) {
            logError('Error during search', error);
            showError('Search failed. Please try again.');
        }
    }

    async function getContinueWatchingScenes() {
        try {
            const allScenes = await StashAPI.getAllScenes();
            const continueWatchingScenes = [];
            const allKeys = Object.keys(localStorage);
            const progressKeys = allKeys.filter((key) => key.startsWith('videoProgress_'));
            for (const key of progressKeys) {
                const sceneId = key.replace('videoProgress_', '');
                const savedProgress = localStorage.getItem(key);
                const lastWatched = localStorage.getItem(`lastWatched_${sceneId}`);
                const scene = allScenes.find((s) => s.id === sceneId);
                if (scene) {
                    try {
                        const sceneDetails = await StashAPI.getSceneById(sceneId);
                        let duration = 0;
                        if (
                            sceneDetails.files &&
                            sceneDetails.files[0] &&
                            sceneDetails.files[0].duration
                        )
                            duration = sceneDetails.files[0].duration;
                        else if (sceneDetails.duration) duration = sceneDetails.duration;
                        else if (scene.duration) duration = scene.duration;
                        else if (sceneDetails.file && sceneDetails.file.duration)
                            duration = sceneDetails.file.duration;
                        else if (scene.file && scene.file.duration) duration = scene.file.duration;
                        if (duration <= 0) duration = 1800;
                        const progressPercent = (parseFloat(savedProgress) / duration) * 100;
                        if (parseFloat(savedProgress) >= 1 && progressPercent < 95)
                            continueWatchingScenes.push({
                                ...scene,
                                progress: parseFloat(savedProgress),
                                duration: duration,
                                lastWatched: parseInt(lastWatched || 0),
                            });
                    } catch (error) {}
                }
            }
            const sortedScenes = continueWatchingScenes.sort(
                (a, b) => (b.lastWatched || 0) - (a.lastWatched || 0)
            );
            return sortedScenes;
        } catch (error) {
            logError('Error getting continue watching scenes', error);
            return [];
        }
    }

    async function updateContinueWatchingScenes(scenes) {
        const continueWatchingGrid = document.getElementById('continue-watching-grid');
        const continueWatchingCarousel = document.getElementById('continue-watching-carousel');
        if (!continueWatchingGrid) return;
        continueWatchingGrid.innerHTML = '';
        scenes.forEach((scene) => {
            const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
            const options = {
                leftBadge: youngestAge
                    ? {
                          type: 'age',
                          value: youngestAge,
                      }
                    : null,
                showStudioBadge: true,
            };
            continueWatchingGrid.appendChild(createSceneItem(scene, options));
        });
        if (!scenes || scenes.length === 0) {
            continueWatchingGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-history"></i><h3>Nothing to continue</h3><p>Start watching some scenes</p></div>';
            if (continueWatchingCarousel) {
                continueWatchingCarousel.style.display = 'none';
                continueWatchingCarousel.classList.remove('home-visible');
            }
        } else {
            if (continueWatchingCarousel) {
                continueWatchingCarousel.style.display = 'block';
                continueWatchingCarousel.classList.add('home-visible');
            }
        }
    }

    async function refreshRecentlyAddedScenes() {
        try {
            const allScenes = await StashAPI.getAllScenes();
            const recentlyAdded = allScenes
                .filter((scene) => scene.date)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 20);

            const processedScenes = recentlyAdded.map((scene) => {
                const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
                return {
                    ...scene,
                    youngestAge: youngestAge,
                };
            });

            updateRecentlyAddedScenes(processedScenes);
        } catch (error) {
            logError('Error refreshing recently added scenes', error);
        }
    }

    function updateRecentlyAddedScenes(scenes) {
        const recentlyAddedGrid = document.getElementById('recently-added-grid');
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';
        scenes.forEach((scene) => {
            const options = {
                leftBadge: scene.youngestAge
                    ? {
                          type: 'age',
                          value: scene.youngestAge,
                      }
                    : null,
                showStudioBadge: true,
            };
            recentlyAddedGrid.appendChild(createSceneItem(scene, options));
        });
        if (!scenes || scenes.length === 0) {
            recentlyAddedGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-clock"></i><h3>No recent scenes</h3><p>Add scenes to see them here</p></div>';
        }
    }

    async function refreshStudioHighlights() {
        try {
            if (!dataCache.studios) {
                dataCache.studios = await StashAPI.getAllStudios();
            }

            const studioTopPerformers = await StashAPI.getTopPerformersForAllStudios();

            const topStudios = [...dataCache.studios]
                .sort((a, b) => (b.scene_count || 0) - (a.scene_count || 0))
                .slice(0, 20)
                .map((studio) => ({
                    ...studio,
                    topPerformer: studioTopPerformers[studio.name] || null,
                }));

            updateStudioHighlights(topStudios);
        } catch (error) {
            logError('Error refreshing studio highlights', error);
        }
    }

    function updateStudioHighlights(studios) {
        const studioHighlightsGrid = document.getElementById('studio-highlights-grid');
        if (!studioHighlightsGrid) return;
        studioHighlightsGrid.innerHTML = '';

        studios.forEach((studio) => {
            studioHighlightsGrid.appendChild(createStudioItem(studio));
        });

        if (!studios || studios.length === 0) {
            studioHighlightsGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-building"></i><h3>No studios</h3><p>No studios available</p></div>';
        }
    }

    async function refreshDashboard() {
        try {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'flex';
            await Promise.all([
                StashAPI.getSceneCounts(),
                StashAPI.getEntityCounts(),
                StashAPI.getRatingCounts(),
                StashAPI.getSceneDurations(),
            ]);

            dataCache.scenes = await StashAPI.getTopRatedScenes();
            dataCache.lastUpdated = Date.now();

            await Promise.all([
                refreshTopScenes(),
                refreshUnder25Scenes(),
                refreshBukkakeScenes(),
                refreshRecentlyAddedScenes(),
                refreshStudioHighlights(),
            ]);

            const continueWatchingScenes = await getContinueWatchingScenes();
            updateContinueWatchingScenes(continueWatchingScenes);
            await refreshRecommendedScenes();
        } catch (error) {
            logError('Error refreshing dashboard', error);
            showError('Failed to load dashboard data. Please try again.');
        } finally {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'none';
        }
    }

    function updatePerformers(performers, totalPerformers) {
        if (!domCache.scenesGrid) return;
        domCache.scenesGrid.innerHTML = '';

        domCache.scenesGrid.style.display = 'grid';
        domCache.scenesGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        domCache.scenesGrid.style.gap = '15px';
        domCache.scenesGrid.style.height = 'auto';

        performers.forEach((performer) => {
            if (performer.scene_count > 0)
                domCache.scenesGrid.appendChild(createPerformerItem(performer));
        });

        if (domCache.scenesGrid.children.length === 0) {
            domCache.scenesGrid.style.display = 'block';
            domCache.scenesGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-user-slash"></i><h3>No performers</h3><p>No performers with scenes available</p></div>';
        }

        updatePaginationControls('performers', totalPerformers);
    }

    function updateStudios(studios, totalStudios) {
        if (!domCache.scenesGrid) return;
        domCache.scenesGrid.innerHTML = '';

        domCache.scenesGrid.style.display = 'grid';
        domCache.scenesGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        domCache.scenesGrid.style.gap = '15px';
        domCache.scenesGrid.style.height = 'auto';

        studios.forEach((studio) => {
            if (studio.scene_count > 0) domCache.scenesGrid.appendChild(createStudioItem(studio));
        });

        if (domCache.scenesGrid.children.length === 0) {
            domCache.scenesGrid.style.display = 'block';
            domCache.scenesGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-building"></i><h3>No studios</h3><p>No studios with scenes available</p></div>';
        }

        updatePaginationControls('studios', totalStudios);
    }

    function updateScenes(scenes, mode, totalScenes) {
        if (!domCache.scenesGrid) return;
        domCache.scenesGrid.innerHTML = '';

        domCache.scenesGrid.style.display = 'grid';
        domCache.scenesGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        domCache.scenesGrid.style.gap = '15px';
        domCache.scenesGrid.style.height = 'auto';

        scenes.forEach((scene) => {
            const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);

            const options = {
                leftBadge: youngestAge
                    ? {
                          type: 'age',
                          value: youngestAge,
                      }
                    : null,
                showStudioBadge: true,
            };
            domCache.scenesGrid.appendChild(createSceneItem(scene, options));
        });

        if (!scenes || scenes.length === 0) {
            domCache.scenesGrid.style.display = 'block';
            domCache.scenesGrid.innerHTML =
                '<div class="empty-state"><i class="fas fa-film"></i><h3>No scenes</h3><p>No scenes available in this category</p></div>';
        }

        updatePaginationControls(mode, totalScenes);
    }

    function openSeeAll(mode) {
        currentSeeAllMode = mode;
        paginationState.scenes.page = 1;
        showListViewWithFilters('', mode);
        refreshSeeAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function refreshSeeAll() {
        const page = paginationState.scenes.page || 1;
        const perPage = SCENES_PER_PAGE;
        const start = (page - 1) * perPage;
        const end = start + perPage;
        if (!domCache.scenesTitle) return;
        let items = [];
        let title = '';
        try {
            switch (currentSeeAllMode) {
                case 'top-scenes':
                    title = 'Top Rated Scenes';
                    items = await StashAPI.getTopRatedScenes(500);
                    break;
                case 'under-25':
                    title = 'Under 25';
                    items = await StashAPI.getScenesWithPerformersUnder25();
                    break;
                case 'bukkake':
                    title = 'Bukkake';
                    const result = await StashAPI.searchScenes('Bukkake', 1, 500);
                    items = result.scenes || [];
                    break;
                case 'continue-watching':
                    title = 'Continue Watching';
                    items = await getWatchHistoryScenes();
                    break;
                case 'recommended':
                    title = 'Recommended For You';
                    items = await StashAPI.getRecommendedScenes(100);
                    break;
                case 'watch-history':
                    title = 'Watch History';
                    items = await getWatchHistoryScenes();
                    break;
                case 'recently-added':
                    title = 'Recently Added';
                    const allScenes = await StashAPI.getAllScenes();
                    items = allScenes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                    break;
                case 'studio-highlights':
                    title = 'Studio Highlights';
                    if (!dataCache.studios) dataCache.studios = await StashAPI.getAllStudios();
                    items = dataCache.studios;
                    break;
                default:
                    title = 'Items';
            }
        } catch (e) {
            items = [];
        }
        const total = items.length;
        const pageItems = items.slice(start, end);
        domCache.scenesTitle.textContent = title;
        domCache.scenesGrid.innerHTML = '';
        const frag = document.createDocumentFragment();
        pageItems.forEach((scene) => {
            if (currentSeeAllMode === 'under-25') {
                const options = {
                    leftBadge: {
                        type: 'age',
                        value: scene.youngestAge || 'N/A',
                    },
                    showStudioBadge: true,
                };
                frag.appendChild(createSceneItem(scene, options));
            } else if (currentSeeAllMode === 'studio-highlights') {
                frag.appendChild(createStudioItem(scene));
            } else {
                const options = {
                    leftBadge: null,
                    showStudioBadge: true,
                };
                frag.appendChild(createSceneItem(scene, options));
            }
        });
        domCache.scenesGrid.appendChild(frag);
        updatePaginationControls('see-all', total);
    }

    function updatePaginationControls(mode, totalItems) {
        const existingPagination = document.querySelector('.pagination-container');
        if (existingPagination) existingPagination.remove();

        let itemsPerPage = SCENES_PER_PAGE;
        switch (mode) {
            case 'performers':
                itemsPerPage = PERFORMERS_PER_PAGE;
                break;
            case 'studios':
                itemsPerPage = STUDIOS_PER_PAGE;
                break;
            case 'search':
                itemsPerPage = SEARCH_PER_PAGE;
                break;
            case 'see-all':
                itemsPerPage = SCENES_PER_PAGE;
                break;
            default:
                itemsPerPage = SCENES_PER_PAGE;
        }

        if (totalItems <= itemsPerPage) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const pagination = domCache.paginationContainer.cloneNode();
        pagination.innerHTML = '';

        function handlePageChange(newPage) {
            paginationState.scenes.page = newPage;
            if (currentSeeAllMode) refreshSeeAll();
            else if (mode === 'performers') refreshPerformersWithFilters();
            else if (mode === 'studios') refreshStudiosWithFilters();
            else if (mode === 'search') searchScenes(currentQuery);
            else refreshScenesWithFilters();
        }

        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-button';
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.disabled = paginationState.scenes.page === 1;
        prevButton.addEventListener('click', () =>
            handlePageChange(paginationState.scenes.page - 1)
        );
        pagination.appendChild(prevButton);

        const maxVisiblePages = 5;
        let startPage = Math.max(1, paginationState.scenes.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        if (endPage - startPage + 1 < maxVisiblePages)
            startPage = Math.max(1, endPage - maxVisiblePages + 1);

        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.className = 'pagination-button';
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', () => handlePageChange(1));
            pagination.appendChild(firstPageButton);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-button ${
                i === paginationState.scenes.page ? 'active' : ''
            }`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => handlePageChange(i));
            pagination.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            }
            const lastPageButton = document.createElement('button');
            lastPageButton.className = 'pagination-button';
            lastPageButton.textContent = totalPages;
            lastPageButton.addEventListener('click', () => handlePageChange(totalPages));
            pagination.appendChild(lastPageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-button';
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.disabled = paginationState.scenes.page === totalPages;
        nextButton.addEventListener('click', () =>
            handlePageChange(paginationState.scenes.page + 1)
        );
        pagination.appendChild(nextButton);

        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `Page ${paginationState.scenes.page} of ${totalPages} • ${totalItems} items`;
        pagination.appendChild(pageInfo);

        domCache.scenesCarousel.insertAdjacentElement('afterend', pagination);
    }

    function setupSceneClickHandlers() {
        document.addEventListener('click', function (e) {
            const sceneItem = e.target.closest('.scene-item');
            if (sceneItem) {
                e.preventDefault();
                const sceneId = sceneItem.dataset.sceneId;
                if (sceneId) animateTransition(() => openSceneDetail(sceneId));
                return;
            }
            const performerItem = e.target.closest('.performer-item');
            if (
                performerItem &&
                performerItem.parentElement === domCache.scenesGrid &&
                currentMode === 'performers'
            ) {
                e.preventDefault();
                const performerName = performerItem.dataset.performerName;
                if (performerName) animateTransition(() => openPerformerDetail(performerName));
                return;
            }
            const studioItem = e.target.closest('.studio-item');
            if (
                studioItem &&
                studioItem.parentElement === domCache.scenesGrid &&
                currentMode === 'studios'
            ) {
                e.preventDefault();
                const studioName = studioItem.dataset.studioName;
                if (studioName) animateTransition(() => openStudioDetail(studioName));
                return;
            }
        });
    }

    async function openPerformerDetail(performerName) {
        try {
            toggleHeroCarousel(false);
            if (!dataCache.performers) {
                dataCache.performers = await StashAPI.getAllPerformers();
            }
            const performer = dataCache.performers.find((p) => p.name === performerName);
            if (!performer) {
                showError('Performer not found');
                return;
            }
            domCache.sceneDetailContainer.style.display = 'none';
            domCache.performerDetailContainer.style.display = 'block';
            domCache.studioDetailContainer.style.display = 'none';
            document.querySelector('.dashboard-container').style.display = 'none';
            document.getElementById('performer-detail-name').textContent = performer.name;
            document.getElementById('performer-detail-age').textContent = performer.birthdate
                ? calculateAge(performer.birthdate)
                : 'Unknown';
            document.getElementById('performer-detail-scene-count').textContent =
                performer.scene_count || 'Unknown';
            document.getElementById('performer-detail-gender').textContent =
                performer.gender || 'Unknown';
            document.getElementById('performer-detail-birthdate').textContent =
                performer.birthdate || 'Unknown';
            document.getElementById('performer-detail-bio').textContent =
                performer.details || 'No biography available.';
            const performerImage = document.getElementById('performer-detail-image');
            loadPerformerImage(performer, performerImage);
            await loadPerformerScenes(performer.id);
        } catch (error) {
            logError('Error loading performer details', error);
            showError('Failed to load performer details. Please try again.');
        }
    }

    async function loadPerformerScenes(performerId) {
        try {
            const allScenes = await StashAPI.getAllScenes();
            const performerScenes = allScenes.filter(
                (scene) => scene.performers && scene.performers.some((p) => p.id === performerId)
            );
            const scenesGrid = document.getElementById('performer-scenes-grid');
            scenesGrid.innerHTML = '';
            if (performerScenes.length === 0) {
                scenesGrid.innerHTML =
                    '<div class="empty-state"><i class="fas fa-film"></i><h3>No scenes</h3><p>No scenes found for this performer</p></div>';
                return;
            }
            performerScenes.forEach((scene) => {
                const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
                const options = {
                    leftBadge: youngestAge
                        ? {
                              type: 'age',
                              value: youngestAge,
                          }
                        : null,
                    showStudioBadge: true,
                };
                scenesGrid.appendChild(createSceneItem(scene, options));
            });
        } catch (error) {
            logError('Error loading performer scenes', error);
            document.getElementById('performer-scenes-grid').innerHTML =
                '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading scenes</h3><p>Please try again later</p></div>';
        }
    }

    async function openStudioDetail(studioName) {
        try {
            toggleHeroCarousel(false);
            if (!dataCache.studios) {
                dataCache.studios = await StashAPI.getAllStudios();
            }
            const studio = dataCache.studios.find((s) => s.name === studioName);
            if (!studio) {
                showError('Studio not found');
                return;
            }
            domCache.sceneDetailContainer.style.display = 'none';
            domCache.performerDetailContainer.style.display = 'none';
            domCache.studioDetailContainer.style.display = 'block';
            document.querySelector('.dashboard-container').style.display = 'none';
            document.getElementById('studio-detail-name').textContent = studio.name;
            document.getElementById('studio-detail-scene-count').textContent =
                studio.scene_count || 'Unknown';
            const studioImage = document.getElementById('studio-detail-image');
            loadStudioImage(studio, studioImage);
            await loadStudioScenes(studio.name);
        } catch (error) {
            logError('Error loading studio details', error);
            showError('Failed to load studio details. Please try again.');
        }
    }

    async function loadStudioScenes(studioName) {
        try {
            const allScenes = await StashAPI.getAllScenes();
            const studioScenes = allScenes.filter(
                (scene) => scene.studio && scene.studio.name === studioName
            );
            const scenesGrid = document.getElementById('studio-scenes-grid');
            scenesGrid.innerHTML = '';
            if (studioScenes.length === 0) {
                scenesGrid.innerHTML =
                    '<div class="empty-state"><i class="fas fa-film"></i><h3>No scenes</h3><p>No scenes found for this studio</p></div>';
                return;
            }
            studioScenes.forEach((scene) => {
                const youngestAge = StashAPI.getYoungestFemalePerformerAge(scene);
                const options = {
                    leftBadge: youngestAge
                        ? {
                              type: 'age',
                              value: youngestAge,
                          }
                        : null,
                    showStudioBadge: true,
                };
                scenesGrid.appendChild(createSceneItem(scene, options));
            });
        } catch (error) {
            logError('Error loading studio scenes', error);
            document.getElementById('studio-scenes-grid').innerHTML =
                '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading scenes</h3><p>Please try again later</p></div>';
        }
    }

    async function showScenesByTag(tagName) {
        currentMode = 'search';
        currentQuery = tagName;
        paginationState.scenes = { page: 1, total: 0, mode: 'search' };
        await searchScenes(tagName);
        domCache.sceneDetailContainer.style.display = 'none';
        domCache.performerDetailContainer.style.display = 'none';
        domCache.studioDetailContainer.style.display = 'none';
        document.querySelector('.dashboard-container').style.display = 'block';
    }

    async function openSceneDetail(sceneId) {
        try {
            toggleHeroCarousel(false);
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'flex';
            document.querySelector('.dashboard-container').style.display = 'none';
            domCache.sceneDetailContainer.style.display = 'block';
            domCache.performerDetailContainer.style.display = 'none';
            domCache.studioDetailContainer.style.display = 'none';
            const sceneDetails = await StashAPI.getSceneById(sceneId);
            domCache.sceneDetailTitle.textContent = sceneDetails.title || 'Untitled Scene';
            domCache.sceneDetailRating.textContent = sceneDetails.rating100
                ? `${sceneDetails.rating100}/100`
                : 'Not rated';
            // Sync stars with current rating
            const stars = document.querySelectorAll('#scene-rating-stars i');
            stars.forEach((star) => {
                const value = parseInt(star.dataset.value, 10);
                star.classList.toggle(
                    'active',
                    sceneDetails.rating100 && value <= sceneDetails.rating100
                );
            });

            const ratingInput = document.getElementById('scene-rating-input');

            if (ratingInput) {
                // Populate input with current rating (without /100)
                ratingInput.value = sceneDetails.rating100 ?? '';
                ratingInput.dataset.sceneId = sceneDetails.id;

                // Clear previous listener (prevents duplicates)
                ratingInput.onchange = null;

                ratingInput.onchange = async function () {
                    const newRating = parseInt(this.value, 10);

                    if (isNaN(newRating) || newRating < 0 || newRating > 100) {
                        alert('Rating must be between 0 and 100');
                        this.value = sceneDetails.rating100 ?? '';
                        return;
                    }

                    try {
                        await StashAPI.updateSceneRating(sceneDetails.id, newRating);

                        // Update rating text immediately
                        domCache.sceneDetailRating.textContent = `${newRating}/100`;
                        // Update star UI
                        document.querySelectorAll('#scene-rating-stars i').forEach((star) => {
                            const value = parseInt(star.dataset.value, 10);
                            star.classList.toggle('active', value <= newRating);
                        });

                        console.log('[StashVault] Rating updated:', newRating);
                    } catch (err) {
                        console.error('Failed to update rating', err);
                        alert('Failed to update rating in Stash');

                        // Revert on failure
                        this.value = sceneDetails.rating100 ?? '';
                    }
                };

                const starsContainer = document.getElementById('scene-rating-stars');

                if (starsContainer) {
                    const stars = starsContainer.querySelectorAll('i');

                    stars.forEach((star) => {
                        star.onclick = () => {
                            const value = parseInt(star.dataset.value, 10);

                            // Set hidden input value
                            ratingInput.value = value;

                            // Trigger existing change logic
                            ratingInput.dispatchEvent(new Event('change'));
                        };
                    });
                }
            }

            domCache.sceneDetailStudio.textContent = sceneDetails.studio?.name || 'Unknown studio';
            domCache.sceneDetailDate.textContent = sceneDetails.date || 'Unknown date';
            const performersContainer = document.getElementById('scene-detail-performers');
            performersContainer.innerHTML = '';
            if (sceneDetails.performers && sceneDetails.performers.length > 0) {
                sceneDetails.performers.forEach((performer) => {
                    const chip = document.createElement('div');
                    chip.className = 'performer-chip';
                    chip.innerHTML = `<i class="fas fa-user"></i>${performer.name}`;
                    chip.addEventListener('click', () =>
                        animateTransition(() => openPerformerDetail(performer.name))
                    );
                    performersContainer.appendChild(chip);
                });
            } else performersContainer.innerHTML = '<span class="meta-value">No performers</span>';
            domCache.sceneDetailDescription.textContent =
                sceneDetails.description || sceneDetails.details || 'No description available';
            const tagsContainer = document.getElementById('scene-detail-tags');
            tagsContainer.innerHTML = '';
            if (sceneDetails.tags && sceneDetails.tags.length > 0) {
                sceneDetails.tags.forEach((tag) => {
                    const tagElement = document.createElement('div');
                    tagElement.className = 'scene-tag';
                    tagElement.innerHTML = `<i class="fas fa-tag"></i>${tag}`;
                    tagElement.addEventListener('click', () =>
                        animateTransition(() => showScenesByTag(tag))
                    );
                    tagsContainer.appendChild(tagElement);
                });
            } else tagsContainer.innerHTML = '<span class="meta-value">No tags</span>';
            let videoUrl = '';
            if (sceneDetails.stream) {
                if (sceneDetails.stream.startsWith('http://localhost:9999'))
                    videoUrl = sceneDetails.stream;
                else videoUrl = `http://localhost:9999${sceneDetails.stream}`;
            } else if (sceneDetails.file) videoUrl = `http://localhost:9999${sceneDetails.file}`;
            if (videoUrl) setupVideoPlayer(videoUrl, sceneDetails.id);
            else showError('No playable video found for this scene');
        } catch (error) {
            logError('Error loading scene details', error);
            showError('Failed to load scene details. Please try again.');
            document.querySelector('.dashboard-container').style.display = 'block';
            domCache.sceneDetailContainer.style.display = 'none';
        } finally {
            if (domCache.globalLoader) domCache.globalLoader.style.display = 'none';
        }
    }

    function setupVideoPlayer(videoUrl, sceneId) {
        try {
            domCache.videoPlayer.src = '';
            domCache.videoPlayer.load();
            domCache.progressBar.value = 0;
            domCache.timeDisplay.textContent = '00:00 / 00:00';
            domCache.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            domCache.volumeControl.value = 1;
            domCache.videoPlayer.volume = 1;
            updateVolumeIcon();
            domCache.videoPlayer.setAttribute('crossorigin', 'anonymous');
            domCache.videoPlayer.src = videoUrl;
            domCache.videoPlayer.load();
            const savedProgress = localStorage.getItem(`videoProgress_${sceneId}`);
            if (savedProgress) {
                domCache.videoPlayer.currentTime = parseFloat(savedProgress);
                domCache.progressBar.value =
                    (domCache.videoPlayer.currentTime / domCache.videoPlayer.duration) * 100 || 0;
            }
            domCache.videoPlayer.addEventListener('loadedmetadata', updateTimeDisplay);
            domCache.videoPlayer.addEventListener('timeupdate', function () {
                updateTimeDisplay();
                saveVideoProgress(sceneId);
            });
            domCache.videoPlayer.addEventListener(
                'play',
                () => (domCache.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>')
            );
            domCache.videoPlayer.addEventListener(
                'pause',
                () => (domCache.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>')
            );
            domCache.videoPlayer.addEventListener('ended', function () {
                domCache.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                localStorage.removeItem(`videoProgress_${sceneId}`);
                localStorage.removeItem(`lastWatched_${sceneId}`);
            });
            domCache.videoPlayer.addEventListener('error', function () {
                const error = domCache.videoPlayer.error;
                let message = 'Video playback error: ';
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED:
                        message += 'Playback was aborted';
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        message +=
                            'Network error occurred. Check server connectivity or CORS settings.';
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        message += 'Error during decoding. The video may be corrupted.';
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        message += 'Video format not supported or URL is invalid. URL: ' + videoUrl;
                        break;
                    default:
                        message += 'Unknown error occurred';
                }
                showError(message);
            });
            domCache.playPauseBtn.addEventListener('click', function () {
                if (domCache.videoPlayer.paused)
                    domCache.videoPlayer
                        .play()
                        .catch((e) => showError('Failed to play video: ' + e.message));
                else domCache.videoPlayer.pause();
            });
            domCache.progressBar.addEventListener('input', function () {
                const seekTime = domCache.videoPlayer.duration * (this.value / 100);
                domCache.videoPlayer.currentTime = seekTime;
            });
            domCache.volumeControl.addEventListener('input', function () {
                domCache.videoPlayer.volume = this.value;
                updateVolumeIcon();
            });
            domCache.muteBtn.addEventListener('click', function () {
                if (domCache.videoPlayer.volume > 0) {
                    domCache.videoPlayer.volume = 0;
                    domCache.volumeControl.value = 0;
                } else {
                    domCache.videoPlayer.volume = 1;
                    domCache.volumeControl.value = 1;
                }
                updateVolumeIcon();
            });
            domCache.fullscreenBtn.addEventListener('click', function () {
                if (!document.fullscreenElement)
                    domCache.videoPlayer
                        .requestFullscreen()
                        .catch((err) =>
                            showError(`Error attempting to enable fullscreen: ${err.message}`)
                        );
                else document.exitFullscreen();
            });
            const backButton = document.createElement('button');
            backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
            backButton.title = 'Back to previous page';
            backButton.style.marginRight = '10px';
            backButton.addEventListener('click', () =>
                animateTransition(() => handleBackToDashboard())
            );
            const playerControls = document.querySelector('.player-controls');
            if (playerControls) playerControls.insertBefore(backButton, playerControls.firstChild);
            document.addEventListener('keydown', function (e) {
                if (
                    document.activeElement === domCache.videoPlayer ||
                    document.activeElement === domCache.progressBar
                ) {
                    switch (e.key) {
                        case ' ':
                            e.preventDefault();
                            if (domCache.videoPlayer.paused) domCache.videoPlayer.play();
                            else domCache.videoPlayer.pause();
                            break;
                        case 'ArrowRight':
                            domCache.videoPlayer.currentTime += 5;
                            break;
                        case 'ArrowLeft':
                            domCache.videoPlayer.currentTime -= 5;
                            break;
                        case 'ArrowUp':
                            domCache.videoPlayer.volume = Math.min(
                                1,
                                domCache.videoPlayer.volume + 0.1
                            );
                            domCache.volumeControl.value = domCache.videoPlayer.volume;
                            updateVolumeIcon();
                            break;
                        case 'ArrowDown':
                            domCache.videoPlayer.volume = Math.max(
                                0,
                                domCache.videoPlayer.volume - 0.1
                            );
                            domCache.volumeControl.value = domCache.videoPlayer.volume;
                            updateVolumeIcon();
                            break;
                        case 'f':
                            if (!document.fullscreenElement)
                                domCache.videoPlayer.requestFullscreen();
                            break;
                        case 'm':
                            if (domCache.videoPlayer.volume > 0) {
                                domCache.videoPlayer.volume = 0;
                                domCache.volumeControl.value = 0;
                            } else {
                                domCache.videoPlayer.volume = 1;
                                domCache.volumeControl.value = 1;
                            }
                            updateVolumeIcon();
                            break;
                    }
                }
            });
            updateVolumeIcon();
            const playPromise = domCache.videoPlayer.play();
            if (playPromise !== undefined)
                playPromise.catch((error) => (domCache.playPauseBtn.style.display = 'block'));
        } catch (error) {
            logError('Error setting up video player', error);
            showError('Failed to initialize video player. Please try again.');
        }
    }

    function updateTimeDisplay() {
        const currentTime = formatTime(domCache.videoPlayer.currentTime);
        const duration = formatTime(domCache.videoPlayer.duration);
        domCache.timeDisplay.textContent = `${currentTime} / ${duration}`;
        const progress = (domCache.videoPlayer.currentTime / domCache.videoPlayer.duration) * 100;
        domCache.progressBar.value = progress || 0;
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function saveVideoProgress(sceneId) {
        if (sceneId && domCache.videoPlayer.currentTime >= 1) {
            localStorage.setItem(
                `videoProgress_${sceneId}`,
                domCache.videoPlayer.currentTime.toString()
            );
            localStorage.setItem(`lastWatched_${sceneId}`, Date.now().toString());
        }
    }

    function updateVolumeIcon() {
        if (domCache.videoPlayer.volume === 0)
            domCache.muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        else if (domCache.videoPlayer.volume < 0.5)
            domCache.muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        else domCache.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }

    function setupBackToDashboard() {
        if (domCache.backToDashboardBtn)
            domCache.backToDashboardBtn.addEventListener('click', function (e) {
                e.preventDefault();
                animateTransition(() => handleBackToDashboard());
            });
        const performerBackBtn = document.querySelector(
            '#performer-detail-container .back-to-dashboard'
        );
        if (performerBackBtn)
            performerBackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                animateTransition(() => handleBackToDashboard());
            });
        const studioBackBtn = document.querySelector('#studio-detail-container .back-to-dashboard');
        if (studioBackBtn)
            studioBackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                animateTransition(() => handleBackToDashboard());
            });
    }

    function handleBackToDashboard() {
        if (domCache.videoPlayer) {
            domCache.videoPlayer.pause();
            domCache.videoPlayer.currentTime = 0;
            domCache.videoPlayer.src = '';
        }
        domCache.sceneDetailContainer.style.display = 'none';
        domCache.performerDetailContainer.style.display = 'none';
        domCache.studioDetailContainer.style.display = 'none';
        document.querySelector('.dashboard-container').style.display = 'block';
        toggleHeroCarousel(true);
        showDefaultContent();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        console.log('Navigation: Back to Dashboard');
    }

    async function loadPerformerImage(performer, imgElement) {
        try {
            if (!performer.image_path) {
                showFallbackImage(imgElement, performer.name);
                return;
            }

            let imageUrl = performer.image_path;

            if (!imageUrl.startsWith('http')) {
                if (imageUrl.startsWith('/')) {
                    imageUrl = imageUrl.substring(1);
                }
                imageUrl = `http://localhost:9999/${imageUrl}`;
            }

            console.log('Loading performer image from:', imageUrl);

            const response = await fetch(imageUrl, {
                credentials: 'same-origin',
                headers: { ApiKey: StashAPI.headers.ApiKey },
                mode: 'cors',
            });

            if (response.ok) {
                const blob = await response.blob();
                imgElement.src = URL.createObjectURL(blob);
                console.log('Performer image loaded successfully');
            } else {
                console.warn('Fetch failed, trying direct URL');
                imgElement.crossOrigin = 'anonymous';
                imgElement.src = `${imageUrl}?t=${Date.now()}`;
                imgElement.onerror = () => {
                    console.warn('Direct URL failed, showing fallback');
                    showFallbackImage(imgElement, performer.name);
                };
            }

            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        } catch (error) {
            console.error('Error loading performer image:', error);
            showFallbackImage(imgElement, performer.name);
        }
    }

    async function loadStudioImage(studio, imgElement) {
        try {
            let imageUrl =
                studio.image_path && studio.image_path.startsWith('http')
                    ? studio.image_path
                    : `http://localhost:9999${
                          studio.image_path && studio.image_path.startsWith('/') ? '' : '/'
                      }${studio.image_path || ''}`;
            const response = await fetch(imageUrl, {
                credentials: 'same-origin',
                headers: { ApiKey: StashAPI.headers.ApiKey },
            });
            if (response.ok) {
                const blob = await response.blob();
                imgElement.src = URL.createObjectURL(blob);
            } else {
                imgElement.crossOrigin = 'anonymous';
                imgElement.src = `${imageUrl}?t=${Date.now()}`;
                imgElement.onerror = () => {
                    imgElement.src = 'studio-placeholder.jpg';
                    if (isBlurEnabled) imgElement.classList.add('blurred-image');
                };
            }
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        } catch (error) {
            imgElement.src = 'studio-placeholder.jpg';
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        }
    }

    async function loadSceneImage(scene, imgElement) {
        try {
            if (!scene.screenshot) {
                imgElement.src = 'scene-placeholder.jpg';
                if (isBlurEnabled) imgElement.classList.add('blurred-image');
                return;
            }
            let imageUrl = scene.screenshot.startsWith('http')
                ? scene.screenshot
                : `http://localhost:9999${scene.screenshot.startsWith('/') ? '' : '/'}${
                      scene.screenshot
                  }`;
            const response = await fetch(imageUrl, {
                credentials: 'same-origin',
                headers: { ApiKey: StashAPI.headers.ApiKey },
            });
            if (response.ok) {
                const blob = await response.blob();
                imgElement.src = URL.createObjectURL(blob);
            } else {
                imgElement.crossOrigin = 'anonymous';
                imgElement.src = `${imageUrl}?t=${Date.now()}`;
                imgElement.onerror = () => {
                    imgElement.src = 'scene-placeholder.jpg';
                    if (isBlurEnabled) imgElement.classList.add('blurred-image');
                };
            }
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        } catch (error) {
            imgElement.src = 'scene-placeholder.jpg';
            if (isBlurEnabled) imgElement.classList.add('blurred-image');
        }
    }

    function showFallbackImage(imgElement, name) {
        imgElement.src = 'fallback.jpg';
        imgElement.alt = `${name || 'Performer'} (fallback)`;
        if (isBlurEnabled) imgElement.classList.add('blurred-image');
    }

    function showDefaultContent() {
        console.log('Showing default content - cleaning up previous state');
        if (window.currentRequestController) window.currentRequestController.abort();
        toggleHeroCarousel(true);
        const filterUI = document.querySelector('.filter-sort-container');
        if (filterUI) filterUI.remove();
        const quickFilters = document.querySelector('.quick-filters');
        if (quickFilters) quickFilters.remove();
        if (domCache.scenesCarousel) {
            domCache.scenesCarousel.style.display = 'none';
            domCache.scenesCarousel.style.marginTop = '0';
            domCache.scenesCarousel.style.paddingTop = '0';
        }
        if (domCache.scenesGrid) domCache.scenesGrid.innerHTML = '';
        const allNavButtons = document.querySelectorAll('.carousel-prev, .carousel-next');
        allNavButtons.forEach((button) => (button.style.display = 'block'));
        const carousels = document.querySelectorAll('.carousel');
        carousels.forEach((carousel) => {
            if (carousel.id !== 'scenes-carousel') carousel.style.display = 'block';
            else carousel.style.display = 'none';
        });
        const continueWatchingItems = document
            .getElementById('continue-watching-grid')
            .querySelectorAll('.carousel-item');
        const continueWatchingCarousel = document.getElementById('continue-watching-carousel');
        if (continueWatchingItems.length > 0) {
            if (continueWatchingCarousel) {
                continueWatchingCarousel.style.display = 'block';
                continueWatchingCarousel.classList.add('home-visible');
            }
        } else {
            if (continueWatchingCarousel) {
                continueWatchingCarousel.style.display = 'none';
                continueWatchingCarousel.classList.remove('home-visible');
            }
        }
        if (domCache.scenesTitle) domCache.scenesTitle.textContent = 'Scenes';
        paginationState.scenes.page = 1;
        currentMode = 'home';
        currentQuery = '';
        const existingPagination = document.querySelector('.pagination-container');
        if (existingPagination) existingPagination.remove();
        document.body.offsetHeight;

        if (currentMode === 'performers' || currentMode === 'studios' || currentMode === 'movies') {
            const recommendedCarousel = document.getElementById('recommended-carousel');
            const continueWatchingCarousel = document.getElementById('continue-watching-carousel');
            const recentlyAddedCarousel = document.getElementById('recently-added-carousel');
            const studioHighlightsCarousel = document.getElementById('studio-highlights-carousel');
            const topScenesCarousel = document.getElementById('top-scenes-carousel');
            const under25Carousel = document.getElementById('under-25-carousel');
            const bukkakeCarousel = document.getElementById('bukkake-carousel');

            if (recommendedCarousel) recommendedCarousel.style.display = 'none';
            if (continueWatchingCarousel) continueWatchingCarousel.style.display = 'none';
            if (recentlyAddedCarousel) recentlyAddedCarousel.style.display = 'none';
            if (studioHighlightsCarousel) studioHighlightsCarousel.style.display = 'none';
            if (topScenesCarousel) topScenesCarousel.style.display = 'none';
            if (under25Carousel) under25Carousel.style.display = 'none';
            if (bukkakeCarousel) bukkakeCarousel.style.display = 'none';
        }
    }

    document.querySelectorAll('.see-all-link[data-mode]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const mode = el.getAttribute('data-mode');
            animateTransition(() => openSeeAll(mode));
        });
    });

    function updateNavigationState(currentView) {
        const navItems = document.querySelectorAll('.prime-nav-item');
        navItems.forEach((item) => item.classList.remove('active'));
        let activeNavItem = null;
        switch (currentView) {
            case 'home':
                activeNavItem = document.querySelector('.home-btn');
                break;
            case 'movies':
                activeNavItem = document.querySelector('.movies-btn');
                break;
            case 'performers':
                activeNavItem = document.querySelector('.performers-btn');
                break;
            case 'studios':
                activeNavItem = document.querySelector('.studios-btn');
                break;
        }
        if (activeNavItem) activeNavItem.classList.add('active');
    }

    // Tag cloud functionality
    async function initializeTagCloud() {
        try {
            const query = `query {
                findTags {
                    tags {
                        name
                        scene_count
                    }
                }
            }`;
            const data = await StashAPI.runQuery(query);
            const tags = data.findTags.tags || [];

            const tagCloud = document.getElementById('tag-cloud');
            if (!tagCloud) return;

            tagCloud.innerHTML = '';

            // Sort by scene count
            tags.sort((a, b) => (b.scene_count || 0) - (a.scene_count || 0));

            // Take top 50 tags
            const topTags = tags.slice(0, 50);

            topTags.forEach((tag) => {
                const tagElement = document.createElement('button');
                tagElement.className = 'tag-cloud-item';
                tagElement.textContent = tag.name;
                tagElement.dataset.tagName = tag.name;
                tagElement.title = `${tag.scene_count || 0} scenes`;

                // Size based on scene count
                const sceneCount = tag.scene_count || 0;
                let fontSize = '12px';
                if (sceneCount > 50) fontSize = '14px';
                if (sceneCount > 100) fontSize = '16px';
                if (sceneCount > 200) fontSize = '18px';

                tagElement.style.fontSize = fontSize;
                tagElement.style.opacity = sceneCount > 50 ? '1' : '0.7';

                // Check if tag is selected
                if (filterState.tags.includes(tag.name)) {
                    tagElement.classList.add('active');
                }

                tagElement.addEventListener('click', () => {
                    toggleTagFilter(tag.name);
                    tagElement.classList.toggle('active');
                });

                tagCloud.appendChild(tagElement);
            });

            // Tag search
            const tagSearch = document.getElementById('tag-search');
            if (tagSearch) {
                tagSearch.addEventListener('input', function (e) {
                    const searchTerm = e.target.value.toLowerCase();
                    const tagItems = tagCloud.querySelectorAll('.tag-cloud-item');

                    tagItems.forEach((item) => {
                        const tagName = item.dataset.tagName.toLowerCase();
                        if (tagName.includes(searchTerm)) {
                            item.style.display = 'inline-block';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    function toggleTagFilter(tagName) {
        if (!filterState.tags) filterState.tags = [];

        const index = filterState.tags.indexOf(tagName);
        if (index > -1) {
            // Remove tag
            filterState.tags.splice(index, 1);
        } else {
            // Add tag
            filterState.tags.push(tagName);
        }

        updateSelectedTagsDisplay();
        applyFilters(currentMode);
    }

    function updateSelectedTagsDisplay() {
        const selectedTagsContainer = document.getElementById('selected-tags');
        if (!selectedTagsContainer) return;

        selectedTagsContainer.innerHTML = '';

        filterState.tags.forEach((tag) => {
            const tagElement = document.createElement('div');
            tagElement.className = 'selected-tag';
            tagElement.innerHTML = `
                ${tag}
                <button class="remove-tag" data-tag="${tag}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            selectedTagsContainer.appendChild(tagElement);
        });

        // Add event listeners to remove buttons
        const removeButtons = selectedTagsContainer.querySelectorAll('.remove-tag');
        removeButtons.forEach((button) => {
            button.addEventListener('click', function () {
                const tagToRemove = this.dataset.tag;
                toggleTagFilter(tagToRemove);
            });
        });
    }

    // Filter count display
    function updateFilterCount() {
        let activeFilters = 0;

        // Count active filters
        if (filterState.alphabet) activeFilters++;
        if (filterState.ageRange) activeFilters++;
        if (filterState.sceneCount) activeFilters++;
        if (filterState.ratingRange) activeFilters++;
        if (filterState.durationRange) activeFilters++;
        if (filterState.performerCount) activeFilters++;
        if (filterState.dateRange.start || filterState.dateRange.end) activeFilters++;
        if (filterState.tags && filterState.tags.length > 0) activeFilters++;

        // Update filter header badge
        const filterHeader = document.querySelector('.filter-header h3');
        if (filterHeader) {
            const existingBadge = filterHeader.querySelector('.filter-count-badge');
            if (existingBadge) existingBadge.remove();

            if (activeFilters > 0) {
                const badge = document.createElement('span');
                badge.className = 'filter-count-badge';
                badge.textContent = `${activeFilters} active`;
                badge.style.marginLeft = '10px';
                badge.style.background = 'var(--accent-color)';
                badge.style.color = 'white';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '10px';
                badge.style.fontSize = '12px';
                badge.style.fontWeight = '600';
                filterHeader.appendChild(badge);
            }
        }
    }

    // URL handling for filters
    function initializeFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('filter')) {
            const filterParam = urlParams.get('filter');
            try {
                const savedFilters = JSON.parse(decodeURIComponent(filterParam));
                Object.assign(filterState, savedFilters);

                // If we have URL filters and we're on a list view, apply them
                if (urlParams.has('view')) {
                    const view = urlParams.get('view');
                    if (view === 'movies' || view === 'performers' || view === 'studios') {
                        currentMode = view;
                        setTimeout(() => {
                            navigateToListView(view);
                        }, 100);
                    }
                }
            } catch (e) {
                console.error('Error parsing filter params:', e);
            }
        }
    }

    function updateURLWithFilters() {
        const urlParams = new URLSearchParams();

        // Only save if we have active filters and we're in a list view
        const hasActiveFilters = Object.values(filterState).some((value) => {
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object' && value !== null) {
                return Object.values(value).some((v) => v && v.toString().trim() !== '');
            }
            return value && value.toString().trim() !== '' && value !== 'name-asc';
        });

        if (hasActiveFilters && currentMode && currentMode !== 'home') {
            urlParams.set('view', currentMode);
            urlParams.set('filter', encodeURIComponent(JSON.stringify(filterState)));

            const newURL = `${window.location.pathname}?${urlParams.toString()}`;
            window.history.replaceState({}, '', newURL);
        } else if (currentMode && currentMode !== 'home') {
            // Just set the view without filters
            urlParams.set('view', currentMode);
            const newURL = `${window.location.pathname}?${urlParams.toString()}`;
            window.history.replaceState({}, '', newURL);
        } else {
            // Clear params for home
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    async function initAmbientBackground() {
        ambientVideo = document.getElementById('ambient-video');
        if (!ambientVideo) return;

        try {
            const scenes = await StashAPI.getAllScenes();
            ambientScenes = scenes
                .filter((s) => s.stream)
                .sort(() => Math.random() - 0.5)
                .slice(0, 6);

            if (ambientScenes.length > 0) {
                playAmbientScene(0);
            }
        } catch (err) {
            console.warn('Ambient background failed to load', err);
        }
    }

    function playAmbientScene(index) {
        const scene = ambientScenes[index];
        if (!scene || !ambientVideo) return;

        const src = scene.stream.startsWith('http')
            ? scene.stream
            : `http://localhost:9999${scene.stream}`;

        ambientVideo.src = src;
        ambientVideo.muted = true;
        ambientVideo.loop = false;
        ambientVideo.playbackRate = 1.5;

        ambientVideo.onloadedmetadata = () => {
            const randomStart = Math.random() * 30 + 20;
            ambientVideo.currentTime = Math.min(randomStart, ambientVideo.duration - 5);
            ambientVideo.play().catch(() => {});
        };
    }

    function rotateAmbientScene() {
        if (ambientScenes.length === 0) return;
        ambientIndex = (ambientIndex + 1) % ambientScenes.length;
        playAmbientScene(ambientIndex);
    }

    initializeApp();
});
