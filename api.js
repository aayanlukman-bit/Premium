// api.js - Complete version with enhanced filter functionality

const StashAPI = {
    init: function (url, apiKey) {
        this.url = url;
        this.headers = {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            this.headers['ApiKey'] = apiKey;
        }
    },

    toTitleCase: function (str) {
        if (!str || typeof str !== 'string') return '';

        const lowercaseWords = [
            'a',
            'an',
            'the',
            'and',
            'but',
            'or',
            'for',
            'nor',
            'on',
            'at',
            'to',
            'by',
            'from',
            'with',
            'in',
            'of',
            'as',
        ];

        const uppercaseWords = ['ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi'];

        return str
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
                if (!word) return '';

                if (uppercaseWords.includes(word.toLowerCase())) {
                    return word.toUpperCase();
                }

                if (index > 0 && lowercaseWords.includes(word.toLowerCase())) {
                    return word.toLowerCase();
                }

                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ')
            .trim();
    },

    async runQuery(query, variables) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ query, variables: variables || {} }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error: ${response.status} - ${errorText}`);
            }

            const jsonResponse = await response.json();

            if (!jsonResponse.data) {
                throw new Error('No data returned in GraphQL response');
            }

            return jsonResponse.data;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    async getSceneCounts() {
        const query = `query { findScenes { count } }`;
        const data = await this.runQuery(query);
        return { total: data.findScenes.count };
    },

    async getEntityCounts() {
        const query = `query {
            findTags { count }
            findStudios { count }
            findPerformers { count }
        }`;
        const data = await this.runQuery(query);
        return {
            tags: data.findTags.count,
            studios: data.findStudios.count,
            performers: data.findPerformers.count,
        };
    },

    async getRatingCounts() {
        let rated = 0;
        let page = 1;
        const perPage = 500;
        while (true) {
            const query = `query {
                findScenes(filter: { page: ${page}, per_page: ${perPage} }) {
                    scenes { rating100 }
                }
            }`;
            const data = await this.runQuery(query);
            const scenes = data.findScenes.scenes;
            scenes.forEach((scene) => {
                if (scene.rating100 !== null) rated++;
            });
            if (scenes.length < perPage) break;
            page++;
        }
        return { rated };
    },

    async getSceneDurations() {
        let durations = [];
        let page = 1;
        const perPage = 500;
        while (true) {
            const query = `query {
                findScenes(filter: { page: ${page}, per_page: ${perPage} }) {
                    scenes { files { duration } }
                }
            }`;
            const data = await this.runQuery(query);
            const scenes = data.findScenes.scenes;
            scenes.forEach((scene) => {
                if (scene.files?.[0]?.duration) {
                    durations.push(scene.files[0].duration);
                }
            });
            if (scenes.length < perPage) break;
            page++;
        }
        const format = (seconds) => {
            const date = new Date(0);
            date.setSeconds(seconds);
            return date.toISOString().substr(11, 8);
        };
        if (durations.length === 0) {
            return { avg: '00:00:00', min: '00:00:00', max: '00:00:00' };
        }
        const sum = durations.reduce((a, b) => a + b, 0);
        return {
            avg: format(sum / durations.length),
            min: format(Math.min(...durations)),
            max: format(Math.max(...durations)),
        };
    },

    async getTopPerformers() {
        const performerCounts = {};
        let page = 1;
        const perPage = 500;
        while (true) {
            const query = `query {
                findScenes(filter: { page: ${page}, per_page: ${perPage} }) {
                    scenes { performers { name gender } }
                }
            }`;
            const data = await this.runQuery(query);
            const scenes = data.findScenes.scenes;
            scenes.forEach((scene) => {
                scene.performers?.forEach((performer) => {
                    if (performer.gender === 'FEMALE') {
                        const name = performer.name;
                        performerCounts[name] = (performerCounts[name] || 0) + 1;
                    }
                });
            });
            if (scenes.length < perPage) break;
            page++;
        }
        return Object.entries(performerCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    },

    async getTopRatedScenes(limit = 10) {
        const query = `query {
            findScenes(filter: { sort: "rating", direction: DESC, per_page: ${limit}, page: 1 }) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                    tags { name }
                }
            }
        }`;
        const data = await this.runQuery(query);
        const scenes = data.findScenes?.scenes || [];
        return scenes.map((scene) => {
            let sceneTitle = scene.title;
            if (!sceneTitle || sceneTitle.trim() === '') {
                sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
            } else {
                sceneTitle = this.toTitleCase(sceneTitle);
            }

            return {
                id: scene.id,
                title: sceneTitle,
                rating100: scene.rating100,
                studio: scene.studio,
                performers:
                    scene.performers?.map((p) => ({
                        name: p.name,
                        gender: p.gender,
                        birthdate: p.birthdate,
                    })) || [],
                screenshot: scene.paths?.screenshot,
                file: scene.files?.[0]?.path || null,
                duration: scene.files?.[0]?.duration || 0,
                date: scene.date,
                tags: scene.tags?.map((t) => t.name) || [],
            };
        });
    },

    async getAllScenes() {
        const query = `query {
            allScenes {
                id
                title
                rating100
                studio { 
                    name 
                    id
                }
                performers { 
                    name 
                    gender
                    birthdate
                    id
                }
                files { 
                    path 
                    duration 
                    size
                }
                paths { 
                    screenshot 
                    stream
                }
                details
                date
                tags { 
                    name 
                    id
                }
            }
        }`;
        const data = await this.runQuery(query);

        return (
            data?.allScenes.map((scene) => {
                let sceneTitle = scene.title;
                if (!sceneTitle || sceneTitle.trim() === '') {
                    sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
                } else {
                    sceneTitle = this.toTitleCase(sceneTitle);
                }

                return {
                    ...scene,
                    title: sceneTitle,
                    performers:
                        scene.performers?.map((p) => ({
                            id: p.id,
                            name: p.name,
                            gender: p.gender,
                            birthdate: p.birthdate,
                        })) || [],
                    screenshot: scene.paths?.screenshot,
                    stream: scene.paths?.stream,
                    file: scene.files?.[0]?.path || null,
                    duration: scene.files?.[0]?.duration || 0,
                    tags: scene.tags?.map((t) => t.name) || [],
                };
            }) || []
        );
    },

    async searchScenes(query, page = 1, perPage = 50) {
        const searchQuery = `query($query: String!) {
            findScenes(filter: { q: $query, per_page: ${perPage}, page: ${page} }) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                    tags { name }
                }
                count
            }
        }`;
        const data = await this.runQuery(searchQuery, { query });

        return {
            scenes: data.findScenes.scenes.map((scene) => {
                let sceneTitle = scene.title;
                if (!sceneTitle || sceneTitle.trim() === '') {
                    sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
                } else {
                    sceneTitle = this.toTitleCase(sceneTitle);
                }

                return {
                    ...scene,
                    title: sceneTitle,
                    performers:
                        scene.performers?.map((p) => ({
                            name: p.name,
                            gender: p.gender,
                            birthdate: p.birthdate,
                        })) || [],
                    screenshot: scene.paths?.screenshot,
                    file: scene.files?.[0]?.path || null,
                    duration: scene.files?.[0]?.duration || 0,
                    tags: scene.tags?.map((t) => t.name) || [],
                };
            }),
            total: data.findScenes.count,
        };
    },

    async getSceneById(sceneId) {
        const query = `query($id: ID!) {
            findScene(id: $id) {
                id
                title
                date
                rating100
                studio { 
                    name 
                    id
                }
                performers { 
                    name 
                    gender
                    birthdate
                    id
                }
                tags { 
                    name 
                    id
                }
                details
                files { 
                    path 
                    size
                    duration
                }
                paths { 
                    screenshot
                    stream
                }
            }
        }`;
        const data = await this.runQuery(query, { id: sceneId });
        const s = data.findScene;

        let sceneTitle = s.title;
        if (!sceneTitle || sceneTitle.trim() === '') {
            sceneTitle = this.getTitleFromFilePath(s.files?.[0]?.path);
        } else {
            sceneTitle = this.toTitleCase(sceneTitle);
        }

        return {
            id: s.id,
            title: sceneTitle,
            date: s.date,
            rating100: s.rating100,
            studio: s.studio,
            performers:
                s.performers?.map((p) => ({
                    id: p.id,
                    name: p.name,
                    gender: p.gender,
                    birthdate: p.birthdate,
                })) || [],
            tags: s.tags?.map((t) => t.name) || [],
            description: s.details || '',
            screenshot: s.paths?.screenshot,
            file: s.files?.[0]?.path || null,
            stream: s.paths?.stream || null,
            duration: s.files?.[0]?.duration || 0,
        };
    },

    async updateSceneRating(sceneId, rating100) {
        const mutation = `
        mutation ($input: SceneUpdateInput!) {
            sceneUpdate(input: $input) {
                id
                rating100
            }
        }
    `;

        const variables = {
            input: {
                id: sceneId,
                rating100: rating100,
            },
        };

        const data = await this.runQuery(mutation, variables);
        return data.sceneUpdate;
    },

    async getScenesWithPerformersUnder25() {
        const under25Scenes = [];
        let page = 1;
        const perPage = 500;
        const currentDate = new Date();

        while (true) {
            const query = `query {
                findScenes(filter: { page: ${page}, per_page: ${perPage} }) {
                    scenes {
                        id
                        title
                        rating100
                        studio { name }
                        performers { 
                            name 
                            birthdate
                            gender
                        }
                        paths { screenshot }
                        files { path duration }
                        date
                        tags { name }
                    }
                }
            }`;

            const data = await this.runQuery(query);
            const scenes = data.findScenes.scenes;

            for (const scene of scenes) {
                if (scene.performers && scene.performers.length > 0) {
                    let youngestAge = Infinity;
                    let performerWithAge = null;

                    for (const performer of scene.performers) {
                        if (performer.gender === 'FEMALE' && performer.birthdate) {
                            try {
                                const sceneDate = scene.date ? new Date(scene.date) : currentDate;
                                const birthdate = new Date(performer.birthdate);

                                let age = sceneDate.getFullYear() - birthdate.getFullYear();

                                if (
                                    sceneDate.getMonth() < birthdate.getMonth() ||
                                    (sceneDate.getMonth() === birthdate.getMonth() &&
                                        sceneDate.getDate() < birthdate.getDate())
                                ) {
                                    age--;
                                }

                                if (age <= 25) {
                                    if (age < youngestAge) {
                                        youngestAge = age;
                                        performerWithAge = performer;
                                    }
                                }
                            } catch (e) {
                                console.error('Error calculating age:', e);
                            }
                        }
                    }

                    if (performerWithAge) {
                        let sceneTitle = scene.title;
                        if (!sceneTitle || sceneTitle.trim() === '') {
                            sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
                        } else {
                            sceneTitle = this.toTitleCase(sceneTitle);
                        }

                        under25Scenes.push({
                            ...scene,
                            title: sceneTitle,
                            performers: scene.performers.map((p) => ({
                                name: p.name,
                                gender: p.gender,
                                birthdate: p.birthdate,
                            })),
                            screenshot: scene.paths?.screenshot,
                            file: scene.files?.[0]?.path || null,
                            duration: scene.files?.[0]?.duration || 0,
                            tags: scene.tags?.map((t) => t.name) || [],
                            youngestAge: youngestAge,
                        });
                    }
                }
            }

            if (scenes.length < perPage) break;
            page++;
        }

        return under25Scenes.sort((a, b) => a.youngestAge - b.youngestAge);
    },

    async getAllPerformers() {
        const query = `query {
            allPerformers {
                id
                name
                gender
                birthdate
                image_path
                scene_count
                details
            }
        }`;
        const data = await this.runQuery(query);

        return (
            data?.allPerformers
                .filter((performer) => performer.gender === 'FEMALE' && performer.scene_count > 0)
                .sort((a, b) => a.name.localeCompare(b.name)) || []
        );
    },

    async getAllPerformersWithImages() {
        const query = `query {
            allPerformers {
                id
                name
                gender
                birthdate
                image_path
                scene_count
            }
        }`;
        const data = await this.runQuery(query);

        return (
            data?.allPerformers
                .filter((performer) => performer.gender === 'FEMALE')
                .map((performer) => ({
                    id: performer.id,
                    name: performer.name,
                    image_path: performer.image_path,
                    scene_count: performer.scene_count || 0,
                })) || []
        );
    },

    async getAllStudios() {
        const query = `query {
            allStudios {
                id
                name
                image_path
                scene_count
            }
        }`;
        const data = await this.runQuery(query);

        return (
            data?.allStudios
                .filter((studio) => studio.scene_count > 0)
                .sort((a, b) => a.name.localeCompare(b.name)) || []
        );
    },

    async getRecommendedScenes(limit = 20) {
        try {
            const allKeys = Object.keys(localStorage);
            const watchedScenes = [];

            for (const key of allKeys) {
                if (key.startsWith('lastWatched_')) {
                    const sceneId = key.replace('lastWatched_', '');
                    const lastWatched = localStorage.getItem(key);
                    const progressKey = `videoProgress_${sceneId}`;
                    const progress = localStorage.getItem(progressKey);

                    if (parseFloat(progress || 0) > 30) {
                        try {
                            const sceneDetails = await this.getSceneById(sceneId);
                            watchedScenes.push({
                                ...sceneDetails,
                                lastWatched: parseInt(lastWatched),
                                watchDuration: parseFloat(progress || 0),
                            });
                        } catch (error) {
                            console.error(
                                'Error fetching scene details for recommendations:',
                                error
                            );
                        }
                    }
                }
            }

            watchedScenes.sort((a, b) => {
                if (b.lastWatched - a.lastWatched !== 0) {
                    return b.lastWatched - a.lastWatched;
                }
                return b.watchDuration - a.watchDuration;
            });

            const allScenes = await this.getAllScenes();
            const recommendedScenes = new Map();

            const maxScenesToProcess = Math.min(5, watchedScenes.length);

            for (let i = 0; i < maxScenesToProcess; i++) {
                const watchedScene = watchedScenes[i];

                for (const scene of allScenes) {
                    if (scene.id === watchedScene.id) continue;

                    let score = recommendedScenes.get(scene.id) || 0;

                    if (watchedScene.performers && scene.performers) {
                        const commonPerformers = watchedScene.performers.filter((performer) =>
                            scene.performers.some((p) => p.name === performer.name)
                        );
                        score += commonPerformers.length * 5;
                    }

                    if (
                        watchedScene.studio &&
                        scene.studio &&
                        watchedScene.studio.name === scene.studio.name
                    ) {
                        score += 4;
                    }

                    if (watchedScene.tags && scene.tags) {
                        const commonTags = watchedScene.tags.filter((tag) =>
                            scene.tags.includes(tag)
                        );
                        score += commonTags.length * 2;
                    }

                    if (watchedScene.rating100 && scene.rating100) {
                        const ratingDiff = Math.abs(watchedScene.rating100 - scene.rating100);
                        if (ratingDiff <= 20) {
                            score += 3;
                        }
                    }

                    if (scene.date) {
                        const sceneDate = new Date(scene.date);
                        const currentDate = new Date();
                        const daysDiff = (currentDate - sceneDate) / (1000 * 60 * 60 * 24);

                        if (daysDiff < 365) {
                            score += 1;
                        }
                    }

                    if (watchedScene.watchDuration > watchedScene.duration * 0.8) {
                        score += 2;
                    }

                    recommendedScenes.set(scene.id, score);
                }
            }

            const scoredScenes = Array.from(recommendedScenes.entries())
                .map(([id, score]) => ({ id, score }))
                .sort((a, b) => b.score - a.score);

            const topSceneIds = scoredScenes.slice(0, limit).map((item) => item.id);
            const recommendedSceneDetails = [];

            for (const sceneId of topSceneIds) {
                try {
                    const sceneDetails = await this.getSceneById(sceneId);

                    let sceneTitle = sceneDetails.title;
                    if (!sceneTitle || sceneTitle.trim() === '') {
                        sceneTitle = this.getTitleFromFilePath(sceneDetails.files?.[0]?.path);
                    } else {
                        sceneTitle = this.toTitleCase(sceneTitle);
                    }

                    recommendedSceneDetails.push({
                        ...sceneDetails,
                        title: sceneTitle,
                    });
                } catch (error) {
                    console.error('Error fetching recommended scene details:', error);
                }
            }

            if (recommendedSceneDetails.length < limit) {
                try {
                    const topRated = await this.getTopRatedScenes(
                        limit - recommendedSceneDetails.length
                    );
                    for (const scene of topRated) {
                        if (!recommendedSceneDetails.some((s) => s.id === scene.id)) {
                            recommendedSceneDetails.push(scene);
                        }
                    }
                } catch (error) {
                    console.error('Error adding popular scenes as fallback:', error);
                }
            }

            return recommendedSceneDetails;
        } catch (error) {
            console.error('Error getting recommendations:', error);

            try {
                return await this.getTopRatedScenes(limit);
            } catch (fallbackError) {
                console.error('Fallback recommendation also failed:', fallbackError);
                return [];
            }
        }
    },

    getYoungestFemalePerformerAge: function (scene) {
        if (!scene.performers || scene.performers.length === 0) return null;

        const currentDate = new Date();
        const sceneDate = scene.date ? new Date(scene.date) : currentDate;
        let youngestAge = Infinity;

        for (const performer of scene.performers) {
            if (performer.gender === 'FEMALE' && performer.birthdate) {
                try {
                    const birthdate = new Date(performer.birthdate);
                    let age = sceneDate.getFullYear() - birthdate.getFullYear();

                    if (
                        sceneDate.getMonth() < birthdate.getMonth() ||
                        (sceneDate.getMonth() === birthdate.getMonth() &&
                            sceneDate.getDate() < birthdate.getDate())
                    ) {
                        age--;
                    }

                    if (age < youngestAge) {
                        youngestAge = age;
                    }
                } catch (e) {
                    console.error('Error calculating age:', e);
                }
            }
        }

        return youngestAge === Infinity ? null : youngestAge;
    },

    async getTopPerformersForAllStudios() {
        try {
            const allScenes = await this.getAllScenes();

            const allPerformers = await this.getAllPerformersWithImages();

            const performerMap = new Map();
            allPerformers.forEach((performer) => {
                performerMap.set(performer.name, performer);
            });

            const studioPerformerCounts = {};

            allScenes.forEach((scene) => {
                if (scene.studio?.name && scene.performers) {
                    const studioName = scene.studio.name;

                    if (!studioPerformerCounts[studioName]) {
                        studioPerformerCounts[studioName] = {};
                    }

                    scene.performers.forEach((performer) => {
                        const performerName = performer.name;
                        if (performer.gender === 'FEMALE' && performerName) {
                            studioPerformerCounts[studioName][performerName] =
                                (studioPerformerCounts[studioName][performerName] || 0) + 1;
                        }
                    });
                }
            });

            const studioTopPerformers = {};

            Object.keys(studioPerformerCounts).forEach((studioName) => {
                const performers = studioPerformerCounts[studioName];
                let topPerformerName = null;
                let maxScenes = 0;

                Object.keys(performers).forEach((performerName) => {
                    const count = performers[performerName];
                    if (count > maxScenes) {
                        maxScenes = count;
                        topPerformerName = performerName;
                    }
                });

                if (topPerformerName) {
                    const performer = performerMap.get(topPerformerName);
                    if (performer) {
                        studioTopPerformers[studioName] = {
                            name: performer.name,
                            imagePath: performer.image_path,
                            sceneCount: maxScenes,
                            performerId: performer.id,
                        };
                    }
                }
            });

            return studioTopPerformers;
        } catch (error) {
            console.error('Error getting top performers for all studios:', error);
            return {};
        }
    },

    getTitleFromFilePath: function (filePath) {
        if (!filePath) return 'Untitled Scene';

        const filename = filePath.split('/').pop().split('\\').pop();
        const title = filename.replace(/\.[^/.]+$/, '');

        let cleanTitle = title.replace(/[._-]/g, ' ');

        cleanTitle = cleanTitle
            .replace(/^\d+\s*[-.]?\s*/, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/\b(?:scene|clip|video|movie|part)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        cleanTitle = this.toTitleCase(cleanTitle);

        if (!cleanTitle || cleanTitle.length < 2) {
            const simpleTitle = title.replace(/[._-]/g, ' ');
            return this.toTitleCase(simpleTitle) || 'Untitled Scene';
        }

        return cleanTitle;
    },

    // Enhanced methods for filter functionality

    async getAllTags() {
        const query = `query {
            allTags {
                id
                name
                scene_count
            }
        }`;

        const data = await this.runQuery(query);
        return data?.allTags || [];
    },

    async getScenesByTag(tagName, limit = 50) {
        const query = `query($tag: String!) {
            findScenes(filter: { tags: { value: $tag, modifier: INCLUDES } }, per_page: ${limit}) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                }
            }
        }`;

        const data = await this.runQuery(query, { tag: tagName });
        const scenes = data.findScenes?.scenes || [];

        return scenes.map((scene) => {
            let sceneTitle = scene.title;
            if (!sceneTitle || sceneTitle.trim() === '') {
                sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
            } else {
                sceneTitle = this.toTitleCase(sceneTitle);
            }

            return {
                id: scene.id,
                title: sceneTitle,
                rating100: scene.rating100,
                studio: scene.studio,
                performers:
                    scene.performers?.map((p) => ({
                        name: p.name,
                        gender: p.gender,
                        birthdate: p.birthdate,
                    })) || [],
                screenshot: scene.paths?.screenshot,
                file: scene.files?.[0]?.path || null,
                duration: scene.files?.[0]?.duration || 0,
                date: scene.date,
            };
        });
    },

    async getScenesByDateRange(startDate, endDate) {
        const query = `query($start: String, $end: String) {
            findScenes(filter: { date: { value: $start, value2: $end, modifier: BETWEEN } }) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                    tags { name }
                }
            }
        }`;

        const data = await this.runQuery(query, { start: startDate, end: endDate });
        const scenes = data.findScenes?.scenes || [];

        return scenes.map((scene) => {
            let sceneTitle = scene.title;
            if (!sceneTitle || sceneTitle.trim() === '') {
                sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
            } else {
                sceneTitle = this.toTitleCase(sceneTitle);
            }

            return {
                id: scene.id,
                title: sceneTitle,
                rating100: scene.rating100,
                studio: scene.studio,
                performers:
                    scene.performers?.map((p) => ({
                        name: p.name,
                        gender: p.gender,
                        birthdate: p.birthdate,
                    })) || [],
                screenshot: scene.paths?.screenshot,
                file: scene.files?.[0]?.path || null,
                duration: scene.files?.[0]?.duration || 0,
                date: scene.date,
                tags: scene.tags?.map((t) => t.name) || [],
            };
        });
    },

    async getScenesByRatingRange(minRating, maxRating) {
        const query = `query($min: Int, $max: Int) {
            findScenes(filter: { rating: { value: $min, value2: $max, modifier: BETWEEN } }) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                    tags { name }
                }
            }
        }`;

        const data = await this.runQuery(query, { min: minRating, max: maxRating });
        const scenes = data.findScenes?.scenes || [];

        return scenes.map((scene) => {
            let sceneTitle = scene.title;
            if (!sceneTitle || sceneTitle.trim() === '') {
                sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
            } else {
                sceneTitle = this.toTitleCase(sceneTitle);
            }

            return {
                id: scene.id,
                title: sceneTitle,
                rating100: scene.rating100,
                studio: scene.studio,
                performers:
                    scene.performers?.map((p) => ({
                        name: p.name,
                        gender: p.gender,
                        birthdate: p.birthdate,
                    })) || [],
                screenshot: scene.paths?.screenshot,
                file: scene.files?.[0]?.path || null,
                duration: scene.files?.[0]?.duration || 0,
                date: scene.date,
                tags: scene.tags?.map((t) => t.name) || [],
            };
        });
    },

    async getScenesByDurationRange(minDuration, maxDuration) {
        const query = `query($min: Float, $max: Float) {
            findScenes(filter: { duration: { value: $min, value2: $max, modifier: BETWEEN } }) {
                scenes {
                    id
                    title
                    rating100
                    studio { name }
                    performers { 
                        name 
                        gender
                        birthdate
                    }
                    paths { screenshot }
                    files { path duration }
                    date
                    tags { name }
                }
            }
        }`;

        const data = await this.runQuery(query, { min: minDuration, max: maxDuration });
        const scenes = data.findScenes?.scenes || [];

        return scenes.map((scene) => {
            let sceneTitle = scene.title;
            if (!sceneTitle || sceneTitle.trim() === '') {
                sceneTitle = this.getTitleFromFilePath(scene.files?.[0]?.path);
            } else {
                sceneTitle = this.toTitleCase(sceneTitle);
            }

            return {
                id: scene.id,
                title: sceneTitle,
                rating100: scene.rating100,
                studio: scene.studio,
                performers:
                    scene.performers?.map((p) => ({
                        name: p.name,
                        gender: p.gender,
                        birthdate: p.birthdate,
                    })) || [],
                screenshot: scene.paths?.screenshot,
                file: scene.files?.[0]?.path || null,
                duration: scene.files?.[0]?.duration || 0,
                date: scene.date,
                tags: scene.tags?.map((t) => t.name) || [],
            };
        });
    },

    async getPerformersByAgeRange(minAge, maxAge) {
        const query = `query {
            allPerformers {
                id
                name
                gender
                birthdate
                image_path
                scene_count
                details
            }
        }`;

        const data = await this.runQuery(query);
        const allPerformers = data?.allPerformers || [];

        const filteredPerformers = allPerformers.filter((performer) => {
            if (performer.gender !== 'FEMALE') return false;
            if (!performer.birthdate) return false;

            const birthdate = new Date(performer.birthdate);
            const age = this.calculateAgeFromBirthdate(birthdate);

            return age >= minAge && age <= maxAge;
        });

        return filteredPerformers.map((performer) => ({
            id: performer.id,
            name: performer.name,
            gender: performer.gender,
            birthdate: performer.birthdate,
            image_path: performer.image_path,
            scene_count: performer.scene_count || 0,
            details: performer.details || '',
        }));
    },

    async getStudiosBySceneCountRange(minCount, maxCount) {
        const query = `query {
            allStudios {
                id
                name
                image_path
                scene_count
            }
        }`;

        const data = await this.runQuery(query);
        const allStudios = data?.allStudios || [];

        return allStudios
            .filter((studio) => {
                const sceneCount = studio.scene_count || 0;
                return sceneCount >= minCount && sceneCount <= maxCount;
            })
            .map((studio) => ({
                id: studio.id,
                name: studio.name,
                image_path: studio.image_path,
                scene_count: studio.scene_count || 0,
            }));
    },

    calculateAgeFromBirthdate: function (birthdate) {
        if (!birthdate) return null;

        try {
            const birthDate = new Date(birthdate);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            return age;
        } catch (e) {
            console.error('Error calculating age:', e);
            return null;
        }
    },

    async getFilteredScenes(filters) {
        try {
            let allScenes = await this.getAllScenes();

            // Apply filters
            if (filters.alphabet) {
                allScenes = allScenes.filter((scene) => {
                    const firstLetter = scene.title?.charAt(0).toUpperCase();
                    return firstLetter === filters.alphabet;
                });
            }

            if (filters.ratingRange) {
                allScenes = allScenes.filter((scene) => {
                    const rating = scene.rating100 || 0;
                    switch (filters.ratingRange) {
                        case '90-100':
                            return rating >= 90 && rating <= 100;
                        case '80-89':
                            return rating >= 80 && rating <= 89;
                        case '70-79':
                            return rating >= 70 && rating <= 79;
                        case '60-69':
                            return rating >= 60 && rating <= 69;
                        case '0-59':
                            return rating >= 0 && rating <= 59;
                        case 'unrated':
                            return rating === null || rating === undefined || rating === 0;
                        default:
                            return true;
                    }
                });
            }

            if (filters.durationRange) {
                allScenes = allScenes.filter((scene) => {
                    const duration = scene.duration || 0;
                    const minutes = Math.floor(duration / 60);

                    switch (filters.durationRange) {
                        case 'short':
                            return minutes < 10;
                        case 'medium':
                            return minutes >= 10 && minutes <= 30;
                        case 'long':
                            return minutes > 30;
                        default:
                            return true;
                    }
                });
            }

            if (filters.performerCount) {
                allScenes = allScenes.filter((scene) => {
                    const performerCount = scene.performers?.length || 0;

                    switch (filters.performerCount) {
                        case '1':
                            return performerCount === 1;
                        case '2':
                            return performerCount === 2;
                        case '3':
                            return performerCount === 3;
                        case '4-plus':
                            return performerCount >= 4;
                        default:
                            return true;
                    }
                });
            }

            if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
                allScenes = allScenes.filter((scene) => {
                    if (!scene.date) return false;

                    const sceneDate = new Date(scene.date);

                    if (filters.dateRange.start) {
                        const startDate = new Date(filters.dateRange.start);
                        if (sceneDate < startDate) return false;
                    }

                    if (filters.dateRange.end) {
                        const endDate = new Date(filters.dateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        if (sceneDate > endDate) return false;
                    }

                    return true;
                });
            }

            if (filters.tags && filters.tags.length > 0) {
                allScenes = allScenes.filter((scene) => {
                    const sceneTags = scene.tags || [];
                    return filters.tags.every((tag) =>
                        sceneTags.some(
                            (sceneTag) =>
                                sceneTag && sceneTag.toLowerCase().includes(tag.toLowerCase())
                        )
                    );
                });
            }

            // Apply sorting
            if (filters.sortBy) {
                allScenes.sort((a, b) => {
                    switch (filters.sortBy) {
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
                            return (b.duration || 0) - (a.duration || 0);
                        case 'duration-asc':
                            return (a.duration || 0) - (b.duration || 0);
                        case 'age-asc':
                            const ageA = this.getYoungestFemalePerformerAge(a);
                            const ageB = this.getYoungestFemalePerformerAge(b);
                            return (ageA || 99) - (ageB || 99);
                        case 'age-desc':
                            const ageA2 = this.getYoungestFemalePerformerAge(a);
                            const ageB2 = this.getYoungestFemalePerformerAge(b);
                            return (ageB2 || 0) - (ageA2 || 0);
                        case 'random':
                            return Math.random() - 0.5;
                        default:
                            return (a.title || '').localeCompare(b.title || '');
                    }
                });
            }

            return allScenes;
        } catch (error) {
            console.error('Error getting filtered scenes:', error);
            return [];
        }
    },

    async getFilteredPerformers(filters) {
        try {
            let allPerformers = await this.getAllPerformers();

            // Apply filters
            if (filters.alphabet) {
                allPerformers = allPerformers.filter((performer) => {
                    const firstLetter = performer.name?.charAt(0).toUpperCase();
                    return firstLetter === filters.alphabet;
                });
            }

            if (filters.ageRange) {
                allPerformers = allPerformers.filter((performer) => {
                    if (!performer.birthdate) return false;

                    const age = this.calculateAgeFromBirthdate(performer.birthdate);
                    if (age === null) return false;

                    switch (filters.ageRange) {
                        case '18-24':
                            return age >= 18 && age <= 24;
                        case '25-34':
                            return age >= 25 && age <= 34;
                        case '35-plus':
                            return age >= 35;
                        default:
                            return true;
                    }
                });
            }

            if (filters.sceneCount) {
                allPerformers = allPerformers.filter((performer) => {
                    const sceneCount = performer.scene_count || 0;

                    switch (filters.sceneCount) {
                        case '1':
                            return sceneCount === 1;
                        case '2-5':
                            return sceneCount >= 2 && sceneCount <= 5;
                        case '6-plus':
                            return sceneCount >= 6;
                        default:
                            return true;
                    }
                });
            }

            // Apply sorting
            if (filters.sortBy) {
                allPerformers.sort((a, b) => {
                    const ageA = a.birthdate ? this.calculateAgeFromBirthdate(a.birthdate) : null;
                    const ageB = b.birthdate ? this.calculateAgeFromBirthdate(b.birthdate) : null;

                    switch (filters.sortBy) {
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

            return allPerformers;
        } catch (error) {
            console.error('Error getting filtered performers:', error);
            return [];
        }
    },

    async getFilteredStudios(filters) {
        try {
            let allStudios = await this.getAllStudios();

            // Apply filters
            if (filters.alphabet) {
                allStudios = allStudios.filter((studio) => {
                    const firstLetter = studio.name?.charAt(0).toUpperCase();
                    return firstLetter === filters.alphabet;
                });
            }

            if (filters.sceneCount) {
                allStudios = allStudios.filter((studio) => {
                    const sceneCount = studio.scene_count || 0;

                    switch (filters.sceneCount) {
                        case '1-5':
                            return sceneCount >= 1 && sceneCount <= 5;
                        case '6-20':
                            return sceneCount >= 6 && sceneCount <= 20;
                        case '21-plus':
                            return sceneCount >= 21;
                        default:
                            return true;
                    }
                });
            }

            // Apply sorting
            if (filters.sortBy) {
                allStudios.sort((a, b) => {
                    switch (filters.sortBy) {
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

            return allStudios;
        } catch (error) {
            console.error('Error getting filtered studios:', error);
            return [];
        }
    },

    async getPopularTags(limit = 50) {
        try {
            const allTags = await this.getAllTags();

            // Sort by scene count and limit
            return allTags
                .sort((a, b) => (b.scene_count || 0) - (a.scene_count || 0))
                .slice(0, limit)
                .map((tag) => ({
                    name: tag.name,
                    count: tag.scene_count || 0,
                }));
        } catch (error) {
            console.error('Error getting popular tags:', error);
            return [];
        }
    },

    async getSceneStatistics() {
        try {
            const allScenes = await this.getAllScenes();

            const statistics = {
                total: allScenes.length,
                rated: allScenes.filter((scene) => scene.rating100 && scene.rating100 > 0).length,
                unrated: allScenes.filter((scene) => !scene.rating100 || scene.rating100 === 0)
                    .length,
                withStudio: allScenes.filter((scene) => scene.studio?.name).length,
                withoutStudio: allScenes.filter((scene) => !scene.studio?.name).length,
                averageDuration: 0,
                totalDuration: 0,
                performerCounts: {},
                studioCounts: {},
                tagCounts: {},
                yearCounts: {},
            };

            // Calculate durations
            let totalDuration = 0;
            let scenesWithDuration = 0;

            allScenes.forEach((scene) => {
                const duration = scene.duration || 0;
                if (duration > 0) {
                    totalDuration += duration;
                    scenesWithDuration++;
                }

                // Count performers
                scene.performers?.forEach((performer) => {
                    if (performer.name) {
                        statistics.performerCounts[performer.name] =
                            (statistics.performerCounts[performer.name] || 0) + 1;
                    }
                });

                // Count studios
                if (scene.studio?.name) {
                    statistics.studioCounts[scene.studio.name] =
                        (statistics.studioCounts[scene.studio.name] || 0) + 1;
                }

                // Count tags
                scene.tags?.forEach((tag) => {
                    if (tag) {
                        statistics.tagCounts[tag] = (statistics.tagCounts[tag] || 0) + 1;
                    }
                });

                // Count by year
                if (scene.date) {
                    try {
                        const year = new Date(scene.date).getFullYear();
                        statistics.yearCounts[year] = (statistics.yearCounts[year] || 0) + 1;
                    } catch (e) {
                        // Ignore invalid dates
                    }
                }
            });

            statistics.totalDuration = totalDuration;
            statistics.averageDuration =
                scenesWithDuration > 0 ? totalDuration / scenesWithDuration : 0;

            // Convert counts to arrays and sort
            statistics.topPerformers = Object.entries(statistics.performerCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            statistics.topStudios = Object.entries(statistics.studioCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            statistics.topTags = Object.entries(statistics.tagCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);

            statistics.years = Object.entries(statistics.yearCounts)
                .map(([year, count]) => ({ year: parseInt(year), count }))
                .sort((a, b) => b.year - a.year);

            return statistics;
        } catch (error) {
            console.error('Error getting scene statistics:', error);
            return null;
        }
    },
};
